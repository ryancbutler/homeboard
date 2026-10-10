import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { access } = vi.hoisted(() => {
  // Only the explicitly named test database can opt into PostgreSQL.
  process.env.DATABASE_URL = process.env.VACATION_TEST_DATABASE_URL ?? "file::memory:";
  return {
    access: {
      householdId: "00000000-0000-4000-8000-000000000001",
      memberId: "00000000-0000-4000-8000-000000000002",
      role: "parent" as "parent" | "device",
    },
  };
});
vi.mock("@/lib/auth", () => ({
  requireContext: vi.fn(async (parent: boolean) => {
    if (parent && access.role !== "parent") throw new Error("Unauthorized");
    return access;
  }),
}));

import { db, databaseDialect } from "@/lib/db";
import { POST as createAbsences, GET as getAbsences } from "@/app/api/v1/member-absences/route";
import { PUT as editAbsence, DELETE as deleteAbsence } from "@/app/api/v1/member-absences/[id]/route";
import { POST as completeChore } from "@/app/api/v1/obligations/[id]/complete/route";
import { POST as reviewChore } from "@/app/api/v1/obligations/[id]/review/route";
import { POST as undoChore } from "@/app/api/v1/obligations/[id]/undo/route";
import { POST as postponeChore } from "@/app/api/v1/obligations/[id]/postpone/route";
import { POST as rescheduleChore } from "@/app/api/v1/obligations/[id]/reschedule/route";
import { POST as toggleStep } from "@/app/api/v1/routine-runs/[id]/steps/[stepId]/route";
import { GET as reports } from "@/app/api/v1/reports/route";
import { GET as exportBackup, POST as importBackup } from "@/app/api/v1/backup/route";
import { dashboardFor } from "@/lib/dashboard";
import { materializeChores, materializeRoutines, markMissed } from "@/lib/recurrence";
import { loadVacationContext } from "@/lib/member-absence-store";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const home = uuid(1),
  parent = uuid(2),
  maya = uuid(3),
  noah = uuid(4),
  foreign = uuid(5),
  foreignChild = uuid(6);
const request = (body: unknown, method = "POST") =>
  new Request("http://localhost/api/v1/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const reportRequest = (csv = false) =>
  new Request(`http://localhost/api/v1/reports?from=2026-10-01&to=2026-10-18${csv ? "&format=csv" : ""}`);
let sequence = 20;

async function away(ids = [maya], startDate = "2026-10-10", endDate = "2026-10-12") {
  const response = await createAbsences(request({ memberIds: ids, startDate, endDate }));
  expect(response.status).toBe(201);
  return response.json() as Promise<{ id: string; memberId: string; startDate: string; endDate: string }[]>;
}

async function chore(
  options: {
    owner?: string | null;
    day?: string;
    status?: string;
    flexible?: boolean;
    allowed?: string[];
    approval?: boolean;
    policy?: string;
  } = {}
) {
  const owner = options.owner === undefined ? maya : options.owner;
  const template = uuid(sequence++),
    occurrence = uuid(sequence++),
    obligation = uuid(sequence++);
  const day = options.day ?? "2026-10-10",
    status = options.status ?? "open";
  await db`INSERT INTO chore_templates (id, household_id, title, assignment_policy, approval_required, schedule_kind, start_date, is_flexible, day_part)
    VALUES (${template}, ${home}, ${`Chore ${template}`}, ${options.policy ?? (owner ? "individual" : "any")}, ${options.approval ?? false}, ${options.flexible ? "weekly" : "once"}, ${day}, ${options.flexible ?? false}, 'morning')`;
  for (const id of options.allowed ?? (owner ? [owner] : []))
    await db`INSERT INTO chore_template_assignees (chore_template_id, member_id) VALUES (${template}, ${id})`;
  await db`INSERT INTO chore_occurrences (id, chore_template_id, household_id, scheduled_for) VALUES (${occurrence}, ${template}, ${home}, ${day})`;
  await db`INSERT INTO chore_obligations (id, occurrence_id, member_id, status, approval_status, completed_by, completed_at)
    VALUES (${obligation}, ${occurrence}, ${owner}, ${status}, ${status === "pending" ? "pending" : "not_required"},
      ${["completed", "pending"].includes(status) ? (owner ?? maya) : null}, ${["completed", "pending"].includes(status) ? new Date("2026-10-10T12:00:00Z") : null})`;
  return { template, occurrence, obligation };
}

async function routine(owner: string | null = maya) {
  const template = uuid(sequence++),
    run = uuid(sequence++),
    first = uuid(sequence++),
    second = uuid(sequence++);
  await db`INSERT INTO routine_templates (id, household_id, title, assignment_policy, schedule_kind, start_date, day_part)
    VALUES (${template}, ${home}, ${`Routine ${template}`}, ${owner ? "every" : "any"}, 'daily', '2026-10-10', 'morning')`;
  if (owner)
    await db`INSERT INTO routine_template_assignees (routine_template_id, member_id) VALUES (${template}, ${owner})`;
  await db`INSERT INTO routine_steps (id, routine_template_id, position, title) VALUES (${first}, ${template}, 1, 'First step'), (${second}, ${template}, 2, 'Second step')`;
  await db`INSERT INTO routine_runs (id, routine_template_id, household_id, scheduled_for, member_id) VALUES (${run}, ${template}, ${home}, '2026-10-10', ${owner})`;
  return { template, run, first, second };
}

describe(`vacation integration (${databaseDialect})`, () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    const directory = join(process.cwd(), "db", "migrations", ...(databaseDialect === "sqlite" ? ["sqlite"] : []));
    const files = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
    // Upgrade a database with existing household data, rather than only testing fresh installs.
    for (const name of files.slice(0, -1)) await db.unsafe(await readFile(join(directory, name), "utf8"));
    await db`INSERT INTO households (id, name, timezone) VALUES (${home}, 'Vacation test', 'America/Chicago'), (${foreign}, 'Other household', 'UTC')`;
    await db`INSERT INTO members (id, household_id, role, display_name) VALUES
      (${parent}, ${home}, 'parent', 'Parent'), (${maya}, ${home}, 'child', 'Maya'), (${noah}, ${home}, 'child', 'Noah'), (${foreignChild}, ${foreign}, 'child', 'Foreign child')`;
    await db.unsafe(await readFile(join(directory, files.at(-1)!), "utf8"));
    expect(await db<{ id: string }[]>`SELECT id FROM members WHERE household_id = ${home}`).toHaveLength(3);
  }, 30_000);
  beforeEach(async () => {
    access.householdId = home;
    access.memberId = parent;
    access.role = "parent";
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    await db`UPDATE chore_obligations SET rescheduled_from_obligation_id = NULL`;
    for (const table of [
      "member_absences",
      "audit_events",
      "routine_step_completions",
      "routine_runs",
      "routine_steps",
      "routine_template_assignees",
      "routine_templates",
      "chore_obligations",
      "chore_occurrences",
      "chore_template_assignees",
      "chore_templates",
      "chore_group_rotations",
      "chore_groups",
    ])
      await db.unsafe(`DELETE FROM ${table}`);
  });
  afterAll(async () => {
    vi.useRealTimers();
    await db.end();
  });

  it("creates ranges for several children atomically and audits the changes", async () => {
    const ranges = await away([maya, noah]);
    expect(ranges).toHaveLength(2);
    expect(await (await getAbsences()).json()).toHaveLength(2);
    expect(await db`SELECT id FROM audit_events WHERE action = 'absence.created'`).toHaveLength(2);
    expect(
      (
        await createAbsences(
          request({ memberIds: [maya, foreignChild], startDate: "2026-10-10", endDate: "2026-10-12" })
        )
      ).status
    ).toBe(400);
    expect(await db`SELECT id FROM member_absences`).toHaveLength(2);
  });
  it("rejects unauthorized access, parent IDs, duplicate IDs, and impossible dates", async () => {
    access.role = "device";
    expect((await getAbsences()).status).toBe(401);
    expect(
      (await createAbsences(request({ memberIds: [maya], startDate: "2026-10-10", endDate: "2026-10-12" }))).status
    ).toBe(401);
    access.role = "parent";
    for (const input of [
      { memberIds: [parent], startDate: "2026-10-10", endDate: "2026-10-12" },
      { memberIds: [maya, maya], startDate: "2026-10-10", endDate: "2026-10-12" },
      { memberIds: [maya], startDate: "2026-02-30", endDate: "2026-03-01" },
      { memberIds: [maya], startDate: "2026-10-12", endDate: "2026-10-10" },
    ])
      expect((await createAbsences(request(input))).status).toBe(400);
    expect(await db`SELECT id FROM member_absences`).toHaveLength(0);
  });
  it("scopes edits and deletion to the parent's household", async () => {
    const [range] = await away();
    access.householdId = foreign;
    expect(
      (await editAbsence(request({ startDate: "2026-10-11", endDate: "2026-10-12" }, "PUT"), params(range.id))).status
    ).toBe(404);
    expect((await deleteAbsence(new Request("http://localhost"), params(range.id))).status).toBe(404);
    access.householdId = home;
    expect((await getAbsences()).status).toBe(200);
    expect(await db`SELECT id FROM member_absences`).toHaveLength(1);
  });
  it("excuses missed dates retroactively and restores them when edited or deleted", async () => {
    const item = await chore({ day: "2026-10-05", status: "missed" });
    const [range] = await away([maya], "2026-10-05", "2026-10-10");
    let report = await (await reports(reportRequest())).json();
    expect(report.rows[0]).toMatchObject({ status: "excused", raw_status: "missed" });
    expect(report.summary).toMatchObject({ total: 0, missed: 0, excused: 1 });
    expect(
      (await editAbsence(request({ startDate: "2026-10-06", endDate: "2026-10-10" }, "PUT"), params(range.id))).status
    ).toBe(200);
    report = await (await reports(reportRequest())).json();
    expect(report.rows[0].status).toBe("missed");
    await editAbsence(request({ startDate: "2026-10-05", endDate: "2026-10-10" }, "PUT"), params(range.id));
    await deleteAbsence(new Request("http://localhost"), params(range.id));
    expect((await (await reports(reportRequest())).json()).rows[0].status).toBe("missed");
    expect(
      (await db<{ status: string }[]>`SELECT status FROM chore_obligations WHERE id = ${item.obligation}`)[0].status
    ).toBe("missed");
  });
  it("preserves completion credit and pending approvals while hiding unfinished work", async () => {
    await away();
    await chore();
    await chore({ status: "rejected" });
    const completed = await chore({ status: "completed" });
    const pending = await chore({ status: "pending" });
    const dashboard = await dashboardFor(home);
    expect(dashboard.children.find((child) => child.id === maya)?.away?.returnDate).toBe("2026-10-13");
    expect(dashboard.chores.map((item) => item.obligationId).sort()).toEqual(
      [completed.obligation, pending.obligation].sort()
    );
    expect((await (await reports(reportRequest())).json()).summary).toMatchObject({
      total: 2,
      completed: 1,
      pending: 1,
      excused: 2,
      completionRate: 50,
    });
    const review = await reviewChore(request({ decision: "approve" }), params(pending.obligation));
    expect(review.status, await review.clone().text()).toBe(200);
    expect(
      (await undoChore(new Request("http://localhost", { method: "POST" }), params(completed.obligation))).status
    ).toBe(200);
  });
  it("keeps shared chores for children home and excuses them when everyone eligible is away", async () => {
    const shared = await chore({ owner: null });
    await away();
    let board = await dashboardFor(home);
    expect(board.chores[0].allowedChildren.map((child) => child.id)).toEqual([noah]);
    expect((await completeChore(request({ actorId: maya }), params(shared.obligation))).status).toBe(400);
    access.role = "device";
    expect((await completeChore(request({ actorId: noah }), params(shared.obligation))).status).toBe(200);
    access.role = "parent";
    await chore({ owner: null });
    await away([noah]);
    board = await dashboardFor(home);
    expect(board.chores.filter((item) => item.status === "open")).toHaveLength(0);
    expect((await (await reports(reportRequest())).json()).summary.excused).toBe(1);
  });
  it("does not let a child outside a shared eligibility list pick up the work", async () => {
    const shared = await chore({ owner: null, allowed: [maya] });
    await away();
    expect((await dashboardFor(home)).chores).toHaveLength(0);
    access.role = "device";
    expect((await completeChore(request({ actorId: noah }), params(shared.obligation))).status).toBe(400);
  });
  it("uses the flexible due date and resumes future work after returning", async () => {
    const excused = await chore({ flexible: true, day: "2026-10-11" });
    const afterReturn = await chore({ flexible: true, day: "2026-10-18" });
    await away();
    expect(
      (await (await reports(reportRequest())).json()).rows.find(
        (row: { obligation_id: string }) => row.obligation_id === excused.obligation
      )?.status
    ).toBe("excused");
    expect((await completeChore(request({ actorId: maya }), params(afterReturn.obligation))).status).toBe(400);
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    const board = await dashboardFor(home);
    expect(board.children.find((child) => child.id === maya)?.away).toBeNull();
    expect(board.chores.map((item) => item.obligationId)).toContain(afterReturn.obligation);
    expect(board.chores.map((item) => item.obligationId)).not.toContain(excused.obligation);
  });
  it("keeps partial routine completions and rejects stale actions during vacation", async () => {
    const item = await routine();
    const stepParams = (stepId: string) => ({ params: Promise.resolve({ id: item.run, stepId }) });
    expect((await toggleStep(request({ actorId: maya, completed: true }), stepParams(item.first))).status).toBe(200);
    const [range] = await away();
    expect((await dashboardFor(home)).routines).toHaveLength(0);
    expect((await toggleStep(request({ actorId: maya, completed: true }), stepParams(item.second))).status).toBe(400);
    expect((await toggleStep(request({ actorId: maya, completed: false }), stepParams(item.first))).status).toBe(400);
    await deleteAbsence(new Request("http://localhost"), params(range.id));
    expect((await dashboardFor(home)).routines[0].completedSteps).toBe(1);
    expect((await toggleStep(request({ actorId: maya, completed: true }), stepParams(item.second))).status).toBe(200);
  });
  it("pauses future flexible work today without excusing its later due date", async () => {
    const item = await chore({ flexible: true, day: "2026-10-11" });
    await away([maya], "2026-10-10", "2026-10-10");
    expect((await dashboardFor(home)).chores).toHaveLength(0);
    expect((await (await reports(reportRequest())).json()).rows[0].status).toBe("open");
    vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
    expect((await dashboardFor(home)).chores.map((row) => row.obligationId)).toContain(item.obligation);
  });
  it("excuses postponed and rescheduled work on its new scheduled date", async () => {
    await away([maya], "2026-10-11", "2026-10-11");
    const flexible = await chore({ flexible: true });
    const postponed = await postponeChore(request({ scheduledFor: "2026-10-11" }), params(flexible.obligation));
    expect(postponed.status, await postponed.clone().text()).toBe(200);
    const missed = await chore({ day: "2026-10-05", status: "missed" });
    const rescheduled = await rescheduleChore(request({ scheduledFor: "2026-10-11" }), params(missed.obligation));
    expect(rescheduled.status, await rescheduled.clone().text()).toBe(201);
    const replacement = await rescheduled.json();
    const report = await (await reports(reportRequest())).json();
    expect(
      report.rows.find((row: { obligation_id: string }) => row.obligation_id === flexible.obligation)?.status
    ).toBe("excused");
    expect(
      report.rows.find((row: { obligation_id: string }) => row.obligation_id === replacement.obligationId)?.status
    ).toBe("excused");
    expect(report.rows.find((row: { obligation_id: string }) => row.obligation_id === missed.obligation)?.status).toBe(
      "missed"
    );
  });
  it("excuses only the away child's obligation for an every-child chore", async () => {
    const item = await chore({ policy: "every", allowed: [maya, noah] });
    await db`INSERT INTO chore_obligations (occurrence_id, member_id) VALUES (${item.occurrence}, ${noah})`;
    await away();
    const board = await dashboardFor(home);
    expect(board.chores).toHaveLength(1);
    expect(board.chores[0].assignee?.id).toBe(noah);
    expect((await (await reports(reportRequest())).json()).summary).toMatchObject({ total: 1, excused: 1 });
  });
  it("keeps flexible completion history and dashboard credit in the household day", async () => {
    const item = await chore({ flexible: true, day: "2026-10-11", status: "completed" });
    await db`UPDATE chore_obligations SET completed_at = ${new Date("2026-10-11T04:30:00Z")} WHERE id = ${item.obligation}`;
    await away();
    const report = await (await reports(reportRequest())).json();
    expect(report.rows[0]).toMatchObject({ history_date: "2026-10-10", status: "completed" });
    expect(report.dailySummary).toMatchObject({ total: 1, completed: 1 });
    expect((await dashboardFor(home)).chores.map((row) => row.obligationId)).toContain(item.obligation);
    if (databaseDialect === "sqlite") {
      await db.unsafe(
        `UPDATE chore_obligations SET completed_at = '2026-10-11 04:30:00' WHERE id = '${item.obligation}'`
      );
      const dayOnly = await (
        await reports(new Request("http://localhost/api/v1/reports?from=2026-10-10&to=2026-10-10"))
      ).json();
      expect(dayOnly.rows[0]).toMatchObject({ history_date: "2026-10-10", status: "completed" });
      expect((await dashboardFor(home)).chores.map((row) => row.obligationId)).toContain(item.obligation);
    }
  });
  it("keeps shared routines available only to home children", async () => {
    const item = await routine(null);
    await away();
    expect((await dashboardFor(home)).routines[0].eligibleChildIds).toEqual([noah]);
    expect(
      (
        await toggleStep(request({ actorId: maya, completed: true }), {
          params: Promise.resolve({ id: item.run, stepId: item.first }),
        })
      ).status
    ).toBe(400);
    expect(
      (
        await toggleStep(request({ actorId: noah, completed: true }), {
          params: Promise.resolve({ id: item.run, stepId: item.first }),
        })
      ).status
    ).toBe(200);
    await away([noah]);
    expect((await dashboardFor(home)).routines).toHaveLength(0);
  });
  it("exports excused and original statuses in CSV", async () => {
    await chore({ day: "2026-10-05", status: "missed" });
    await away([maya], "2026-10-05", "2026-10-10");
    const csv = await (await reports(reportRequest(true))).text();
    expect(csv).toContain("raw_status");
    expect(csv).toContain('"Excused — away","missed"');
  });
  it("round trips setup backups and skips duplicate ranges without rewriting history", async () => {
    await away();
    await chore({ status: "completed" });
    const backup = await (await exportBackup()).json();
    expect(backup.version).toBe(5);
    expect(backup.absences).toEqual([{ child: "Maya", startDate: "2026-10-10", endDate: "2026-10-12" }]);
    await db`DELETE FROM member_absences`;
    const imported = await importBackup(request(backup));
    expect(imported.status, await imported.clone().text()).toBe(200);
    expect((await imported.json()).importedAbsences).toBe(1);
    expect((await (await importBackup(request(backup))).json()).importedAbsences).toBe(0);
    expect(
      await db<{ status: string }[]>`SELECT status FROM chore_obligations WHERE status = 'completed'`
    ).toHaveLength(1);
    expect((await importBackup(request({ version: 4 }))).status).toBe(200);
    expect(await db`SELECT id FROM member_absences`).toHaveLength(1);
    expect(
      (
        await importBackup(
          request({ absences: [{ child: "Unknown", startDate: "2026-10-10", endDate: "2026-10-12" }] })
        )
      ).status
    ).toBe(400);
  });
  it("keeps schedules idempotent and rotation ownership unchanged during vacation", async () => {
    const firstGroup = uuid(sequence++),
      secondGroup = uuid(sequence++);
    const item = await chore();
    await db`INSERT INTO chore_groups (id, household_id, name, assigned_member_id) VALUES (${firstGroup}, ${home}, 'First', ${maya}), (${secondGroup}, ${home}, 'Second', ${noah})`;
    await db`INSERT INTO chore_group_rotations (household_id, first_group_id, second_group_id, first_member_id, second_member_id, start_date)
      VALUES (${home}, ${firstGroup}, ${secondGroup}, ${maya}, ${noah}, '2026-10-05')`;
    await db`UPDATE chore_templates SET chore_group_id = ${firstGroup}, schedule_kind = 'daily' WHERE id = ${item.template}`;
    await away();
    await materializeChores(new Date("2026-10-13T12:00:00Z"));
    const before = await db`SELECT id FROM chore_obligations`;
    await materializeChores(new Date("2026-10-13T12:00:00Z"));
    expect(await db`SELECT id FROM chore_obligations`).toHaveLength(before.length);
    const vacation = await loadVacationContext(home);
    const [during] = await db<
      { member_id: string }[]
    >`SELECT o.member_id FROM chore_obligations o JOIN chore_occurrences c ON c.id = o.occurrence_id WHERE c.scheduled_for = '2026-10-10'`;
    expect(during.member_id).toBe(maya);
    expect(vacation.isAway(during.member_id, "2026-10-10")).toBe(true);
    const [next] = await db<
      { member_id: string }[]
    >`SELECT o.member_id FROM chore_obligations o JOIN chore_occurrences c ON c.id = o.occurrence_id WHERE c.scheduled_for = '2026-10-12'`;
    expect(next.member_id).toBe(noah);
    const run = await routine();
    await materializeRoutines(new Date("2026-10-13T12:00:00Z"));
    await materializeRoutines(new Date("2026-10-13T12:00:00Z"));
    expect(await db`SELECT id FROM routine_runs WHERE routine_template_id = ${run.template}`).toHaveLength(4);
  });
  it("uses household midnight for missed marking, including the DST boundary", async () => {
    vi.setSystemTime(new Date("2026-11-01T04:59:59Z"));
    const today = await chore({ day: "2026-10-31" });
    const yesterday = await chore({ day: "2026-10-30" });
    await markMissed();
    expect(
      (await db<{ status: string }[]>`SELECT status FROM chore_obligations WHERE id = ${today.obligation}`)[0].status
    ).toBe("open");
    expect(
      (await db<{ status: string }[]>`SELECT status FROM chore_obligations WHERE id = ${yesterday.obligation}`)[0]
        .status
    ).toBe("missed");
    vi.setSystemTime(new Date("2026-11-01T05:00:00Z"));
    await markMissed();
    expect(
      (await db<{ status: string }[]>`SELECT status FROM chore_obligations WHERE id = ${today.obligation}`)[0].status
    ).toBe("missed");
  });
});
