import { describe, expect, it } from "vitest";
import { mondayFor, shiftDay, summarizeWeeklyRows } from "@/lib/weekly-report";

describe("weekly reports", () => {
  it("uses Monday through Sunday, including a Sunday", () => {
    expect(mondayFor("2026-10-04")).toBe("2026-09-28");
    expect(shiftDay("2026-09-28", 6)).toBe("2026-10-04");
  });

  it("keeps missed, open, and pending work separate from completed work", () => {
    const summary = summarizeWeeklyRows([
      { history_date: "2026-09-28", title: "Read", child: "Adalynn", status: "completed" },
      { history_date: "2026-09-29", title: "Read", child: "Adalynn", status: "missed" },
      { history_date: "2026-09-30", title: "Vacuum", child: "Remy", status: "open" },
      { history_date: "2026-10-01", title: "Vacuum", child: "Remy", status: "pending" },
      { history_date: "2026-10-02", title: "Dishes", child: "Remy", status: "rejected" },
    ]);

    expect(summary).toMatchObject({ completed: 1, missed: 1, open: 1, pending: 1, rejected: 1, completionRate: 20 });
    expect(summary.attention.map((chore) => chore.title)).toEqual(["Read", "Dishes"]);
    expect(summarizeWeeklyRows(summary.rows, "Adalynn")).toMatchObject({ completed: 1, missed: 1, open: 0 });
  });
});
