import { describe, expect, it } from "vitest";
import { compareDailyItems, validateDailyOrder } from "@/lib/day-order";

describe("daily order", () => {
  it("interleaves chores and routines by section and parent position", () => {
    const items = [
      { id: "chore-2", title: "Dinner dishes", dayPart: "evening" as const, displayOrder: 1 },
      { id: "routine-1", title: "Morning routine", dayPart: "morning" as const, displayOrder: 2 },
      { id: "chore-1", title: "Brush teeth", dayPart: "morning" as const, displayOrder: 1 },
      { id: "old", title: "Old task", dayPart: null, displayOrder: null },
    ];
    expect(items.sort(compareDailyItems).map((item) => item.id)).toEqual(["chore-1", "routine-1", "chore-2", "old"]);
  });

  it("requires exactly the household's active items", () => {
    const expected = new Set(["chore:a", "routine:b"]);
    expect(() => validateDailyOrder(expected, ["routine:b", "chore:a"])).not.toThrow();
    expect(() => validateDailyOrder(expected, ["chore:a"])).toThrow();
    expect(() => validateDailyOrder(expected, ["chore:a", "chore:a"])).toThrow();
    expect(() => validateDailyOrder(expected, ["chore:a", "routine:foreign"])).toThrow();
  });
});
