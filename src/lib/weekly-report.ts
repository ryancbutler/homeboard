export type WeeklyReportRow = {
  history_date: string;
  title: string;
  child: string | null;
  child_id: string | null;
  is_shared: boolean;
  status: string;
};

export type WeeklyChoreSummary = {
  title: string;
  total: number;
  completed: number;
  missed: number;
  open: number;
  pending: number;
  rejected: number;
  excused: number;
};

export function mondayFor(day: string): string {
  const value = new Date(`${day}T12:00:00.000Z`);
  const weekday = value.getUTCDay();
  value.setUTCDate(value.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  return value.toISOString().slice(0, 10);
}

export function shiftDay(day: string, amount: number): string {
  const value = new Date(`${day}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

/** Keep previously fetched data out of a newly selected week's view. */
export function reportForWeek<T extends { from: string; to: string }>(report: T | null, weekStart: string): T | null {
  return weekStart && report?.from === weekStart && report.to === shiftDay(weekStart, 6) ? report : null;
}

export function summarizeWeeklyRows(rows: WeeklyReportRow[], child = "all") {
  const selectedRows = rows.filter(
    (row) => child === "all" || (child === "shared" ? row.is_shared : row.child_id === child)
  );
  const chores = new Map<string, WeeklyChoreSummary>();

  for (const row of selectedRows) {
    const summary = chores.get(row.title) ?? {
      title: row.title,
      total: 0,
      completed: 0,
      missed: 0,
      open: 0,
      pending: 0,
      rejected: 0,
      excused: 0,
    };
    if (row.status !== "excused") summary.total += 1;
    if (row.status === "excused") summary.excused += 1;
    if (row.status === "completed") summary.completed += 1;
    if (row.status === "missed") summary.missed += 1;
    if (row.status === "open") summary.open += 1;
    if (row.status === "pending") summary.pending += 1;
    if (row.status === "rejected") summary.rejected += 1;
    chores.set(row.title, summary);
  }

  const choreSummaries = [...chores.values()].sort((left, right) => left.title.localeCompare(right.title));
  const completed = selectedRows.filter((row) => row.status === "completed").length;
  const missed = selectedRows.filter((row) => row.status === "missed").length;
  const open = selectedRows.filter((row) => row.status === "open").length;
  const pending = selectedRows.filter((row) => row.status === "pending").length;
  const rejected = selectedRows.filter((row) => row.status === "rejected").length;
  const excused = selectedRows.filter((row) => row.status === "excused").length;
  const total = selectedRows.length - excused;

  return {
    rows: selectedRows,
    choreSummaries,
    completed,
    missed,
    open,
    pending,
    rejected,
    excused,
    total,
    completionRate: total ? Math.round((completed / total) * 100) : null,
    wins: [...choreSummaries]
      .filter((summary) => summary.completed > 0)
      .sort(
        (left, right) => right.completed / right.total - left.completed / left.total || right.completed - left.completed
      ),
    attention: [...choreSummaries]
      .filter((summary) => summary.missed + summary.rejected > 0)
      .sort((left, right) => right.missed + right.rejected - (left.missed + left.rejected) || right.total - left.total),
  };
}
