import { NextResponse } from "next/server";
import { z } from "zod";
import { requireContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateInTimezone, daysMondayToSunday, dueAt, sundayOfWeek } from "@/lib/dates";
import { apiError } from "@/lib/http";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date."),
});

type RescheduleContext = {
  household_id: string;
  template_id: string;
  member_id: string | null;
  status: string;
  schedule_kind: "once" | "daily" | "weekdays" | "weekly";
  due_time: string | null;
  timezone: string;
  title: string;
  rescheduled_from_obligation_id: string | null;
  has_replacement: boolean;
};

async function contextFor(tx: any, obligationId: string): Promise<RescheduleContext | undefined> {
  const rows = await tx<RescheduleContext[]>`
    SELECT co.household_id, co.chore_template_id AS template_id, o.member_id, o.status,
      ct.schedule_kind, ct.due_time, h.timezone, ct.title, o.rescheduled_from_obligation_id,
      EXISTS(SELECT 1 FROM chore_obligations replacement WHERE replacement.rescheduled_from_obligation_id = o.id) AS has_replacement
    FROM chore_obligations o
    JOIN chore_occurrences co ON co.id = o.occurrence_id
    JOIN chore_templates ct ON ct.id = co.chore_template_id
    JOIN households h ON h.id = co.household_id
    WHERE o.id = ${obligationId}`;
  return rows[0];
}

function assertEligible(obligation: RescheduleContext, householdId: string) {
  if (obligation.household_id !== householdId) throw new Error("Forbidden");
  if (obligation.status !== "missed") throw new Error("Only missed chores can be rescheduled.");
  if (obligation.schedule_kind !== "weekly" && obligation.schedule_kind !== "once") {
    throw new Error("Only weekly and one-time chores can be rescheduled.");
  }
  if (obligation.has_replacement) throw new Error("This missed chore has already been rescheduled.");
  if (obligation.rescheduled_from_obligation_id) {
    throw new Error("This rescheduled chore already has its own history entry.");
  }
}

function labelFor(day: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00.000Z`));
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireContext(true);
    const { id } = await params;
    const obligation = await contextFor(db, id);
    if (!obligation) throw new Error("Chore not found.");
    assertEligible(obligation, context.householdId);

    const today = dateInTimezone(new Date(), obligation.timezone);
    const scheduled = new Set((await db<{ scheduled_for: string }[]>`
      SELECT scheduled_for FROM chore_occurrences
      WHERE household_id = ${context.householdId} AND chore_template_id = ${obligation.template_id}
        AND scheduled_for BETWEEN ${daysMondayToSunday(today)[0]} AND ${sundayOfWeek(today)}`)
      .map((row) => row.scheduled_for));

    return NextResponse.json({
      title: obligation.title,
      today,
      weekEndsOn: sundayOfWeek(today),
      days: daysMondayToSunday(today).map((date) => {
        const isPast = date < today;
        const alreadyScheduled = scheduled.has(date);
        return {
          date,
          label: labelFor(date),
          available: !isPast && !alreadyScheduled,
          reason: isPast ? "Past" : alreadyScheduled ? "Already scheduled" : null,
        };
      }),
    });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireContext(true);
    const { id } = await params;
    const { scheduledFor } = bodySchema.parse(await request.json());

    const result = await db.begin(async (tx) => {
      const obligation = await contextFor(tx, id);
      if (!obligation) throw new Error("Chore not found.");
      assertEligible(obligation, context.householdId);

      const today = dateInTimezone(new Date(), obligation.timezone);
      if (scheduledFor < today || scheduledFor > sundayOfWeek(today)) {
        throw new Error("Choose an available day between today and Sunday.");
      }
      const [existing] = await tx<{ id: string }[]>`
        SELECT id FROM chore_occurrences
        WHERE household_id = ${context.householdId} AND chore_template_id = ${obligation.template_id}
          AND scheduled_for = ${scheduledFor}`;
      if (existing) throw new Error("This chore is already scheduled for that day. Choose another day.");

      const [occurrence] = await tx<{ id: string }[]>`
        INSERT INTO chore_occurrences (chore_template_id, household_id, scheduled_for, due_at)
        VALUES (${obligation.template_id}, ${context.householdId}, ${scheduledFor}, ${dueAt(scheduledFor, obligation.due_time, obligation.timezone)})
        ON CONFLICT (chore_template_id, scheduled_for) DO NOTHING
        RETURNING id`;
      if (!occurrence) throw new Error("This chore is already scheduled for that day. Choose another day.");

      const [rescheduled] = await tx<{ id: string }[]>`
        INSERT INTO chore_obligations (occurrence_id, member_id, status, approval_status, rescheduled_from_obligation_id)
        VALUES (${occurrence.id}, ${obligation.member_id}, 'open', 'not_required', ${id})
        RETURNING id`;
      await tx`
        INSERT INTO audit_events (household_id, actor_id, action, entity_type, entity_id)
        VALUES (${context.householdId}, ${context.memberId ?? null}, 'chore.rescheduled', 'chore_obligation', ${rescheduled.id})`;
      return { obligationId: rescheduled.id, scheduledFor };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return apiError(error); }
}
