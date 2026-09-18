import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { dateInTimezone } from "@/lib/dates";
import { materializeChores } from "@/lib/recurrence";
import { rotationAssignee, type ChoreGroupRotation } from "@/lib/chore-group-rotation";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireContext(true);
    const { id } = await params;
    const [household] = await db<{ timezone: string }[]>`SELECT timezone FROM households WHERE id = ${context.householdId}`;
    const today = dateInTimezone(new Date(), household.timezone);
    await db.begin(async (tx) => {
      const [rotation] = await tx<ChoreGroupRotation[]>`
        SELECT id, first_group_id, second_group_id, first_member_id, second_member_id, start_date
        FROM chore_group_rotations WHERE id = ${id} AND household_id = ${context.householdId}`;
      if (!rotation) throw new Error("Chore group rotation not found");
      for (const groupId of [rotation.first_group_id, rotation.second_group_id]) {
        const assignee = rotationAssignee(rotation, groupId, today);
        await tx`UPDATE chore_groups SET assigned_member_id = ${assignee}, updated_at = now() WHERE id = ${groupId}`;
        const templates = await tx<{ id: string }[]>`SELECT id FROM chore_templates WHERE household_id = ${context.householdId} AND active AND chore_group_id = ${groupId}`;
        for (const template of templates) {
          await tx`DELETE FROM chore_template_assignees WHERE chore_template_id = ${template.id}`;
          if (assignee) await tx`INSERT INTO chore_template_assignees (chore_template_id, member_id) VALUES (${template.id}, ${assignee})`;
          await tx`DELETE FROM chore_obligations o USING chore_occurrences c WHERE o.occurrence_id = c.id AND c.chore_template_id = ${template.id} AND c.scheduled_for >= ${today} AND o.status = 'open'`;
        }
      }
      await tx`DELETE FROM chore_group_rotations WHERE id = ${id}`;
    });
    await materializeChores();
    return NextResponse.json({ success: true, id });
  } catch (error) { return apiError(error); }
}
