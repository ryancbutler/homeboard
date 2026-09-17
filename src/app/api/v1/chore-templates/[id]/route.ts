import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { materializeChores } from "@/lib/recurrence";
import { resolveChoreAssignees } from "@/lib/chore-assignment";
import { scheduleSchema } from "@/lib/schedule-validation";
import { dateInTimezone } from "@/lib/dates";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  instructions: z.string().trim().max(500).optional().nullable(),
  icon: z.string().trim().max(50).optional().nullable(),
  assignmentPolicy: z.enum(["individual", "any", "every"]).optional(),
  approvalRequired: z.boolean().optional(),
  isFlexible: z.boolean().optional(),
  schedule: scheduleSchema.optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  groupId: z.string().uuid().optional().nullable()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireContext(true);
    const { id } = await params;
    const input = updateSchema.parse(await request.json());

    const [household] = await db<{ timezone: string }[]>`SELECT timezone FROM households WHERE id = ${context.householdId}`;
    const today = dateInTimezone(new Date(), household.timezone);

    await db.begin(async (tx) => {
      const [existing] = await tx<{
        id: string;
        assignment_policy: "individual" | "any" | "every";
        chore_group_id: string | null;
      }[]>`
        SELECT id, assignment_policy, chore_group_id
        FROM chore_templates
        WHERE id = ${id} AND household_id = ${context.householdId} AND active = true`;
      if (!existing) throw new Error("Chore not found");

      const groupId = input.groupId !== undefined ? input.groupId : existing.chore_group_id;
      let groupAssigneeId: string | null | undefined = undefined;
      if (groupId) {
        const [group] = await tx<{ assigned_member_id: string | null }[]>`
          SELECT assigned_member_id FROM chore_groups WHERE id = ${groupId} AND household_id = ${context.householdId}`;
        if (!group) throw new Error("Chore group not found");
        groupAssigneeId = group.assigned_member_id;
      }

      let policy = input.assignmentPolicy ?? existing.assignment_policy;
      if (!groupId && input.assigneeIds !== undefined) {
        if (input.assigneeIds.length > 1 && !input.assignmentPolicy) {
          policy = "every";
        } else if (input.assigneeIds.length === 1 && !input.assignmentPolicy) {
          policy = "individual";
        } else if (input.assigneeIds.length === 0 && !input.assignmentPolicy) {
          policy = "any";
        }
      }

      const updates: {
        title?: string;
        instructions?: string | null;
        icon?: string | null;
        assignment_policy?: "individual" | "any" | "every";
        approval_required?: boolean;
        is_flexible?: boolean;
        schedule_kind?: string;
        start_date?: string;
        due_time?: string | null;
        weekdays?: number[];
        chore_group_id?: string | null;
        updated_at: Date;
      } = { updated_at: new Date() };

      if (input.title !== undefined) updates.title = input.title;
      if (input.instructions !== undefined) updates.instructions = input.instructions ?? null;
      if (input.icon !== undefined) updates.icon = input.icon ?? null;
      if (policy !== undefined) updates.assignment_policy = policy;
      if (input.approvalRequired !== undefined) updates.approval_required = input.approvalRequired;
      if (input.isFlexible !== undefined) updates.is_flexible = input.isFlexible;
      if (input.groupId !== undefined) updates.chore_group_id = input.groupId ?? null;
      if (input.schedule !== undefined) {
        updates.schedule_kind = input.schedule.kind;
        updates.start_date = input.schedule.startDate;
        updates.due_time = input.schedule.dueTime ?? null;
        updates.weekdays = input.schedule.weekdays;
      }

      await tx`
        UPDATE chore_templates
        SET ${db(updates)}
        WHERE id = ${id}`;

      if (input.assigneeIds !== undefined || groupId !== undefined) {
        const rawAssigneeIds = input.assigneeIds ?? [];
        const assigneeIds = resolveChoreAssignees(policy, rawAssigneeIds, groupAssigneeId);

        if (assigneeIds.length > 0) {
          const valid = await tx<{ count: string }[]>`
            SELECT count(*) FROM members
            WHERE household_id = ${context.householdId} AND role = 'child' AND active AND id = ANY(${assigneeIds})`;
          if (Number(valid[0].count) !== assigneeIds.length) throw new Error("Assignees must be active children in this household");
        }

        await tx`DELETE FROM chore_template_assignees WHERE chore_template_id = ${id}`;
        for (const memberId of assigneeIds) {
          await tx`INSERT INTO chore_template_assignees (chore_template_id, member_id) VALUES (${id}, ${memberId})`;
        }
      }

      // Re-align open obligations from today onward
      await tx`
        DELETE FROM chore_obligations o USING chore_occurrences c
        WHERE o.occurrence_id = c.id AND c.chore_template_id = ${id}
          AND c.scheduled_for >= ${today} AND o.status = 'open'`;
    });

    await materializeChores();
    return NextResponse.json({ success: true, id });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireContext(true);
    const { id } = await params;

    const [household] = await db<{ timezone: string }[]>`SELECT timezone FROM households WHERE id = ${context.householdId}`;
    const today = dateInTimezone(new Date(), household.timezone);

    await db.begin(async (tx) => {
      const [existing] = await tx<{ id: string }[]>`
        SELECT id FROM chore_templates
        WHERE id = ${id} AND household_id = ${context.householdId}`;
      if (!existing) throw new Error("Chore not found");

      // Delete future and open obligations
      await tx`
        DELETE FROM chore_obligations o USING chore_occurrences c
        WHERE o.occurrence_id = c.id AND c.chore_template_id = ${id}
          AND (c.scheduled_for >= ${today} OR o.status = 'open')`;

      await tx`
        DELETE FROM chore_occurrences
        WHERE chore_template_id = ${id} AND scheduled_for >= ${today}`;

      try {
        await tx`DELETE FROM chore_templates WHERE id = ${id}`;
      } catch {
        await tx`UPDATE chore_templates SET active = false WHERE id = ${id}`;
      }
    });

    return NextResponse.json({ success: true, id });
  } catch (error) { return apiError(error); }
}
