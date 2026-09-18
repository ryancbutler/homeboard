import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { dateInTimezone, mondayOfWeek } from "@/lib/dates";
import { materializeChores } from "@/lib/recurrence";
import { rotationAssignee, type ChoreGroupRotation } from "@/lib/chore-group-rotation";

const schema = z.object({
  firstGroupId: z.string().uuid(),
  secondGroupId: z.string().uuid(),
  firstMemberId: z.string().uuid(),
  secondMemberId: z.string().uuid(),
  startDate: z.string().date()
}).superRefine((value, context) => {
  if (value.firstGroupId === value.secondGroupId) context.addIssue({ code: z.ZodIssueCode.custom, path: ["secondGroupId"], message: "Choose two different chore groups" });
  if (value.firstMemberId === value.secondMemberId) context.addIssue({ code: z.ZodIssueCode.custom, path: ["secondMemberId"], message: "Choose two different children" });
  if (mondayOfWeek(value.startDate) !== value.startDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ["startDate"], message: "Rotations must start on a Monday" });
});

type RotationRow = ChoreGroupRotation & {
  first_group_name: string; second_group_name: string;
  first_member_name: string; second_member_name: string;
};

export async function GET() {
  try {
    const context = await requireContext(true);
    const [household] = await db<{ timezone: string }[]>`SELECT timezone FROM households WHERE id = ${context.householdId}`;
    const today = dateInTimezone(new Date(), household.timezone);
    const rotations = await db<RotationRow[]>`
      SELECT r.*, first_group.name AS first_group_name, second_group.name AS second_group_name,
             first_member.display_name AS first_member_name, second_member.display_name AS second_member_name
      FROM chore_group_rotations r
      JOIN chore_groups first_group ON first_group.id = r.first_group_id
      JOIN chore_groups second_group ON second_group.id = r.second_group_id
      JOIN members first_member ON first_member.id = r.first_member_id
      JOIN members second_member ON second_member.id = r.second_member_id
      WHERE r.household_id = ${context.householdId}
      ORDER BY r.created_at`;
    return NextResponse.json(rotations.map((rotation) => ({
      id: rotation.id, startDate: rotation.start_date,
      firstGroup: { id: rotation.first_group_id, name: rotation.first_group_name },
      secondGroup: { id: rotation.second_group_id, name: rotation.second_group_name },
      firstMember: { id: rotation.first_member_id, name: rotation.first_member_name },
      secondMember: { id: rotation.second_member_id, name: rotation.second_member_name },
      current: {
        firstGroupMemberId: rotationAssignee(rotation, rotation.first_group_id, today),
        secondGroupMemberId: rotationAssignee(rotation, rotation.second_group_id, today),
      },
      next: {
        firstGroupMemberId: rotationAssignee(rotation, rotation.first_group_id, mondayOfWeek(addDays(today, 7))),
        secondGroupMemberId: rotationAssignee(rotation, rotation.second_group_id, mondayOfWeek(addDays(today, 7))),
      }
    })));
  } catch (error) { return apiError(error); }
}

function addDays(day: string, days: number) {
  const value = new Date(`${day}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  try {
    const context = await requireContext(true);
    const input = schema.parse(await request.json());
    const [household] = await db<{ timezone: string }[]>`SELECT timezone FROM households WHERE id = ${context.householdId}`;
    const today = dateInTimezone(new Date(), household.timezone);
    const rotation = await db.begin(async (tx) => {
      const groups = await tx<{ id: string }[]>`SELECT id FROM chore_groups WHERE household_id = ${context.householdId} AND id = ANY(${[input.firstGroupId, input.secondGroupId]})`;
      if (groups.length !== 2) throw new Error("Both chore groups must belong to this household");
      const [existingRotation] = await tx<{ id: string }[]>`
        SELECT id FROM chore_group_rotations
        WHERE household_id = ${context.householdId}
          AND (first_group_id IN (${input.firstGroupId}, ${input.secondGroupId}) OR second_group_id IN (${input.firstGroupId}, ${input.secondGroupId}))`;
      if (existingRotation) throw new Error("A selected chore group is already in a weekly rotation");
      const children = await tx<{ id: string }[]>`SELECT id FROM members WHERE household_id = ${context.householdId} AND role = 'child' AND active AND id = ANY(${[input.firstMemberId, input.secondMemberId]})`;
      if (children.length !== 2) throw new Error("Both rotation assignees must be active children in this household");
      const [created] = await tx<ChoreGroupRotation[]>`
        INSERT INTO chore_group_rotations (household_id, first_group_id, second_group_id, first_member_id, second_member_id, start_date)
        VALUES (${context.householdId}, ${input.firstGroupId}, ${input.secondGroupId}, ${input.firstMemberId}, ${input.secondMemberId}, ${input.startDate})
        RETURNING id, first_group_id, second_group_id, first_member_id, second_member_id, start_date`;
      const templateIds = await tx<{ id: string }[]>`SELECT id FROM chore_templates WHERE household_id = ${context.householdId} AND active AND chore_group_id = ANY(${[input.firstGroupId, input.secondGroupId]})`;
      for (const template of templateIds) await tx`
        DELETE FROM chore_obligations o USING chore_occurrences c
        WHERE o.occurrence_id = c.id AND c.chore_template_id = ${template.id}
          AND c.scheduled_for >= ${input.startDate} AND o.status = 'open'`;
      return created;
    });
    await materializeChores();
    return NextResponse.json({ id: rotation.id }, { status: 201 });
  } catch (error) { return apiError(error); }
}
