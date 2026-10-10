import { describe, expect, it } from "vitest";
import { dateInTimezone } from "@/lib/dates";
import {
  absenceDatesSchema,
  awayRangeFor,
  createAbsencesSchema,
  isMemberAway,
  isWorkExcused,
  summarizeChoreStatuses,
  vacationChoreStatus,
} from "./member-absence";

const ranges = [
  { id: "one", memberId: "maya", startDate: "2026-10-05", endDate: "2026-10-10" },
  { id: "two", memberId: "maya", startDate: "2026-10-08", endDate: "2026-10-12" },
  { id: "three", memberId: "maya", startDate: "2026-10-13", endDate: "2026-10-14" },
  { id: "four", memberId: "noah", startDate: "2026-10-10", endDate: "2026-10-10" },
];

describe("vacation calendar", () => {
  it("includes both boundaries and supports one day without changing other children", () => {
    expect(isMemberAway(ranges, "maya", "2026-10-05")).toBe(true);
    expect(isMemberAway(ranges, "maya", "2026-10-14")).toBe(true);
    expect(isMemberAway(ranges, "maya", "2026-10-15")).toBe(false);
    expect(isMemberAway(ranges, "noah", "2026-10-09")).toBe(false);
    expect(isMemberAway(ranges, "noah", "2026-10-10")).toBe(true);
  });
  it("merges overlapping and adjacent ranges for the actual return date", () => {
    expect(awayRangeFor(ranges, "maya", "2026-10-05")).toEqual({
      startDate: "2026-10-05",
      endDate: "2026-10-14",
      returnDate: "2026-10-15",
    });
    expect(awayRangeFor(ranges, "maya", "2026-10-15")).toBeNull();
  });
  it("uses the due date for flexible, postponed, and rescheduled work", () => {
    expect(isWorkExcused(ranges, "maya", [], "2026-10-12")).toBe(true);
    expect(isWorkExcused(ranges, "maya", [], "2026-10-18")).toBe(false);
    expect(isWorkExcused(ranges, "noah", [], "2026-10-12")).toBe(false);
  });
  it("excuses shared work only when all eligible children are away", () => {
    expect(isWorkExcused(ranges, null, ["maya", "noah"], "2026-10-10")).toBe(true);
    expect(isWorkExcused(ranges, null, ["maya", "noah"], "2026-10-09")).toBe(false);
    expect(isWorkExcused(ranges, null, ["maya"], "2026-10-09")).toBe(true);
    expect(isWorkExcused(ranges, null, [], "2026-10-09")).toBe(false);
  });
  it("recalculates past dates when ranges are removed without mutating raw status", () => {
    const raw = "missed";
    expect(vacationChoreStatus(raw, isWorkExcused(ranges, "maya", [], "2026-10-05"))).toBe("excused");
    expect(vacationChoreStatus(raw, isWorkExcused([], "maya", [], "2026-10-05"))).toBe("missed");
    expect(raw).toBe("missed");
  });
  it.each(["open", "rejected", "missed"])("excuses unfinished %s work", (status) =>
    expect(vacationChoreStatus(status, true)).toBe("excused")
  );
  it.each(["completed", "pending"])("preserves %s work", (status) =>
    expect(vacationChoreStatus(status, true)).toBe(status)
  );
  it("does not penalize away days in report denominators", () => {
    expect(summarizeChoreStatuses([{ status: "completed" }, { status: "excused" }])).toMatchObject({
      total: 1,
      completed: 1,
      excused: 1,
      completionRate: 100,
    });
    expect(summarizeChoreStatuses([{ status: "excused" }])).toMatchObject({ total: 0, excused: 1, completionRate: 0 });
  });
  it("validates actual dates and duplicate selection while permitting past ranges", () => {
    expect(absenceDatesSchema.safeParse({ startDate: "2026-02-30", endDate: "2026-03-01" }).success).toBe(false);
    expect(absenceDatesSchema.safeParse({ startDate: "2026-10-12", endDate: "2026-10-10" }).success).toBe(false);
    expect(absenceDatesSchema.safeParse({ startDate: "2020-02-29", endDate: "2020-02-29" }).success).toBe(true);
    const id = "a".repeat(32);
    expect(
      createAbsencesSchema.safeParse({ memberIds: [id, id], startDate: "2026-10-05", endDate: "2026-10-10" }).success
    ).toBe(false);
  });
  it.each(["2026-03-08T05:59:59Z", "2026-11-01T04:59:59Z"])(
    "uses household dates before local midnight near DST: %s",
    (timestamp) => {
      const day = dateInTimezone(new Date(timestamp), "America/Chicago");
      const nextDay = timestamp.slice(0, 10);
      expect(isMemberAway([{ id: "dst", memberId: "maya", startDate: nextDay, endDate: nextDay }], "maya", day)).toBe(
        false
      );
    }
  );
});
