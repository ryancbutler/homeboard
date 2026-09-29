import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { materializeChores } from "@/lib/recurrence";
import { normalizeChoreAssignmentPolicy, resolveChoreAssignees } from "@/lib/chore-assignment";
import { scheduleSchema } from "@/lib/schedule-validation";
import { dayPartSchema, nextDisplayOrder } from "@/lib/day-order";
import { dateInTimezone } from "@/lib/dates";
import { databaseIdSchema } from "@/lib/id-validation";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  instructions: z.string().trim().max(500).optional().nullable(),
  icon: z.string().trim().max(50).optional().nullable(),
  assignmentPolicy: z.enum(["individual", "any", "every"]).optional(),
  approvalRequired: z.boolean().default(false),
  isFlexible: z.boolean().default(false),
  dayPart: dayPartSchema,
  schedule: scheduleSchema,
  assigneeIds: z.array(databaseIdSchema).default([]),
  groupId: databaseIdSchema.optional().nullable(),
});

export async function GET() {
  try {
    const context = await requireContext(true);
    const [household] = await db<
      { timezone: string }[]
    >`SELECT timezone FROM households WHERE id = ${context.householdId}`;
    const today = dateInTimezone(new Date(), household.timezone);
    const rows = await db<
      {
        id: string;
        title: string;
        instructions: string | null;
        icon: string | null;
        assignment_policy: string;
        approval_required: boolean;
        is_flexible: boolean;
        schedule_kind: string;
        start_date: string;
        due_time: string | null;
        weekdays: number[];
        active: boolean;
        chore_group_id: string | null;
        next_scheduled_for: string | null;
        day_part: "morning" | "afternoon" | "evening" | null;
        display_order: number | null;
      }[]
    >`
      SELECT ct.id, title, instructions, icon, assignment_policy, approval_required, is_flexible, schedule_kind,
             start_date, due_time, COALESCE(weekdays, '{}') AS weekdays, active, chore_group_id, ct.day_part, ct.display_order,
             (SELECT MIN(co.scheduled_for) FROM chore_occurrences co
              WHERE co.chore_template_id = ct.id AND co.scheduled_for >= ${today}) AS next_scheduled_for
      FROM chore_templates ct
      WHERE household_id = ${context.householdId} AND active = true
      ORDER BY ct.created_at DESC`;

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

    return NextResponse.json(
      rows.map((row) => ({
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
        nextScheduledFor: row.next_scheduled_for,
        weekdays: row.weekdays,
        active: row.active,
        groupId: row.chore_group_id,
        dayPart: row.day_part,
        displayOrder: row.display_order,
        assigneeIds: assigneeMap.get(row.id) ?? [],
      }))
    );
  } catch (error) {
    return apiError(error);
  }
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

    const policy = normalizeChoreAssignmentPolicy(
      input.assignmentPolicy ?? "individual",
      input.assigneeIds,
      Boolean(input.groupId)
    );

    const assigneeIds = resolveChoreAssignees(policy, input.assigneeIds, groupAssigneeId);

    if (assigneeIds.length > 0) {
      const valid = await db<{ count: string }[]>`
        SELECT count(*) FROM members
        WHERE household_id = ${context.householdId} AND role = 'child' AND active AND id = ANY(${assigneeIds})`;
      if (Number(valid[0].count) !== assigneeIds.length)
        throw new Error("Assignees must be active children in this household");
    }

    const template = await db.begin(async (tx) => {
      const order = await nextDisplayOrder(tx, context.householdId, input.dayPart);
      const [created] = await tx<{ id: string }[]>`
        INSERT INTO chore_templates (household_id, title, instructions, icon, assignment_policy, approval_required, is_flexible, schedule_kind, start_date, due_time, weekdays, chore_group_id, day_part, display_order)
        VALUES (${context.householdId}, ${input.title}, ${input.instructions ?? null}, ${input.icon ?? null}, ${policy}, ${input.approvalRequired}, ${input.isFlexible}, ${input.schedule.kind}, ${input.schedule.startDate}, ${input.schedule.dueTime ?? null}, ${input.schedule.weekdays}, ${input.groupId ?? null}, ${input.dayPart}, ${order})
        RETURNING id`;
      for (const memberId of assigneeIds) {
        await tx`INSERT INTO chore_template_assignees (chore_template_id, member_id) VALUES (${created.id}, ${memberId})`;
      }
      return created;
    });

    await materializeChores();
    return NextResponse.json({ id: template.id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
