import { NextResponse } from "next/server";
import { fromZonedTime } from "date-fns-tz";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { dateInTimezone } from "@/lib/dates";
import { apiError } from "@/lib/http";
import { loadVacationContext } from "@/lib/member-absence-store";
import { summarizeChoreStatuses } from "@/lib/member-absence";
import { z } from "zod";

export const dynamic = "force-dynamic";
const dateParameter = z.string().date();

type HistoryRow = {
  obligation_id: string;
  template_id: string;
  member_id: string | null;
  scheduled_for: string;
  title: string;
  child: string | null;
  child_id: string | null;
  assignment_policy: string;
  status: string;
  approval_status: string;
  completed_at: Date | null;
  rescheduled_for: string | null;
  is_flexible: boolean;
  schedule_kind: string;
  weekdays: number[];
};

export async function GET(request: Request) {
  try {
    const context = await requireContext(true);
    const url = new URL(request.url);
    const [household] = await db<
      { timezone: string }[]
    >`SELECT timezone FROM households WHERE id = ${context.householdId}`;
    if (!household) throw new Error("Household not found");
    const today = dateInTimezone(new Date(), household.timezone);
    const isCsv = url.searchParams.get("format") === "csv";
    const requestedFrom = url.searchParams.get("from") ?? undefined;
    const requestedTo = url.searchParams.get("to") ?? undefined;
    if (requestedFrom) dateParameter.parse(requestedFrom);
    if (requestedTo) dateParameter.parse(requestedTo);
    const from =
      requestedFrom ??
      (isCsv ? "0001-01-01" : dateInTimezone(new Date(Date.now() - 30 * 86_400_000), household.timezone));
    const to = requestedTo ?? (isCsv ? "9999-12-31" : today);
    if (from > to) throw new Error("The report start date must be on or before the end date");
    const allHistory = isCsv && !requestedFrom && !requestedTo;
    const rangeStart = fromZonedTime(`${from}T00:00:00`, household.timezone);
    const rangeEnd = fromZonedTime(`${to}T23:59:59.999`, household.timezone);
    const todayStart = fromZonedTime(`${today}T00:00:00`, household.timezone);
    const todayEnd = fromZonedTime(`${today}T23:59:59.999`, household.timezone);
    const [vacation, history] = await Promise.all([
      loadVacationContext(context.householdId),
      db<HistoryRow[]>`
        SELECT o.id AS obligation_id, ct.id AS template_id, o.member_id, co.scheduled_for,
          ct.title, COALESCE(assignee.display_name, completed.display_name) AS child,
          COALESCE(o.member_id, o.completed_by) AS child_id, ct.assignment_policy,
          o.status, o.approval_status, o.completed_at, replacement_occurrence.scheduled_for AS rescheduled_for,
          ct.is_flexible, ct.schedule_kind, COALESCE(ct.weekdays, '{}') AS weekdays
        FROM chore_obligations o JOIN chore_occurrences co ON co.id = o.occurrence_id
        JOIN chore_templates ct ON ct.id = co.chore_template_id
        LEFT JOIN members assignee ON assignee.id = o.member_id
        LEFT JOIN members completed ON completed.id = o.completed_by
        LEFT JOIN chore_obligations replacement ON replacement.rescheduled_from_obligation_id = o.id
        LEFT JOIN chore_occurrences replacement_occurrence ON replacement_occurrence.id = replacement.occurrence_id
        WHERE co.household_id = ${context.householdId} AND (
          ${allHistory} OR co.scheduled_for BETWEEN ${from} AND ${to} OR co.scheduled_for = ${today}
          OR (ct.is_flexible = true AND (
            o.completed_at BETWEEN ${rangeStart} AND ${rangeEnd}
            OR o.completed_at BETWEEN ${todayStart} AND ${todayEnd}
          ))
        )`,
    ]);
    // Resolve calendar dates in application code so SQLite and PostgreSQL agree.
    const effectiveRows = history.map((row) => ({
      ...row,
      is_flexible: Boolean(row.is_flexible),
      history_date:
        row.is_flexible && row.completed_at ? dateInTimezone(row.completed_at, household.timezone) : row.scheduled_for,
      raw_status: row.status,
      status: vacation.choreStatus(
        row.template_id,
        row.member_id,
        row.assignment_policy,
        row.scheduled_for,
        row.status
      ),
      is_shared: row.assignment_policy === "any",
    }));
    const rows = effectiveRows
      .filter((row) => row.history_date >= from && row.history_date <= to)
      .sort((a, b) => b.history_date.localeCompare(a.history_date) || a.title.localeCompare(b.title));
    const dailySummary = summarizeChoreStatuses(effectiveRows.filter((row) => row.history_date === today));
    if (isCsv) {
      const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
      const body = [
        "history_date,scheduled_for,rescheduled_for,schedule_kind,weekdays,is_flexible,chore,child,status,raw_status,approval_status,completed_at",
        ...rows.map((row) =>
          [
            row.history_date,
            row.scheduled_for,
            row.rescheduled_for,
            row.schedule_kind,
            row.weekdays.join(" "),
            row.is_flexible,
            row.title,
            row.child,
            row.status === "excused" ? "Excused — away" : row.status,
            row.raw_status,
            row.approval_status,
            row.completed_at?.toISOString(),
          ]
            .map(escape)
            .join(",")
        ),
      ].join("\n");
      return new Response(body, {
        headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=homeboard-report.csv" },
      });
    }
    return NextResponse.json(
      { from, to, summary: summarizeChoreStatuses(rows), dailySummary, rows },
      { headers: { "Cache-Control": "no-store, must-revalidate" } }
    );
  } catch (error) {
    return apiError(error);
  }
}
