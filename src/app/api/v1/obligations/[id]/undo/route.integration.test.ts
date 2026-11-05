import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { access } = vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.CHORE_UNDO_TEST_DATABASE_URL ?? "file::memory:";
  return {
    access: {
      householdId: "00000000-0000-4000-8000-000000000001",
      memberId: "00000000-0000-4000-8000-000000000002",
      role: "device" as "parent" | "device",
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
import { POST as complete } from "../complete/route";
import { POST as review } from "../review/route";
import { POST as undo } from "./route";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const home = uuid(1),
  parent = uuid(2),
  child = uuid(3),
  template = uuid(4),
  occurrence = uuid(5),
  obligation = uuid(6);
const call = (
  handler: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>,
  body?: unknown
) =>
  handler(
    new Request("http://localhost/api/v1/test", {
      method: "POST",
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    }),
    { params: Promise.resolve({ id: obligation }) }
  );
const state = async () => (await db`SELECT * FROM chore_obligations WHERE id = ${obligation}`)[0];

describe(`chore undo approval integration (${databaseDialect})`, () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
    const directory = join(process.cwd(), "db", "migrations", ...(databaseDialect === "sqlite" ? ["sqlite"] : []));
    for (const name of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
      await db.unsafe(await readFile(join(directory, name), "utf8"));
    }
    await db`INSERT INTO households (id, name, timezone) VALUES (${home}, 'Undo test', 'America/Chicago')`;
    await db`INSERT INTO members (id, household_id, role, display_name) VALUES
      (${parent}, ${home}, 'parent', 'Parent'), (${child}, ${home}, 'child', 'Child')`;
  }, 30_000);

  beforeEach(async () => {
    access.householdId = home;
    access.role = "device";
    await db`DELETE FROM audit_events`;
    await db`DELETE FROM chore_obligations`;
    await db`DELETE FROM chore_occurrences`;
    await db`DELETE FROM chore_templates`;
    await db`INSERT INTO chore_templates (id, household_id, title, assignment_policy, approval_required, schedule_kind, start_date)
      VALUES (${template}, ${home}, 'Tidy room', 'individual', true, 'once', '2026-11-04')`;
    await db`INSERT INTO chore_template_assignees (chore_template_id, member_id) VALUES (${template}, ${child})`;
    await db`INSERT INTO chore_occurrences (id, chore_template_id, household_id, scheduled_for)
      VALUES (${occurrence}, ${template}, ${home}, '2026-11-04')`;
    await db`INSERT INTO chore_obligations (id, occurrence_id, member_id) VALUES (${obligation}, ${occurrence}, ${child})`;
  });

  afterAll(async () => {
    vi.useRealTimers();
    await db.end();
  });

  it("blocks child undo while awaiting parent approval", async () => {
    expect((await call(complete, { actorId: child })).status).toBe(200);
    const before = await state();
    expect(before.status).toBe("pending");
    expect((await call(undo)).status).toBe(403);
    expect(await state()).toEqual(before);
    expect(await db`SELECT id FROM audit_events WHERE action = 'chore.undone'`).toHaveLength(0);
  });

  it("lets a child undo an approved chore and submit it for approval again", async () => {
    expect((await call(complete, { actorId: child })).status).toBe(200);
    access.role = "parent";
    expect((await call(review, { decision: "approve" })).status).toBe(200);
    expect((await state()).status).toBe("completed");

    access.role = "device";
    expect((await call(undo)).status).toBe(200);
    expect(await state()).toMatchObject({
      status: "open",
      approval_status: "not_required",
      completed_by: null,
      completed_at: null,
    });
    expect(await db`SELECT id FROM audit_events WHERE action = 'chore.undone'`).toHaveLength(1);

    expect((await call(complete, { actorId: child })).status).toBe(200);
    expect(await state()).toMatchObject({ status: "pending", approval_status: "pending", completed_by: child });
    expect((await call(undo)).status).toBe(403);
  });

  it.each([false, true])("allows parents to undo approval chores (reviewed: %s)", async (reviewed) => {
    await call(complete, { actorId: child });
    access.role = "parent";
    if (reviewed) await call(review, { decision: "approve" });
    expect((await call(undo)).status).toBe(200);
    expect(await state()).toMatchObject({ status: "open", completed_by: null, completed_at: null });
    expect(await db`SELECT actor_id FROM audit_events WHERE action = 'chore.undone'`).toEqual([{ actor_id: parent }]);
  });

  it("preserves child undo for chores without approval", async () => {
    await db`UPDATE chore_templates SET approval_required = false WHERE id = ${template}`;
    await call(complete, { actorId: child });
    expect((await call(undo)).status).toBe(200);
    expect(await state()).toMatchObject({ status: "open", approval_status: "not_required", completed_by: null });
  });

  it("keeps pending submissions locked if the template approval setting changes", async () => {
    await call(complete, { actorId: child });
    await db`UPDATE chore_templates SET approval_required = false WHERE id = ${template}`;
    expect((await call(undo)).status).toBe(403);
    expect((await state()).status).toBe("pending");
  });

  it("rejects undo from another household", async () => {
    await call(complete, { actorId: child });
    const before = await state();
    access.role = "parent";
    access.householdId = uuid(99);
    expect((await call(undo)).status).toBe(403);
    expect(await state()).toEqual(before);
  });
});
