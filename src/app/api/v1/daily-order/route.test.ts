import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, begin } = vi.hoisted(() => ({ query: vi.fn(), begin: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: Object.assign(query, { begin }) }));
vi.mock("@/lib/auth", () => ({ requireContext: vi.fn(async () => ({ householdId: "home" })) }));

import { PUT } from "./route";

const request = (items: unknown[]) =>
  new Request("http://localhost/api/v1/daily-order", {
    method: "PUT",
    body: JSON.stringify({ items }),
    headers: { "Content-Type": "application/json" },
  });

describe("saving daily order", () => {
  beforeEach(() => {
    query.mockReset();
    begin.mockReset();
    query.mockImplementation(async (strings: TemplateStringsArray) => {
      const sql = strings.join("?");
      if (sql.includes("SELECT id FROM chore_templates")) return [{ id: "chore-1" }];
      if (sql.includes("SELECT id FROM routine_templates")) return [{ id: "routine-1" }];
      return [];
    });
    begin.mockImplementation(async (callback: (tx: typeof query) => Promise<unknown>) => callback(query));
  });

  it("saves one order across chores and routines", async () => {
    const response = await PUT(
      request([
        { type: "routine", id: "routine-1", dayPart: "morning" },
        { type: "chore", id: "chore-1", dayPart: "morning" },
      ])
    );
    expect(response.status).toBe(200);
    const updates = query.mock.calls.filter(([strings]) => strings.join("?").includes("UPDATE "));
    expect(updates).toHaveLength(2);
    expect(updates.map((call) => call[2])).toEqual([1, 2]);
  });

  it.each([
    [[{ type: "chore", id: "chore-1", dayPart: "morning" }], "missing"],
    [
      [
        { type: "chore", id: "chore-1", dayPart: "morning" },
        { type: "chore", id: "chore-1", dayPart: "evening" },
      ],
      "duplicate",
    ],
    [
      [
        { type: "chore", id: "chore-1", dayPart: "morning" },
        { type: "routine", id: "foreign", dayPart: "evening" },
      ],
      "foreign",
    ],
  ])("rejects %s items without writing", async (items) => {
    const response = await PUT(request(items));
    expect(response.status).toBe(400);
    expect(query.mock.calls.some(([strings]) => strings.join("?").includes("UPDATE "))).toBe(false);
  });
});
