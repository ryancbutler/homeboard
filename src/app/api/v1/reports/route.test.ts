import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "file::memory:";
});
vi.mock("@/lib/auth", () => ({ requireContext: vi.fn(async () => ({ householdId: "home" })) }));

import { db } from "@/lib/db";
import { GET } from "./route";

const reportRequest = (from: string, to: string, csv = false) =>
  new Request(`http://localhost/api/v1/reports?from=${from}&to=${to}${csv ? "&format=csv" : ""}`);

describe("report history boundaries", () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    await db.unsafe(`
      CREATE TABLE households (id TEXT PRIMARY KEY, timezone TEXT);
      CREATE TABLE members (id TEXT PRIMARY KEY, display_name TEXT);
      CREATE TABLE chore_templates (id TEXT PRIMARY KEY, title TEXT, is_flexible INTEGER, schedule_kind TEXT, weekdays TEXT, assignment_policy TEXT);
      CREATE TABLE chore_occurrences (id TEXT PRIMARY KEY, chore_template_id TEXT, household_id TEXT, scheduled_for TEXT);
      CREATE TABLE chore_obligations (id TEXT PRIMARY KEY, occurrence_id TEXT, member_id TEXT, completed_by TEXT, status TEXT, approval_status TEXT, completed_at TEXT, rescheduled_from_obligation_id TEXT);
      INSERT INTO households VALUES ('home', 'UTC'), ('other', 'UTC');
      INSERT INTO members VALUES ('child-a', 'Alex');
      INSERT INTO chore_templates VALUES ('flex', 'Fold Laundry', 1, 'weekly', '[1]', 'any'), ('daily', 'Read', 0, 'daily', '[]', 'individual');
      INSERT INTO chore_occurrences VALUES
        ('early', 'flex', 'home', '2026-10-05'),
        ('late', 'flex', 'home', '2026-10-04'),
        ('open', 'flex', 'home', '2026-10-05'),
        ('regular', 'daily', 'home', '2026-10-04'),
        ('foreign', 'flex', 'other', '2026-10-05');
      INSERT INTO chore_obligations VALUES
        ('early', 'early', NULL, 'child-a', 'completed', 'not_required', '2026-10-04T12:00:00Z', NULL),
        ('late', 'late', NULL, 'child-a', 'completed', 'not_required', '2026-10-05T12:00:00Z', NULL),
        ('open', 'open', NULL, NULL, 'open', 'not_required', NULL, NULL),
        ('regular', 'regular', 'child-a', 'child-a', 'completed', 'not_required', '2026-10-05T12:00:00Z', NULL),
        ('foreign', 'foreign', NULL, NULL, 'open', 'not_required', NULL, NULL);
    `);
  });

  afterAll(async () => {
    vi.useRealTimers();
    await db.end();
  });

  it("counts flexible completions in exactly one week and regular chores on their scheduled date", async () => {
    const previousResponse = await GET(reportRequest("2026-09-28", "2026-10-04"));
    expect(previousResponse.status).toBe(200);
    const previous = await previousResponse.json();
    expect(previous.rows.map((row: { obligation_id: string }) => row.obligation_id).sort()).toEqual([
      "early",
      "regular",
    ]);
    const currentResponse = await GET(reportRequest("2026-10-05", "2026-10-11"));
    expect(currentResponse.status).toBe(200);
    const current = await currentResponse.json();
    expect(current.rows.map((row: { obligation_id: string }) => row.obligation_id).sort()).toEqual(["late", "open"]);
    expect(current.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ obligation_id: "late", child_id: "child-a", is_shared: true }),
        expect.objectContaining({ obligation_id: "open", child_id: null, is_shared: true }),
      ])
    );
    expect(previous.rows).toEqual(
      expect.arrayContaining([expect.objectContaining({ obligation_id: "regular", is_shared: false })])
    );
    expect(current.dailySummary).toMatchObject({ total: 2, completed: 1, completionRate: 50 });
  });

  it("uses the same history boundary for date-filtered CSV exports", async () => {
    const response = await GET(reportRequest("2026-10-05", "2026-10-11", true));
    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv.split("\n")).toHaveLength(3);
    expect(csv).not.toContain('"2026-10-04","2026-10-05"');
    expect(csv).not.toContain('"Read"');
  });
});
