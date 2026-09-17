import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { materializeChores } from "@/lib/recurrence";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireContext(true);
    const { id } = await params;

    const [member] = await db<{ id: string; role: string; display_name: string }[]>`
      SELECT id, role, display_name FROM members
      WHERE id = ${id} AND household_id = ${context.householdId}`;

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (member.role !== "child") {
      return NextResponse.json({ error: "Cannot delete parent profile" }, { status: 400 });
    }

    await db.begin(async (tx) => {
      // 1. Unassign from chore groups
      await tx`
        UPDATE chore_groups SET assigned_member_id = NULL
        WHERE assigned_member_id = ${id} AND household_id = ${context.householdId}`;

      // 2. Remove from template assignees
      await tx`DELETE FROM chore_template_assignees WHERE member_id = ${id}`;
      await tx`DELETE FROM routine_template_assignees WHERE member_id = ${id}`;

      // 3. Delete open obligations and uncompleted routine runs
      await tx`DELETE FROM chore_obligations WHERE member_id = ${id} AND status = 'open'`;
      await tx`DELETE FROM routine_runs WHERE member_id = ${id} AND completed_at IS NULL`;

      // 4. Delete member, or deactivate if foreign keys exist
      try {
        await tx`DELETE FROM members WHERE id = ${id} AND household_id = ${context.householdId}`;
      } catch {
        await tx`UPDATE members SET active = false WHERE id = ${id} AND household_id = ${context.householdId}`;
      }

      await tx`
        INSERT INTO audit_events (household_id, actor_id, action, entity_type, entity_id, detail)
        VALUES (${context.householdId}, ${context.memberId ?? null}, 'child.deleted', 'member', ${id}, ${JSON.stringify({ name: member.display_name })})`;
    });

    await materializeChores();

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiError(error);
  }
}
