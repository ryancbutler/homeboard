import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  assignedMemberId: z.string().uuid().nullable().optional()
});

async function requireActiveChild(householdId: string, memberId: string) {
  const [child] = await db<{ id: string }[]>`
    SELECT id FROM members WHERE id = ${memberId} AND household_id = ${householdId} AND role = 'child' AND active`;
  if (!child) throw new Error("Group assignee must be an active child in this household");
}

export async function GET() {
  try {
    const context = await requireContext(true);
    const groups = await db<{ id: string; name: string; assigned_member_id: string | null; assigned_member_name: string | null; template_count: string }[]>`
      SELECT cg.id, cg.name, cg.assigned_member_id, m.display_name AS assigned_member_name, count(ct.id)::text AS template_count
      FROM chore_groups cg
      LEFT JOIN members m ON m.id = cg.assigned_member_id
      LEFT JOIN chore_templates ct ON ct.chore_group_id = cg.id AND ct.active
      WHERE cg.household_id = ${context.householdId}
      GROUP BY cg.id, m.display_name
      ORDER BY cg.name`;
    return NextResponse.json(groups.map((group) => ({
      id: group.id,
      name: group.name,
      assignedMemberId: group.assigned_member_id,
      assignedMemberName: group.assigned_member_name ?? "Unassigned",
      templateCount: Number(group.template_count)
    })));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const context = await requireContext(true);
    const input = createSchema.parse(await request.json());
    if (input.assignedMemberId) {
      await requireActiveChild(context.householdId, input.assignedMemberId);
    }
    const [group] = await db<{ id: string }[]>`
      INSERT INTO chore_groups (household_id, name, assigned_member_id)
      VALUES (${context.householdId}, ${input.name}, ${input.assignedMemberId ?? null}) RETURNING id`;
    return NextResponse.json({ id: group.id }, { status: 201 });
  } catch (error) { return apiError(error); }
}
