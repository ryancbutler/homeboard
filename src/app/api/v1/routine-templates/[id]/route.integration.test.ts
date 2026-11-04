import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { access } = vi.hoisted(() => {
  // PostgreSQL runs must explicitly opt into a disposable test database.
  process.env.DATABASE_URL = process.env.ROUTINE_DELETE_TEST_DATABASE_URL ?? "file::memory:";
  return {
    access: {
      householdId: "00000000-0000-4000-8000-000000000001",
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
import { materializeRoutines } from "@/lib/recurrence";
import { DELETE } from "./route";

const home = "00000000-0000-4000-8000-000000000001";
const child = "00000000-0000-4000-8000-000000000002";
const otherHome = "00000000-0000-4000-8000-000000000003";
const template = "00000000-0000-4000-8000-000000000004";
const step = "00000000-0000-4000-8000-000000000005";
const run = "00000000-0000-4000-8000-000000000006";
const deleteRoutine = (id = template) =>
  DELETE(new Request(`http://localhost/api/v1/routine-templates/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });

describe(`routine deletion integration (${databaseDialect})`, () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Still November 2 in the household, despite the UTC date being November 3.
    vi.setSystemTime(new Date("2026-11-03T02:00:00Z"));
    const directory = join(process.cwd(), "db", "migrations", ...(databaseDialect === "sqlite" ? ["sqlite"] : []));
    for (const name of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
      await db.unsafe(await readFile(join(directory, name), "utf8"));
    }
    await db`INSERT INTO households (id, name, timezone) VALUES
      (${home}, 'Routine deletion test', 'America/Chicago'), (${otherHome}, 'Other household', 'UTC')`;
    await db`INSERT INTO members (id, household_id, role, display_name) VALUES (${child}, ${home}, 'child', 'Child')`;
  }, 30_000);

  beforeEach(async () => {
    access.householdId = home;
    access.role = "parent";
    await db`DELETE FROM routine_runs`;
    await db`DELETE FROM routine_templates`;
    await db`INSERT INTO routine_templates (id, household_id, title, schedule_kind, start_date)
      VALUES (${template}, ${home}, 'Bedtime', 'daily', '2026-11-01')`;
    await db`INSERT INTO routine_template_assignees (routine_template_id, member_id) VALUES (${template}, ${child})`;
    await db`INSERT INTO routine_steps (id, routine_template_id, position, title) VALUES (${step}, ${template}, 1, 'Brush teeth')`;
  });

  afterAll(async () => {
    vi.useRealTimers();
    await db.end();
  });

  it.each([
    ["2026-11-01", false],
    ["2026-11-01", true],
    ["2026-11-02", true],
  ])("archives a routine with a retained run on %s (completed: %s)", async (day, completed) => {
    await db`INSERT INTO routine_runs (id, routine_template_id, household_id, scheduled_for, member_id, completed_at)
      VALUES (${run}, ${template}, ${home}, ${day}, ${child}, ${completed ? new Date() : null})`;
    // Preserve recorded step activity for both completed and partial past runs.
    await db`INSERT INTO routine_step_completions (routine_run_id, routine_step_id, completed_by, completed_at)
      VALUES (${run}, ${step}, ${child}, ${new Date()})`;
    await db`INSERT INTO routine_runs (routine_template_id, household_id, scheduled_for, member_id)
      VALUES (${template}, ${home}, '2026-11-02', NULL), (${template}, ${home}, '2026-11-03', NULL)`;

    expect(await (await deleteRoutine()).json()).toEqual({ success: true, id: template });
    expect(await db`SELECT id FROM routine_templates WHERE id = ${template} AND active = false`).toHaveLength(1);
    expect(await db`SELECT id FROM routine_runs WHERE routine_template_id = ${template}`).toEqual([{ id: run }]);
    expect(await db`SELECT id FROM routine_steps WHERE id = ${step}`).toHaveLength(1);
    expect(
      await db`SELECT routine_step_id, completed_by FROM routine_step_completions WHERE routine_run_id = ${run}`
    ).toEqual([{ routine_step_id: step, completed_by: child }]);

    expect((await deleteRoutine()).status).toBe(200);
    await materializeRoutines();
    expect(await db`SELECT id FROM routine_runs WHERE routine_template_id = ${template}`).toEqual([{ id: run }]);
  });

  it.each([false, true])("removes a routine without retained history (has open runs: %s)", async (hasRuns) => {
    if (hasRuns) {
      await db`INSERT INTO routine_runs (routine_template_id, household_id, scheduled_for, member_id)
        VALUES (${template}, ${home}, '2026-11-02', ${child}), (${template}, ${home}, '2026-11-03', ${child})`;
    }
    expect((await deleteRoutine()).status).toBe(200);
    expect(await db`SELECT id FROM routine_templates WHERE id = ${template}`).toHaveLength(0);
    expect(await db`SELECT id FROM routine_runs WHERE routine_template_id = ${template}`).toHaveLength(0);
    expect(await db`SELECT id FROM routine_steps WHERE routine_template_id = ${template}`).toHaveLength(0);
    expect(
      await db`SELECT member_id FROM routine_template_assignees WHERE routine_template_id = ${template}`
    ).toHaveLength(0);
  });

  it("rejects deletion from another household without changing the routine", async () => {
    access.householdId = otherHome;
    expect((await deleteRoutine()).status).toBe(400);
    expect(await db`SELECT id FROM routine_templates WHERE id = ${template} AND active = true`).toHaveLength(1);
  });

  it("requires parent access", async () => {
    access.role = "device";
    expect((await deleteRoutine()).status).toBe(401);
    expect(await db`SELECT id FROM routine_templates WHERE id = ${template} AND active = true`).toHaveLength(1);
  });
});
