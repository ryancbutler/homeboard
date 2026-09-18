import { describe, expect, it } from "vitest";
import { scheduleSchema } from "@/lib/schedule-validation";

describe("schedule validation", () => {
  const base = { startDate: "2026-09-16", weekdays: [] };

  it("requires at least one day for weekly chores", () => {
    expect(scheduleSchema.safeParse({ ...base, kind: "weekly" }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...base, kind: "weekly", weekdays: [2, 4] }).success).toBe(true);
    expect(scheduleSchema.safeParse({ ...base, kind: "weekly", weekdays: [2] }).success).toBe(true);
  });

  it("requires at least one day for weekday schedules", () => {
    expect(scheduleSchema.safeParse({ ...base, kind: "weekdays" }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...base, kind: "weekdays", weekdays: [1, 3] }).success).toBe(true);
  });

  it("accepts an omitted or cleared due time", () => {
    expect(scheduleSchema.safeParse({ ...base, kind: "daily", dueTime: null }).success).toBe(true);
    expect(scheduleSchema.safeParse({ ...base, kind: "daily" }).success).toBe(true);
  });

  it("rejects an invalid start date", () => {
    expect(scheduleSchema.safeParse({ ...base, kind: "daily", startDate: "tomorrow" }).success).toBe(false);
  });
});
