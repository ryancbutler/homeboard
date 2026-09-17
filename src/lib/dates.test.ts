import { describe, expect, it } from "vitest";
import { isScheduledOn, scheduledDays } from "@/lib/dates";

describe("scheduling", () => {
  it("keeps a one-time chore immutable", () => {
    const schedule = { kind: "once" as const, startDate: "2026-09-16", weekdays: [] };
    expect(isScheduledOn(schedule, "2026-09-16")).toBe(true);
    expect(isScheduledOn(schedule, "2026-09-17")).toBe(false);
  });

  it("materializes only chosen weekdays", () => {
    const schedule = { kind: "weekdays" as const, startDate: "2026-09-14", weekdays: [1, 3, 5] };
    expect(scheduledDays(schedule, "2026-09-14", "2026-09-20")).toEqual(["2026-09-14", "2026-09-16", "2026-09-18"]);
  });

  it("uses the start day for weekly work", () => {
    const schedule = { kind: "weekly" as const, startDate: "2026-09-15", weekdays: [] };
    expect(scheduledDays(schedule, "2026-09-15", "2026-09-30")).toEqual(["2026-09-15", "2026-09-22", "2026-09-29"]);
  });

  it("defaults older weekday routines to Monday through Friday", () => {
    const schedule = { kind: "weekdays" as const, startDate: "2026-09-14", weekdays: [] };
    expect(scheduledDays(schedule, "2026-09-14", "2026-09-20")).toEqual([
      "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18",
    ]);
  });

  it("uses the selected weekly day instead of the start date weekday", () => {
    const schedule = { kind: "weekly" as const, startDate: "2026-09-15", weekdays: [1] };
    expect(scheduledDays(schedule, "2026-09-15", "2026-10-01")).toEqual(["2026-09-21", "2026-09-28"]);
  });

  it("does not schedule before its start date", () => {
    const schedule = { kind: "weekly" as const, startDate: "2026-09-16", weekdays: [1] };
    expect(scheduledDays(schedule, "2026-09-14", "2026-09-21")).toEqual(["2026-09-21"]);
  });
});
