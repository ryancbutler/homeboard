import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { materializeRoutines } from "@/lib/recurrence";
import { scheduleSchema } from "@/lib/schedule-validation";
import { dayPartSchema, nextDisplayOrder } from "@/lib/day-order";
import { databaseIdSchema } from "@/lib/id-validation";

const routineStepSchema = z.union([
  z
    .string()
    .trim()
    .min(1)
    .max(120)
    .transform((title) => ({ title, icon: null })),
  z.object({ title: z.string().trim().min(1).max(120), icon: z.string().trim().max(50).nullable().optional() }),
]);

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  icon: z.string().trim().max(50).nullable().optional(),
  dayPart: dayPartSchema,
  assigneeIds: z.array(databaseIdSchema).default([]),
  schedule: scheduleSchema,
  steps: z.array(routineStepSchema).min(1).max(20),
});

export async function GET() {
  try {
    const context = await requireContext(true);
    const templates = await db<
      {
        id: string;
        title: string;
        icon: string | null;
        assignment_policy: string;
        schedule_kind: string;
        start_date: string;
        due_time: string | null;
        weekdays: number[];
        active: boolean;
        day_part: "morning" | "afternoon" | "evening" | null;
        display_order: number | null;
      }[]
    >`
      SELECT id, title, icon, assignment_policy, schedule_kind, start_date, due_time, day_part, display_order,
             COALESCE(weekdays, '{}') AS weekdays, active
      FROM routine_templates
      WHERE household_id = ${context.householdId} AND active = true
      ORDER BY created_at DESC`;

    const templateIds = templates.map((t) => t.id);

    const [allSteps, allAssignees] = await Promise.all([
      templateIds.length
        ? db<{ routine_template_id: string; id: string; position: number; title: string; icon: string | null }[]>`
            SELECT routine_template_id, id, position, title, icon
            FROM routine_steps
            WHERE routine_template_id = ANY(${templateIds})
            ORDER BY position`
        : [],
      templateIds.length
        ? db<{ routine_template_id: string; member_id: string; display_name: string }[]>`
            SELECT rta.routine_template_id, rta.member_id, m.display_name
            FROM routine_template_assignees rta
            JOIN members m ON m.id = rta.member_id
            WHERE rta.routine_template_id = ANY(${templateIds})`
        : [],
    ]);

    const stepsMap = new Map<string, { id: string; position: number; title: string; icon: string | null }[]>();
    for (const step of allSteps) {
      const list = stepsMap.get(step.routine_template_id) ?? [];
      list.push({ id: step.id, position: step.position, title: step.title, icon: step.icon });
      stepsMap.set(step.routine_template_id, list);
    }

    const assigneesMap = new Map<string, { id: string; name: string }[]>();
    for (const a of allAssignees) {
      const list = assigneesMap.get(a.routine_template_id) ?? [];
      list.push({ id: a.member_id, name: a.display_name });
      assigneesMap.set(a.routine_template_id, list);
    }

    return NextResponse.json(
      templates.map((t) => ({
        id: t.id,
        title: t.title,
        icon: t.icon,
        assignmentPolicy: t.assignment_policy,
        scheduleKind: t.schedule_kind,
        startDate: t.start_date,
        dueTime: t.due_time,
        dayPart: t.day_part,
        displayOrder: t.display_order,
        weekdays: t.weekdays,
        steps: stepsMap.get(t.id) ?? [],
        assignees: assigneesMap.get(t.id) ?? [],
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

    // Whole routines assigned to children: "every" policy ensures each child receives their own daily routine
    const policy = input.assigneeIds.length > 0 ? "every" : "any";

    const template = await db.begin(async (tx) => {
      const order = await nextDisplayOrder(tx, context.householdId, input.dayPart);
      const [created] = await tx<{ id: string }[]>`
        INSERT INTO routine_templates (household_id, title, icon, assignment_policy, schedule_kind, start_date, due_time, weekdays, day_part, display_order)
        VALUES (${context.householdId}, ${input.title}, ${input.icon ?? null}, ${policy}, ${input.schedule.kind}, ${input.schedule.startDate}, ${input.schedule.dueTime ?? null}, ${input.schedule.weekdays}, ${input.dayPart}, ${order})
        RETURNING id`;
      for (const memberId of input.assigneeIds) {
        await tx`INSERT INTO routine_template_assignees (routine_template_id, member_id) VALUES (${created.id}, ${memberId})`;
      }
      for (const [position, step] of input.steps.entries()) {
        await tx`INSERT INTO routine_steps (routine_template_id, position, title, icon) VALUES (${created.id}, ${position + 1}, ${step.title}, ${step.icon ?? null})`;
      }
      return created;
    });

    await materializeRoutines();
    return NextResponse.json({ id: template.id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
