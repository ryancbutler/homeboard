import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({ dbMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  databaseDialect: "postgres",
  db: dbMock,
}));

import { materializeChores } from "@/lib/recurrence";

const template = {
  id: "template-b",
  household_id: "household",
  title: "Chores B task",
  assignment_policy: "individual",
  approval_required: false,
  schedule_kind: "daily",
  start_date: "2026-09-01",
  due_time: null,
  weekdays: [],
  chore_group_id: "group-b",
};

describe("rotating chore materialization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T12:00:00.000Z"));
    dbMock.mockReset();
    dbMock.mockImplementation(async (strings: TemplateStringsArray) => {
      const query = strings.join("?");
      if (query.includes("FROM chore_templates")) return [template];
      if (query.includes("FROM chore_group_rotations")) {
        return [
          {
            id: "rotation",
            first_group_id: "group-b",
            second_group_id: "group-a",
            first_member_id: "adalynn",
            second_member_id: "remy",
            start_date: "2026-09-21",
          },
        ];
      }
      if (query.includes("FROM households")) return [{ timezone: "America/Chicago" }];
      if (query.includes("FROM chore_template_assignees")) return [{ member_id: "remy" }];
      if (query.includes("INSERT INTO chore_occurrences")) return [{ id: "occurrence" }];
      return [];
    });
  });

  it("reassigns a stale open group obligation to the current rotation owner", async () => {
    await materializeChores(new Date("2026-09-26T23:59:59.000Z"));

    const updateCall = dbMock.mock.calls.find(([strings]) => strings.join("?").includes("UPDATE chore_obligations"));
    expect(updateCall).toBeDefined();
    expect(updateCall?.[1]).toBe("adalynn");
    expect(updateCall?.[2]).toBe("occurrence");
  });
});
