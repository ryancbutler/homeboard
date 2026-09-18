import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { dateInTimezone } from "@/lib/dates";
import { apiError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await requireContext(true);
    const url = new URL(request.url);
    const [household] = await db<{ timezone: string }[]>`
      SELECT timezone FROM households WHERE id = ${context.householdId}`;
    if (!household) throw new Error("Household not found");

    const today = dateInTimezone(new Date(), household.timezone);
    const from = url.searchParams.get("from") ?? dateInTimezone(new Date(Date.now() - 30 * 86_400_000), household.timezone);
    const to = url.searchParams.get("to") ?? today;
    const rows = await db<{
      obligation_id: string; scheduled_for: string; history_date: string; title: string; child: string | null; status: string; approval_status: string; completed_at: Date | null; rescheduled_for: string | null;
    }[]>`
      SELECT o.id AS obligation_id, co.scheduled_for,
        CASE WHEN ct.is_flexible = true AND o.completed_at IS NOT NULL
          THEN (o.completed_at AT TIME ZONE ${household.timezone})::date
          ELSE co.scheduled_for
        END AS history_date,
        ct.title, COALESCE(assignee.display_name, completed.display_name) AS child,
        o.status, o.approval_status, o.completed_at, replacement_occurrence.scheduled_for AS rescheduled_for
      FROM chore_obligations o JOIN chore_occurrences co ON co.id = o.occurrence_id
      JOIN chore_templates ct ON ct.id = co.chore_template_id
      LEFT JOIN members assignee ON assignee.id = o.member_id
      LEFT JOIN members completed ON completed.id = o.completed_by
      LEFT JOIN chore_obligations replacement ON replacement.rescheduled_from_obligation_id = o.id
      LEFT JOIN chore_occurrences replacement_occurrence ON replacement_occurrence.id = replacement.occurrence_id
      WHERE co.household_id = ${context.householdId} AND (
        co.scheduled_for BETWEEN ${from} AND ${to}
        OR (
          ct.is_flexible = true
          AND o.completed_at IS NOT NULL
          AND (o.completed_at AT TIME ZONE ${household.timezone})::date BETWEEN ${from} AND ${to}
        )
      )
      ORDER BY history_date DESC, ct.title`;

    // Today's daily metrics
    const todayRows = await db<{ status: string }[]>`
      SELECT o.status
      FROM chore_obligations o
      JOIN chore_occurrences co ON co.id = o.occurrence_id
      JOIN chore_templates ct ON ct.id = co.chore_template_id
      WHERE co.household_id = ${context.householdId} AND (
        co.scheduled_for = ${today}
        OR (
          ct.is_flexible = true
          AND o.completed_at IS NOT NULL
          AND (o.completed_at AT TIME ZONE ${household.timezone})::date = ${today}
        )
      )`;

    const dailyTotal = todayRows.length;
    const dailyCompleted = todayRows.filter((r) => r.status === "completed").length;
    const dailyPending = todayRows.filter((r) => r.status === "pending").length;
    const dailyMissed = todayRows.filter((r) => r.status === "missed").length;
    const dailySummary = {
      total: dailyTotal,
      completed: dailyCompleted,
      pending: dailyPending,
      missed: dailyMissed,
      completionRate: dailyTotal ? Math.round((dailyCompleted / dailyTotal) * 100) : 0,
    };

    const total = rows.length;
    const completed = rows.filter((row) => row.status === "completed").length;
    const pending = rows.filter((row) => row.status === "pending").length;
    const missed = rows.filter((row) => row.status === "missed").length;

    if (url.searchParams.get("format") === "csv") {
      const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
      const body = ["history_date,scheduled_for,rescheduled_for,chore,child,status,approval_status,completed_at", ...rows.map((row) => [row.history_date, row.scheduled_for, row.rescheduled_for, row.title, row.child, row.status, row.approval_status, row.completed_at?.toISOString()].map(escape).join(","))].join("\n");
      return new Response(body, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=homeboard-report.csv" } });
    }
    return NextResponse.json(
      { from, to, summary: { total, completed, pending, missed, completionRate: total ? Math.round((completed / total) * 100) : 0 }, dailySummary, rows },
      { headers: { "Cache-Control": "no-store, must-revalidate" } }
    );
  } catch (error) { return apiError(error); }
}
