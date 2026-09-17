import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { materializeChores } from "@/lib/recurrence";
import { resolveChoreAssignees } from "@/lib/chore-assignment";
import { scheduleSchema } from "@/lib/schedule-validation";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  instructions: z.string().trim().max(500).optional().nullable(),
  icon: z.string().trim().max(50).optional().nullable(),
  assignmentPolicy: z.enum(["individual", "any", "every"]).optional(),
  approvalRequired: z.boolean().default(false),
  isFlexible: z.boolean().default(false),
  schedule: scheduleSchema,
  assigneeIds: z.array(z.string().uuid()).default([]),
  groupId: z.string().uuid().optional().nullable()
});

export async function GET() {
  try {
    const context = await requireContext(true);
    const rows = await db<{
      id: string; title: string; instructions: string | null; icon: string | null; assignment_policy: string;
      approval_required: boolean; is_flexible: boolean; schedule_kind: string; start_date: string; due_time: string | null;
      weekdays: number[]; active: boolean; chore_group_id: string | null;
    }[]>`
      SELECT id, title, instructions, icon, assignment_policy, approval_required, is_flexible, schedule_kind,
             start_date, due_time, COALESCE(weekdays, '{}') AS weekdays, active, chore_group_id
      FROM chore_templates
      WHERE household_id = ${context.householdId} AND active = true
      ORDER BY created_at DESC`;

    const templateIds = rows.map((r) => r.id);
    const assignees = templateIds.length
      ? await db<{ chore_template_id: string; member_id: string }[]>`
          SELECT chore_template_id, member_id
          FROM chore_template_assignees
          WHERE chore_template_id = ANY(${templateIds})`
      : [];

    const assigneeMap = new Map<string, string[]>();
    for (const a of assignees) {
      const list = assigneeMap.get(a.chore_template_id) ?? [];
      list.push(a.member_id);
      assigneeMap.set(a.chore_template_id, list);
    }

    return NextResponse.json(rows.map((row) => ({
      id: row.id,
      title: row.title,
      instructions: row.instructions,
      icon: row.icon,
      assignmentPolicy: row.assignment_policy,
      approvalRequired: row.approval_required,
      isFlexible: row.is_flexible,
      scheduleKind: row.schedule_kind,
      startDate: row.start_date,
      dueTime: row.due_time,
      weekdays: row.weekdays,
      active: row.active,
      groupId: row.chore_group_id,
      assigneeIds: assigneeMap.get(row.id) ?? []
    })));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const context = await requireContext(true);
    const input = schema.parse(await request.json());

    let groupAssigneeId: string | null | undefined = undefined;
    if (input.groupId) {
      const [group] = await db<{ assigned_member_id: string | null }[]>`
        SELECT assigned_member_id FROM chore_groups WHERE id = ${input.groupId} AND household_id = ${context.householdId}`;
      if (!group) throw new Error("Chore group not found");
      groupAssigneeId = group.assigned_member_id;
    }

    // Auto-resolve policy if not explicitly set or mismatched
    let policy = input.assignmentPolicy ?? "individual";
    if (!input.groupId) {
      if (input.assigneeIds.length > 1 && policy === "individual") {
        policy = "every";
      } else if (input.assigneeIds.length === 1) {
        policy = "individual";
      } else if (input.assigneeIds.length === 0) {
        policy = "any";
      }
    } else {
      policy = "individual";
    }

    const assigneeIds = resolveChoreAssignees(policy, input.assigneeIds, groupAssigneeId);

    if (assigneeIds.length > 0) {
      const valid = await db<{ count: string }[]>`
        SELECT count(*) FROM members
        WHERE household_id = ${context.householdId} AND role = 'child' AND active AND id = ANY(${assigneeIds})`;
      if (Number(valid[0].count) !== assigneeIds.length) throw new Error("Assignees must be active children in this household");
    }

    const [template] = await db<{ id: string }[]>`
      INSERT INTO chore_templates (household_id, title, instructions, icon, assignment_policy, approval_required, is_flexible, schedule_kind, start_date, due_time, weekdays, chore_group_id)
      VALUES (${context.householdId}, ${input.title}, ${input.instructions ?? null}, ${input.icon ?? null}, ${policy}, ${input.approvalRequired}, ${input.isFlexible}, ${input.schedule.kind}, ${input.schedule.startDate}, ${input.schedule.dueTime ?? null}, ${input.schedule.weekdays}, ${input.groupId ?? null})
      RETURNING id`;

    for (const memberId of assigneeIds) {
      await db`INSERT INTO chore_template_assignees (chore_template_id, member_id) VALUES (${template.id}, ${memberId})`;
    }

    await materializeChores();
    return NextResponse.json({ id: template.id }, { status: 201 });
  } catch (error) { return apiError(error); }
}
