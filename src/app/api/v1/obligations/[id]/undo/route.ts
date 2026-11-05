import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireContext();
    const { id } = await params;

    const result = await db.begin(async (tx) => {
      const rows = await tx<
        {
          household_id: string;
          status: string;
          approval_required: boolean;
        }[]
      >`
        SELECT co.household_id, o.status, ct.approval_required
        FROM chore_obligations o
        JOIN chore_occurrences co ON co.id = o.occurrence_id
        JOIN chore_templates ct ON ct.id = co.chore_template_id
        WHERE o.id = ${id} FOR UPDATE`;

      const obligation = rows[0];
      if (!obligation || obligation.household_id !== context.householdId) {
        throw new Error("Forbidden");
      }

      if (!["completed", "pending"].includes(obligation.status)) {
        return { status: obligation.status };
      }

      if (context.role !== "parent" && (obligation.status === "pending" || obligation.approval_required)) {
        throw new Error("Forbidden");
      }

      const [updated] = await tx<{ status: string }[]>`
        UPDATE chore_obligations
        SET status = 'open',
            approval_status = 'not_required',
            completed_by = NULL,
            completed_at = NULL,
            rejection_note = NULL
        WHERE id = ${id}
        RETURNING status`;

      await tx`
        INSERT INTO audit_events (household_id, actor_id, action, entity_type, entity_id)
        VALUES (${context.householdId}, ${context.memberId ?? null}, 'chore.undone', 'chore_obligation', ${id})`;

      return updated;
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
