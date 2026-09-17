import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError, idempotencyKey } from "@/lib/http";

const bodySchema = z.object({ actorId: z.string().uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireContext();
    const { actorId } = bodySchema.parse(await request.json());
    const { id } = await params;
    const key = idempotencyKey(request);
    const result = await db.begin(async (tx) => {
      const rows = await tx<{
        household_id: string; status: string; member_id: string | null; assignment_policy: "individual" | "any" | "every";
        approval_required: boolean; template_id: string;
      }[]>`
        SELECT co.household_id, o.status, o.member_id, ct.assignment_policy, ct.approval_required, ct.id AS template_id
        FROM chore_obligations o JOIN chore_occurrences co ON co.id = o.occurrence_id
        JOIN chore_templates ct ON ct.id = co.chore_template_id WHERE o.id = ${id} FOR UPDATE`;
      const obligation = rows[0];
      if (!obligation || obligation.household_id !== context.householdId) throw new Error("Forbidden");
      if (!["open", "rejected"].includes(obligation.status)) return { alreadyDone: true };
      const actors = await tx<{ role: "parent" | "child" }[]>`
        SELECT role FROM members WHERE id = ${actorId} AND household_id = ${context.householdId} AND active = true`;
      if (!actors[0]) throw new Error("Forbidden");
      if (obligation.member_id && obligation.member_id !== actorId && context.role !== "parent") throw new Error("Forbidden");
      if (!obligation.member_id && obligation.assignment_policy === "any") {
        const allowed = await tx<{ exists: boolean }[]>`
          SELECT EXISTS(SELECT 1 FROM chore_template_assignees WHERE chore_template_id = ${obligation.template_id} AND member_id = ${actorId}) AS exists`;
        if (!allowed[0]?.exists && actors[0].role !== "parent") throw new Error("Forbidden");
      }
      const pending = obligation.approval_required;
      const update = await tx<{ status: string; approval_status: string }[]>`
        UPDATE chore_obligations SET status = ${pending ? "pending" : "completed"},
          approval_status = ${pending ? "pending" : "approved"}, completed_by = ${actorId}, completed_at = now(),
          idempotency_key = ${key}, rejection_note = null
        WHERE id = ${id} RETURNING status, approval_status`;
      await tx`INSERT INTO audit_events (household_id, actor_id, action, entity_type, entity_id)
        VALUES (${context.householdId}, ${actorId}, 'chore.completed', 'chore_obligation', ${id})`;
      return update[0];
    });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}
