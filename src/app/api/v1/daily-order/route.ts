import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { dayPartSchema, validateDailyOrder } from "@/lib/day-order";

const itemSchema = z.object({
  type: z.enum(["chore", "routine"]),
  id: z.string().min(1).max(64),
  dayPart: dayPartSchema.nullable(),
});
const schema = z.object({ items: z.array(itemSchema).max(1000) });

export async function PUT(request: Request) {
  try {
    const context = await requireContext(true);
    const { items } = schema.parse(await request.json());
    await db.begin(async (tx) => {
      await tx`SELECT id FROM households WHERE id = ${context.householdId} FOR UPDATE`;
      const chores = await tx<
        { id: string }[]
      >`SELECT id FROM chore_templates WHERE household_id = ${context.householdId} AND active = true`;
      const routines = await tx<
        { id: string }[]
      >`SELECT id FROM routine_templates WHERE household_id = ${context.householdId} AND active = true`;
      const expected = new Set([
        ...chores.map((item) => `chore:${item.id}`),
        ...routines.map((item) => `routine:${item.id}`),
      ]);
      const received = items.map((item) => `${item.type}:${item.id}`);
      validateDailyOrder(expected, received);
      const positions = new Map<string, number>();
      for (const item of items) {
        const key = item.dayPart ?? "unassigned";
        const position = (positions.get(key) ?? 0) + 1;
        positions.set(key, position);
        if (item.type === "chore") {
          await tx`UPDATE chore_templates SET day_part = ${item.dayPart}, display_order = ${position}, updated_at = now() WHERE id = ${item.id} AND household_id = ${context.householdId}`;
        } else {
          await tx`UPDATE routine_templates SET day_part = ${item.dayPart}, display_order = ${position} WHERE id = ${item.id} AND household_id = ${context.householdId}`;
        }
      }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
