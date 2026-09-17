import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";

const schema = z.object({
  actorId: z.string().uuid().optional(),
  completed: z.boolean()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string; stepId: string }> }) {
  try {
    const context = await requireContext();
    const { actorId, completed } = schema.parse(await request.json());
    const { id, stepId } = await params;

    const runRows = await db<{ run_id: string }[]>`
      SELECT rr.id AS run_id
      FROM routine_runs rr
      JOIN routine_steps rs ON rs.routine_template_id = rr.routine_template_id
      WHERE rr.id = ${id} AND rs.id = ${stepId} AND rr.household_id = ${context.householdId}`;
    if (!runRows[0]) throw new Error("Forbidden");

    if (completed) {
      if (!actorId) throw new Error("Actor ID required to complete step");
      const [actor] = await db<{ id: string }[]>`
        SELECT id FROM members
        WHERE id = ${actorId} AND household_id = ${context.householdId} AND active = true`;
      if (!actor) throw new Error("Forbidden");

      await db`
        INSERT INTO routine_step_completions (routine_run_id, routine_step_id, completed_by)
        VALUES (${id}, ${stepId}, ${actorId})
        ON CONFLICT (routine_run_id, routine_step_id) DO NOTHING`;
    } else {
      await db`
        DELETE FROM routine_step_completions
        WHERE routine_run_id = ${id} AND routine_step_id = ${stepId}`;
    }

    await db`
      UPDATE routine_runs rr SET completed_at = CASE WHEN NOT EXISTS (
        SELECT 1 FROM routine_steps rs WHERE rs.routine_template_id = rr.routine_template_id AND NOT EXISTS (
          SELECT 1 FROM routine_step_completions rsc WHERE rsc.routine_run_id = rr.id AND rsc.routine_step_id = rs.id
        )) THEN now() ELSE NULL END WHERE rr.id = ${id}`;

    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
