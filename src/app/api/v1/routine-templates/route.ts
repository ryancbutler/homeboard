import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { materializeRoutines } from "@/lib/recurrence";

const schema = z.object({
  title: z.string().trim().min(1).max(120),
  icon: z.string().trim().max(50).nullable().optional(),
  assigneeIds: z.array(z.string().uuid()).default([]),
  schedule: z.object({
    kind: z.enum(["once", "daily", "weekdays", "weekly"]),
    startDate: z.string(),
    dueTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    weekdays: z.array(z.number().int().min(0).max(6)).default([])
  }),
  steps: z.array(z.string().trim().min(1).max(120)).min(1).max(20)
});

export async function GET() {
  try {
    const context = await requireContext(true);
    const templates = await db<{
      id: string;
      title: string;
      icon: string | null;
      assignment_policy: string;
      schedule_kind: string;
      start_date: string;
      due_time: string | null;
      weekdays: number[];
      active: boolean;
    }[]>`
      SELECT id, title, icon, assignment_policy, schedule_kind, start_date, due_time,
             COALESCE(weekdays, '{}') AS weekdays, active
      FROM routine_templates
      WHERE household_id = ${context.householdId} AND active = true
      ORDER BY created_at DESC`;

    const templateIds = templates.map((t) => t.id);

    const [allSteps, allAssignees] = await Promise.all([
      templateIds.length
        ? db<{ routine_template_id: string; id: string; position: number; title: string }[]>`
            SELECT routine_template_id, id, position, title
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
        : []
    ]);

    const stepsMap = new Map<string, { id: string; position: number; title: string }[]>();
    for (const step of allSteps) {
      const list = stepsMap.get(step.routine_template_id) ?? [];
      list.push({ id: step.id, position: step.position, title: step.title });
      stepsMap.set(step.routine_template_id, list);
    }

    const assigneesMap = new Map<string, { id: string; name: string }[]>();
    for (const a of allAssignees) {
      const list = assigneesMap.get(a.routine_template_id) ?? [];
      list.push({ id: a.member_id, name: a.display_name });
      assigneesMap.set(a.routine_template_id, list);
    }

    return NextResponse.json(templates.map((t) => ({
      id: t.id,
      title: t.title,
      icon: t.icon,
      assignmentPolicy: t.assignment_policy,
      scheduleKind: t.schedule_kind,
      startDate: t.start_date,
      dueTime: t.due_time,
      weekdays: t.weekdays,
      steps: stepsMap.get(t.id) ?? [],
      assignees: assigneesMap.get(t.id) ?? []
    })));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const context = await requireContext(true);
    const input = schema.parse(await request.json());

    // Whole routines assigned to children: "every" policy ensures each child receives their own daily routine
    const policy = input.assigneeIds.length > 0 ? "every" : "any";

    const [template] = await db<{ id: string }[]>`
      INSERT INTO routine_templates (household_id, title, icon, assignment_policy, schedule_kind, start_date, due_time, weekdays)
      VALUES (${context.householdId}, ${input.title}, ${input.icon ?? null}, ${policy}, ${input.schedule.kind}, ${input.schedule.startDate}, ${input.schedule.dueTime ?? null}, ${input.schedule.weekdays})
      RETURNING id`;

    for (const memberId of input.assigneeIds) {
      await db`INSERT INTO routine_template_assignees (routine_template_id, member_id) VALUES (${template.id}, ${memberId})`;
    }

    for (const [position, stepTitle] of input.steps.entries()) {
      await db`INSERT INTO routine_steps (routine_template_id, position, title) VALUES (${template.id}, ${position + 1}, ${stepTitle})`;
    }

    await materializeRoutines();
    return NextResponse.json({ id: template.id }, { status: 201 });
  } catch (error) { return apiError(error); }
}
