import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { materializeChores } from "@/lib/recurrence";
import { dateInTimezone } from "@/lib/dates";

const updateSchema = z.object({
  assignedMemberId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(80).optional()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireContext(true);
    const { id } = await params;
    const input = updateSchema.parse(await request.json());

    if (input.assignedMemberId) {
      const [child] = await db<{ id: string }[]>`
        SELECT id FROM members WHERE id = ${input.assignedMemberId} AND household_id = ${context.householdId} AND role = 'child' AND active`;
      if (!child) throw new Error("Group assignee must be an active child in this household");
    }

    const [household] = await db<{ timezone: string }[]>`SELECT timezone FROM households WHERE id = ${context.householdId}`;
    const today = dateInTimezone(new Date(), household.timezone);

    await db.begin(async (transaction) => {
      if (input.name) {
        await transaction`
          UPDATE chore_groups SET name = ${input.name}, updated_at = now()
          WHERE id = ${id} AND household_id = ${context.householdId}`;
      }

      if (input.assignedMemberId !== undefined) {
        const [group] = await transaction<{ id: string }[]>`
          UPDATE chore_groups SET assigned_member_id = ${input.assignedMemberId}, updated_at = now()
          WHERE id = ${id} AND household_id = ${context.householdId} RETURNING id`;
        if (!group) throw new Error("Chore group not found");

        const templates = await transaction<{ id: string }[]>`
          SELECT id FROM chore_templates WHERE chore_group_id = ${id} AND household_id = ${context.householdId} AND active`;

        for (const template of templates) {
          await transaction`DELETE FROM chore_template_assignees WHERE chore_template_id = ${template.id}`;
          if (input.assignedMemberId) {
            await transaction`INSERT INTO chore_template_assignees (chore_template_id, member_id) VALUES (${template.id}, ${input.assignedMemberId})`;
          }
          // Finished work stays attributed to the child who completed it. Open work from
          // today onward is refreshed with the new assignment state.
          await transaction`
            DELETE FROM chore_obligations o USING chore_occurrences c
            WHERE o.occurrence_id = c.id AND c.chore_template_id = ${template.id}
              AND c.scheduled_for >= ${today} AND o.status = 'open'`;
        }
      }
    });

    await materializeChores();
    return NextResponse.json({ id, assignedMemberId: input.assignedMemberId });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireContext(true);
    const { id } = await params;
    const [deleted] = await db<{ id: string }[]>`
      DELETE FROM chore_groups WHERE id = ${id} AND household_id = ${context.householdId} RETURNING id`;
    if (!deleted) throw new Error("Chore group not found");
    return NextResponse.json({ success: true, id });
  } catch (error) { return apiError(error); }
}
