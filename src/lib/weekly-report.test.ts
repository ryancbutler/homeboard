import { describe, expect, it } from "vitest";
import { mondayFor, reportForWeek, shiftDay, summarizeWeeklyRows } from "@/lib/weekly-report";

describe("weekly reports", () => {
  it("only displays a fetched report for the selected full week", () => {
    const report = { from: "2026-09-28", to: "2026-10-04", rows: [] };
    expect(reportForWeek(report, "2026-09-28")).toBe(report);
    expect(reportForWeek(report, "2026-10-05")).toBeNull();
    expect(reportForWeek({ ...report, to: "2026-10-03" }, "2026-09-28")).toBeNull();
    expect(reportForWeek(null, "2026-10-05")).toBeNull();
    expect(reportForWeek(report, "")).toBeNull();
  });

  it("distinguishes no activity from chores with no completions", () => {
    expect(summarizeWeeklyRows([]).completionRate).toBeNull();
    expect(
      summarizeWeeklyRows([
        { history_date: "2026-10-05", title: "Read", child: null, child_id: null, is_shared: true, status: "open" },
      ]).completionRate
    ).toBe(0);
  });

  it("filters shared work regardless of completion and children by ID rather than name", () => {
    const rows = [
      { history_date: "2026-10-05", title: "Dishes", child: null, child_id: null, is_shared: true, status: "open" },
      {
        history_date: "2026-10-06",
        title: "Dishes",
        child: "Alex",
        child_id: "child-a",
        is_shared: true,
        status: "completed",
      },
      {
        history_date: "2026-10-06",
        title: "Read",
        child: "Alex",
        child_id: "child-a",
        is_shared: false,
        status: "pending",
      },
      {
        history_date: "2026-10-06",
        title: "Read",
        child: "Alex",
        child_id: "child-b",
        is_shared: false,
        status: "rejected",
      },
    ];
    expect(summarizeWeeklyRows(rows, "shared")).toMatchObject({ completed: 1, open: 1, pending: 0, rejected: 0 });
    expect(summarizeWeeklyRows(rows, "child-a")).toMatchObject({ completed: 1, open: 0, pending: 1, rejected: 0 });
    expect(summarizeWeeklyRows(rows, "child-b").rows).toHaveLength(1);
  });

  it("uses Monday through Sunday, including a Sunday", () => {
    expect(mondayFor("2026-10-04")).toBe("2026-09-28");
    expect(shiftDay("2026-09-28", 6)).toBe("2026-10-04");
  });

  it("keeps missed, open, and pending work separate from completed work", () => {
    const summary = summarizeWeeklyRows([
      {
        history_date: "2026-09-28",
        title: "Read",
        child: "Adalynn",
        child_id: "child-a",
        is_shared: false,
        status: "completed",
      },
      {
        history_date: "2026-09-29",
        title: "Read",
        child: "Adalynn",
        child_id: "child-a",
        is_shared: false,
        status: "missed",
      },
      {
        history_date: "2026-09-30",
        title: "Vacuum",
        child: "Remy",
        child_id: "child-b",
        is_shared: false,
        status: "open",
      },
      {
        history_date: "2026-10-01",
        title: "Vacuum",
        child: "Remy",
        child_id: "child-b",
        is_shared: false,
        status: "pending",
      },
      {
        history_date: "2026-10-02",
        title: "Dishes",
        child: "Remy",
        child_id: "child-b",
        is_shared: false,
        status: "rejected",
      },
    ]);

    expect(summary).toMatchObject({ completed: 1, missed: 1, open: 1, pending: 1, rejected: 1, completionRate: 20 });
    expect(summary.attention.map((chore) => chore.title)).toEqual(["Read", "Dishes"]);
    expect(summarizeWeeklyRows(summary.rows, "child-a")).toMatchObject({ completed: 1, missed: 1, open: 0 });
  });
});
