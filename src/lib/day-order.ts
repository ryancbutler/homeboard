import { z } from "zod";
import type { Db } from "@/lib/db";

export const dayPartSchema = z.enum(["morning", "afternoon", "evening"]);
export type DayPart = z.infer<typeof dayPartSchema>;

export const DAY_PARTS = ["morning", "afternoon", "evening", null] as const;

export type OrderedItem = {
  dayPart: DayPart | null;
  displayOrder: number | null;
  title: string;
  id: string;
};

export function compareDailyItems(a: OrderedItem, b: OrderedItem): number {
  const part = DAY_PARTS.indexOf(a.dayPart) - DAY_PARTS.indexOf(b.dayPart);
  if (part) return part;
  const order = (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER);
  return order || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}

export function validateDailyOrder(expected: Set<string>, received: string[]): void {
  if (
    received.length !== expected.size ||
    new Set(received).size !== received.length ||
    received.some((key) => !expected.has(key))
  ) {
    throw new Error("Daily order is out of date. Refresh the parent portal and try again.");
  }
}

export async function nextDisplayOrder(tx: Db, householdId: string, dayPart: DayPart): Promise<number> {
  // Serialize concurrent placement changes for the household in PostgreSQL.
  await tx`SELECT id FROM households WHERE id = ${householdId} FOR UPDATE`;
  const [row] = await tx<{ last_order: number | null }[]>`
    SELECT MAX(display_order) AS last_order FROM (
      SELECT display_order FROM chore_templates WHERE household_id = ${householdId} AND active = true AND day_part = ${dayPart}
      UNION ALL
      SELECT display_order FROM routine_templates WHERE household_id = ${householdId} AND active = true AND day_part = ${dayPart}
    ) ordered_items`;
  return Number(row.last_order ?? 0) + 1;
}
