import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";

const bodySchema = z.object({ decision: z.enum(["approve", "reject"]), note: z.string().max(500).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireContext(true);
    const { id } = await params;
    const { decision, note } = bodySchema.parse(await request.json());
    const rows = await db<{ id: string }[]>`
      UPDATE chore_obligations o SET status = ${decision === "approve" ? "completed" : "rejected"},
        approval_status = ${decision === "approve" ? "approved" : "rejected"}, reviewed_by = ${context.memberId!},
        reviewed_at = now(), rejection_note = ${note ?? null}
      FROM chore_occurrences co WHERE o.id = ${id} AND o.occurrence_id = co.id
        AND co.household_id = ${context.householdId} AND o.status = 'pending' RETURNING o.id`;
    if (!rows[0]) throw new Error("No pending completion found");
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
