import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { absenceDatesSchema } from "@/lib/member-absence";
import { databaseIdSchema } from "@/lib/id-validation";

type Params = { params: Promise<{ id: string }> };

async function mutate(request: Request, params: Params, remove: boolean) {
  try {
    const context = await requireContext(true);
    const id = databaseIdSchema.parse((await params.params).id);
    const dates = remove ? null : absenceDatesSchema.parse(await request.json());
    const result = await db.begin(async (tx) => {
      const [previous] = await tx<{ member_id: string; start_date: string; end_date: string }[]>`
        SELECT member_id, start_date, end_date FROM member_absences
        WHERE id = ${id} AND household_id = ${context.householdId} FOR UPDATE`;
      if (!previous) return null;
      if (dates) {
        const [child] = await tx<{ id: string }[]>`SELECT id FROM members WHERE id = ${previous.member_id}
          AND household_id = ${context.householdId} AND role = 'child' AND active = true`;
        if (!child) throw new Error("Select an active child in your household.");
        await tx`UPDATE member_absences SET start_date = ${dates.startDate}, end_date = ${dates.endDate}, updated_at = now()
          WHERE id = ${id} AND household_id = ${context.householdId}`;
      } else await tx`DELETE FROM member_absences WHERE id = ${id} AND household_id = ${context.householdId}`;
      await tx`INSERT INTO audit_events (household_id, actor_id, action, entity_type, entity_id, detail)
        VALUES (${context.householdId}, ${context.memberId ?? null}, ${remove ? "absence.deleted" : "absence.updated"},
          'member_absence', ${id}, ${JSON.stringify({ previous, dates })})`;
      return { id, memberId: previous.member_id, ...(dates ?? {}) };
    });
    return result ? NextResponse.json(result) : NextResponse.json({ error: "Away range not found." }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request, params: Params) {
  return mutate(request, params, false);
}
export async function DELETE(request: Request, params: Params) {
  return mutate(request, params, true);
}
