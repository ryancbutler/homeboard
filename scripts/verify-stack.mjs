// Run inside the web container: node scripts/verify-stack.mjs
// Creates a separate temporary household and removes only that fixture afterward.
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const householdId = randomUUID();
const parentId = randomUUID();
const token = randomBytes(32).toString("base64url");
const base = process.env.VERIFY_BASE_URL ?? "http://127.0.0.1:3000";
const today = new Date().toISOString().slice(0, 10);
const api = async (path, method = "GET", body) => {
  const response = await fetch(base + "/api/v1" + path, {
    method,
    headers: { Cookie: "homeboard_session=" + token, "Content-Type": "application/json", "idempotency-key": randomUUID() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.ok(response.ok, method + " " + path + ": " + JSON.stringify(data));
  return data;
};
const board = () => api("/dashboard");
const schedule = { kind: "once", startDate: today, weekdays: [] };

try {
  await sql`INSERT INTO households (id, name, timezone) VALUES (${householdId}, 'Verification household', 'UTC')`;
  await sql`INSERT INTO members (id, household_id, role, display_name) VALUES (${parentId}, ${householdId}, 'parent', 'Verification parent')`;
  await sql`INSERT INTO sessions (member_id, token_hash, expires_at) VALUES (${parentId}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '15 minutes')`;
  const first = await api("/members", "POST", { displayName: "Test child A", color: "#6750AB" });
  const second = await api("/members", "POST", { displayName: "Test child B", color: "#638369" });
  assert.equal((await api("/members")).length, 3);
  console.log("PASS: family creation and authenticated household isolation");

  await api("/chore-templates", "POST", { title: "Individual verification chore", assignmentPolicy: "individual", assigneeIds: [first.id], schedule });
  let chore = (await board()).chores.find((item) => item.title === "Individual verification chore");
  assert.ok(chore, "One-time chore must appear today");
  assert.equal((await api("/obligations/" + chore.obligationId + "/complete", "POST", { actorId: first.id })).status, "completed");
  assert.equal((await api("/obligations/" + chore.obligationId + "/complete", "POST", { actorId: first.id })).alreadyDone, true);
  assert.ok(!(await board()).chores.some((item) => item.obligationId === chore.obligationId));
  console.log("PASS: chore creation, completion, and duplicate submission");

  const weeklyDay = (new Date().getUTCDay() + 1) % 7;
  const weekly = await api("/chore-templates", "POST", {
    title: "Weekly verification chore", assignmentPolicy: "individual", assigneeIds: [first.id],
    schedule: { kind: "weekly", startDate: today, weekdays: [weeklyDay] },
  });
  const weeklyDates = await sql`SELECT scheduled_for::text AS day FROM chore_occurrences WHERE chore_template_id = ${weekly.id}`;
  assert.ok(weeklyDates.length > 0);
  assert.ok(weeklyDates.every(({ day }) => new Date(day + "T00:00:00Z").getUTCDay() === weeklyDay));
  assert.ok(!(await board()).chores.some((item) => item.title === "Weekly verification chore"));
  console.log("PASS: weekly day selection and future chore visibility");

  await api("/chore-templates", "POST", { title: "Approval verification chore", assignmentPolicy: "any", approvalRequired: true, assigneeIds: [first.id, second.id], schedule });
  chore = (await board()).chores.find((item) => item.title === "Approval verification chore");
  assert.equal((await api("/obligations/" + chore.obligationId + "/complete", "POST", { actorId: second.id })).status, "pending");
  await api("/obligations/" + chore.obligationId + "/review", "POST", { decision: "reject" });
  assert.equal((await board()).chores.find((item) => item.obligationId === chore.obligationId).status, "rejected");
  await api("/obligations/" + chore.obligationId + "/complete", "POST", { actorId: second.id });
  await api("/obligations/" + chore.obligationId + "/review", "POST", { decision: "approve" });
  assert.ok(!(await board()).chores.some((item) => item.obligationId === chore.obligationId));
  console.log("PASS: shared chore credit, rejection, retry, and approval");

  const group = await api("/chore-groups", "POST", { name: "Verification group", assignedMemberId: first.id });
  for (const title of ["Group finished chore", "Group open chore"]) {
    await api("/chore-templates", "POST", { title, assignmentPolicy: "individual", groupId: group.id, schedule });
  }
  chore = (await board()).chores.find((item) => item.title === "Group finished chore");
  await api("/obligations/" + chore.obligationId + "/complete", "POST", { actorId: first.id });
  await api("/chore-groups/" + group.id, "PATCH", { assignedMemberId: second.id });
  const regrouped = await board();
  assert.equal(regrouped.chores.find((item) => item.title === "Group open chore").assignee.id, second.id);
  assert.ok(!regrouped.chores.some((item) => item.title === "Group finished chore"), "Reassignment must not recreate a finished chore");
  console.log("PASS: group reassignment preserves finished work");

  await api("/routine-templates", "POST", { title: "Shared verification routine", assignmentPolicy: "any", assigneeIds: [first.id, second.id], schedule, steps: ["First step", "Second step"] });
  await api("/routine-templates", "POST", { title: "Second verification routine", assignmentPolicy: "individual", assigneeIds: [first.id], schedule, steps: ["Another step"] });
  const routines = (await board()).routines.filter((item) => item.title === "Shared verification routine");
  assert.equal(routines.length, 1, "Repeated materialization must not duplicate shared routines");
  const routine = routines[0];
  const path = "/routine-runs/" + routine.id + "/steps/" + routine.steps[0].id;
  await api(path, "POST", { actorId: first.id, completed: true });
  assert.equal((await board()).routines.find((item) => item.id === routine.id).completedSteps, 1);
  await api(path, "POST", { actorId: first.id, completed: false });
  assert.equal((await board()).routines.find((item) => item.id === routine.id).completedSteps, 0);
  console.log("PASS: routine scheduling, uniqueness, check-off, and undo");

  const report = await api("/reports");
  assert.equal(report.summary.completed, 3);
  assert.equal(report.rows.find((row) => row.title === "Group finished chore").child, "Test child A");
  const csv = await fetch(base + "/api/v1/reports?format=csv", { headers: { Cookie: "homeboard_session=" + token } });
  assert.ok(csv.ok && csv.headers.get("content-type").includes("text/csv"));
  assert.ok((await csv.text()).includes("Group finished chore"));
  console.log("PASS: reports, completion attribution, and CSV export");
} finally {
  await sql.begin(async (tx) => {
    await tx`DELETE FROM chore_occurrences WHERE household_id = ${householdId}`;
    await tx`DELETE FROM routine_runs WHERE household_id = ${householdId}`;
    await tx`DELETE FROM households WHERE id = ${householdId}`;
  });
  await sql.end();
  console.log("Temporary verification household removed; existing households were preserved.");
}
