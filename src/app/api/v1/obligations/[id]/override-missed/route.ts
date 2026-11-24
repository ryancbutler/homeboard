import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { databaseIdSchema } from "@/lib/id-validation";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { householdId, memberId } = await requireContext(true);
    const id = databaseIdSchema.parse((await params).id);

    await db.begin(async (tx) => {
      const [obligation] = await tx<{ status: string }[]>`
        SELECT status FROM chore_obligations
        WHERE id = ${id} AND occurrence_id IN (
          SELECT id FROM chore_occurrences WHERE household_id = ${householdId}
        ) FOR UPDATE`;
      if (!obligation) throw new Error("Forbidden");
      if (obligation.status !== "missed") throw new Error("Only missed chores can be marked complete here.");

      // Keep the original completion time, if any, so the review date never moves flexible chore history.
      const [updated] = await tx<{ id: string }[]>`
        UPDATE chore_obligations
        SET status = 'completed', approval_status = 'approved',
            completed_by = COALESCE(completed_by, member_id),
            reviewed_by = ${memberId ?? null}, reviewed_at = now(), rejection_note = NULL
        WHERE id = ${id} AND NOT EXISTS (
          SELECT 1 FROM chore_obligations WHERE rescheduled_from_obligation_id = ${id}
        )
        RETURNING id`;
      if (!updated) throw new Error("This chore has already been rescheduled. Update its replacement instead.");

      await tx`
        INSERT INTO audit_events (household_id, actor_id, action, entity_type, entity_id)
        VALUES (${householdId}, ${memberId ?? null}, 'chore.missed_overridden', 'chore_obligation', ${id})`;
    });

    return NextResponse.json({ status: "completed" });
  } catch (error) {
    return apiError(error);
  }
}
