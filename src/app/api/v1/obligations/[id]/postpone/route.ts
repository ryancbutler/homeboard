import { NextResponse } from "next/server";
import { z } from "zod";
import { requireContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { dateInTimezone, dueAt, sundayOfWeek } from "@/lib/dates";
import { apiError } from "@/lib/http";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date."),
});

type PostponeContext = {
  household_id: string;
  occurrence_id: string;
  scheduled_for: string;
  status: string;
  is_flexible: boolean;
  due_time: string | null;
  timezone: string;
  title: string;
  postponed_from: string | null;
};

async function contextFor(tx: typeof db, obligationId: string): Promise<PostponeContext | undefined> {
  const rows = await tx<PostponeContext[]>`
    SELECT co.household_id, co.id AS occurrence_id, co.scheduled_for, co.postponed_from,
      o.status, ct.is_flexible, ct.due_time, h.timezone, ct.title
    FROM chore_obligations o
    JOIN chore_occurrences co ON co.id = o.occurrence_id
    JOIN chore_templates ct ON ct.id = co.chore_template_id
    JOIN households h ON h.id = co.household_id
    WHERE o.id = ${obligationId}`;
  return rows[0];
}

function assertEligible(obligation: PostponeContext, householdId: string, today: string) {
  if (obligation.household_id !== householdId) throw new Error("Forbidden");
  if (!obligation.is_flexible) throw new Error("Only flexible chores can be postponed.");
  if (obligation.status !== "open" && obligation.status !== "rejected") {
    throw new Error("Only open chores can be postponed.");
  }
  if (obligation.scheduled_for !== today) throw new Error("Flexible chores can only be postponed on their due day.");
  if (obligation.postponed_from) throw new Error("This chore has already been postponed.");
}

function labelFor(day: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00.000Z`));
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireContext(true);
    const { id } = await params;
    const obligation = await contextFor(db, id);
    if (!obligation) throw new Error("Chore not found.");
    const today = dateInTimezone(new Date(), obligation.timezone);
    assertEligible(obligation, context.householdId, today);

    return NextResponse.json({
      title: obligation.title,
      today,
      weekEndsOn: sundayOfWeek(today),
      days: Array.from({ length: 7 }, (_, offset) => {
        const date = new Date(`${today}T12:00:00.000Z`);
        date.setUTCDate(date.getUTCDate() + offset + 1);
        const value = date.toISOString().slice(0, 10);
        return {
          date: value,
          label: labelFor(value),
          available: value <= sundayOfWeek(today),
          reason: value <= sundayOfWeek(today) ? null : "Next week",
        };
      }).filter((day) => day.available),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireContext(true);
    const { id } = await params;
    const { scheduledFor } = bodySchema.parse(await request.json());
    const result = await db.begin(async (tx) => {
      const obligation = await contextFor(tx, id);
      if (!obligation) throw new Error("Chore not found.");
      const today = dateInTimezone(new Date(), obligation.timezone);
      assertEligible(obligation, context.householdId, today);
      if (scheduledFor <= today || scheduledFor > sundayOfWeek(today)) {
        throw new Error("Choose a later day between tomorrow and Sunday.");
      }

      const [conflict] = await tx<{ id: string }[]>`
        SELECT id FROM chore_occurrences
        WHERE household_id = ${context.householdId} AND chore_template_id = (
          SELECT chore_template_id FROM chore_occurrences WHERE id = ${obligation.occurrence_id}
        ) AND scheduled_for = ${scheduledFor}`;
      if (conflict) throw new Error("This chore is already scheduled for that day. Choose another day.");

      await tx`
        UPDATE chore_occurrences
        SET scheduled_for = ${scheduledFor}, due_at = ${dueAt(scheduledFor, obligation.due_time, obligation.timezone)}, postponed_from = ${obligation.scheduled_for}
        WHERE id = ${obligation.occurrence_id}`;
      await tx`
        INSERT INTO audit_events (household_id, actor_id, action, entity_type, entity_id, detail)
        VALUES (${context.householdId}, ${context.memberId ?? null}, 'chore.postponed', 'chore_obligation', ${id},
          ${JSON.stringify({ from: obligation.scheduled_for, to: scheduledFor })})`;
      return { obligationId: id, scheduledFor };
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
