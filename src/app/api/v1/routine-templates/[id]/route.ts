import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { materializeRoutines } from "@/lib/recurrence";
import { dateInTimezone } from "@/lib/dates";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  icon: z.string().trim().max(50).nullable().optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  schedule: z.object({
    kind: z.enum(["once", "daily", "weekdays", "weekly"]),
    startDate: z.string(),
    dueTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    weekdays: z.array(z.number().int().min(0).max(6)).default([])
  }).optional(),
  steps: z.array(z.string().trim().min(1).max(120)).min(1).max(20).optional()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireContext(true);
    const { id } = await params;
    const input = updateSchema.parse(await request.json());

    const [household] = await db<{ timezone: string }[]>`SELECT timezone FROM households WHERE id = ${context.householdId}`;
    const today = dateInTimezone(new Date(), household.timezone);

    await db.begin(async (tx) => {
      const [existing] = await tx<{ id: string }[]>`
        SELECT id FROM routine_templates
        WHERE id = ${id} AND household_id = ${context.householdId} AND active = true`;
      if (!existing) throw new Error("Routine not found");

      if (input.title !== undefined || input.icon !== undefined || input.schedule || input.assigneeIds) {
        const policy = (input.assigneeIds && input.assigneeIds.length > 0) ? "every" : "any";
        await tx`
          UPDATE routine_templates
          SET title = COALESCE(${input.title ?? null}, title),
              icon = ${input.icon === undefined ? db`icon` : input.icon},
              schedule_kind = COALESCE(${input.schedule?.kind ?? null}, schedule_kind),
              start_date = COALESCE(${input.schedule?.startDate ?? null}, start_date),
              due_time = ${input.schedule ? (input.schedule.dueTime ?? null) : db`due_time`},
              weekdays = COALESCE(${input.schedule?.weekdays ?? null}, weekdays),
              assignment_policy = ${input.assigneeIds ? policy : db`assignment_policy`}
          WHERE id = ${id}`;
      }

      if (input.assigneeIds !== undefined) {
        await tx`DELETE FROM routine_template_assignees WHERE routine_template_id = ${id}`;
        for (const memberId of input.assigneeIds) {
          await tx`INSERT INTO routine_template_assignees (routine_template_id, member_id) VALUES (${id}, ${memberId})`;
        }
      }

      if (input.steps !== undefined) {
        await tx`DELETE FROM routine_steps WHERE routine_template_id = ${id}`;
        for (const [position, stepTitle] of input.steps.entries()) {
          await tx`INSERT INTO routine_steps (routine_template_id, position, title) VALUES (${id}, ${position + 1}, ${stepTitle})`;
        }
      }

      // Re-align future open runs
      await tx`
        DELETE FROM routine_runs
        WHERE routine_template_id = ${id} AND scheduled_for >= ${today} AND completed_at IS NULL`;
    });

    await materializeRoutines();
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
        SELECT id FROM routine_templates
        WHERE id = ${id} AND household_id = ${context.householdId}`;
      if (!existing) throw new Error("Routine not found");

      await tx`
        DELETE FROM routine_runs
        WHERE routine_template_id = ${id} AND scheduled_for >= ${today} AND completed_at IS NULL`;

      try {
        await tx`DELETE FROM routine_templates WHERE id = ${id}`;
      } catch {
        await tx`UPDATE routine_templates SET active = false WHERE id = ${id}`;
      }
    });

    return NextResponse.json({ success: true, id });
  } catch (error) { return apiError(error); }
}
