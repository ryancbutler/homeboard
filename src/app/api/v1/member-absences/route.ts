import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { createAbsencesSchema } from "@/lib/member-absence";
import { loadAbsences } from "@/lib/member-absence-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await requireContext(true);
    return NextResponse.json(await loadAbsences(context.householdId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireContext(true);
    const input = createAbsencesSchema.parse(await request.json());
    const result = await db.begin(async (tx) => {
      const children = await tx<{ id: string }[]>`
        SELECT id FROM members WHERE household_id = ${context.householdId} AND role = 'child' AND active = true
        AND id = ANY(${input.memberIds})`;
      if (children.length !== input.memberIds.length) throw new Error("Select active children in your household.");
      const ranges = [];
      for (const memberId of input.memberIds) {
        const [row] = await tx<{ id: string }[]>`
          INSERT INTO member_absences (household_id, member_id, start_date, end_date)
          VALUES (${context.householdId}, ${memberId}, ${input.startDate}, ${input.endDate}) RETURNING id`;
        const range = { id: row.id, memberId, startDate: input.startDate, endDate: input.endDate };
        await tx`INSERT INTO audit_events (household_id, actor_id, action, entity_type, entity_id, detail)
          VALUES (${context.householdId}, ${context.memberId ?? null}, 'absence.created', 'member_absence', ${row.id}, ${JSON.stringify(range)})`;
        ranges.push(range);
      }
      return ranges;
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
