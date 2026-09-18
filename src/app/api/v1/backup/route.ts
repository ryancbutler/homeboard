import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireContext } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { dateInTimezone } from "@/lib/dates";
import { resolveChoreAssignees } from "@/lib/chore-assignment";
import { materializeChores, materializeRoutines } from "@/lib/recurrence";

export const dynamic = "force-dynamic";

const importSchema = z.object({
  version: z.number().optional(),
  children: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    color: z.string().trim().optional()
  })).default([]),
  groups: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    assignedChild: z.string().nullable().optional()
  })).default([]),
  chores: z.array(z.object({
    title: z.string().trim().min(1).max(120),
    instructions: z.string().nullable().optional(),
    icon: z.string().trim().max(50).nullable().optional(),
    assignmentPolicy: z.enum(["individual", "any", "every"]).optional(),
    approvalRequired: z.boolean().default(false),
    isFlexible: z.boolean().default(false),
    scheduleKind: z.enum(["once", "daily", "weekdays", "weekly"]).default("daily"),
    dueTime: z.string().nullable().optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).default([]),
    groupName: z.string().nullable().optional(),
    assignedChildren: z.array(z.string()).default([])
  })).default([]),
  routines: z.array(z.object({
    title: z.string().trim().min(1).max(120),
    icon: z.string().trim().max(50).nullable().optional(),
    scheduleKind: z.enum(["once", "daily", "weekdays", "weekly"]).default("daily"),
    dueTime: z.string().nullable().optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).default([]),
    steps: z.array(z.string().trim().min(1)).default([]),
    assignedChildren: z.array(z.string()).default([])
  })).default([])
});

export async function GET() {
  try {
    const context = await requireContext(true);

    const [members, groups, choreTemplates, routineTemplates] = await Promise.all([
      db<{ id: string; display_name: string; color: string }[]>`
        SELECT id, display_name, color FROM members
        WHERE household_id = ${context.householdId} AND role = 'child' AND active = true
        ORDER BY display_name`,
      db<{ id: string; name: string; assigned_member_id: string | null }[]>`
        SELECT id, name, assigned_member_id FROM chore_groups
        WHERE household_id = ${context.householdId}`,
      db<{
        id: string; title: string; instructions: string | null; icon: string | null; assignment_policy: string;
        approval_required: boolean; is_flexible: boolean; schedule_kind: string; due_time: string | null;
        weekdays: number[]; chore_group_id: string | null;
      }[]>`
        SELECT ct.id, ct.title, ct.instructions, ct.icon, ct.assignment_policy, ct.approval_required, ct.is_flexible,
               ct.schedule_kind, ct.due_time, COALESCE(ct.weekdays, '{}') AS weekdays, ct.chore_group_id
        FROM chore_templates ct
        WHERE ct.household_id = ${context.householdId} AND ct.active = true
        ORDER BY ct.created_at`,
      db<{
        id: string; title: string; icon: string | null; schedule_kind: string; due_time: string | null; weekdays: number[];
      }[]>`
        SELECT rt.id, rt.title, rt.icon, rt.schedule_kind, rt.due_time, COALESCE(rt.weekdays, '{}') AS weekdays
        FROM routine_templates rt
        WHERE rt.household_id = ${context.householdId} AND rt.active = true
        ORDER BY rt.created_at`
    ]);

    const memberMap = new Map(members.map((m) => [m.id, m.display_name]));
    const groupMap = new Map(groups.map((g) => [g.id, g.name]));

    const choreIds = choreTemplates.map((c) => c.id);
    const routineIds = routineTemplates.map((r) => r.id);

    const [choreAssignees, routineSteps, routineAssignees] = await Promise.all([
      choreIds.length
        ? db<{ chore_template_id: string; member_id: string }[]>`
            SELECT chore_template_id, member_id FROM chore_template_assignees
            WHERE chore_template_id = ANY(${choreIds})`
        : [],
      routineIds.length
        ? db<{ routine_template_id: string; position: number; title: string }[]>`
            SELECT routine_template_id, position, title FROM routine_steps
            WHERE routine_template_id = ANY(${routineIds}) ORDER BY position`
        : [],
      routineIds.length
        ? db<{ routine_template_id: string; member_id: string }[]>`
            SELECT routine_template_id, member_id FROM routine_template_assignees
            WHERE routine_template_id = ANY(${routineIds})`
        : []
    ]);

    const choreAssigneesMap = new Map<string, string[]>();
    for (const ca of choreAssignees) {
      const name = memberMap.get(ca.member_id);
      if (name) {
        const list = choreAssigneesMap.get(ca.chore_template_id) ?? [];
        list.push(name);
        choreAssigneesMap.set(ca.chore_template_id, list);
      }
    }

    const routineStepsMap = new Map<string, string[]>();
    for (const rs of routineSteps) {
      const list = routineStepsMap.get(rs.routine_template_id) ?? [];
      list.push(rs.title);
      routineStepsMap.set(rs.routine_template_id, list);
    }

    const routineAssigneesMap = new Map<string, string[]>();
    for (const ra of routineAssignees) {
      const name = memberMap.get(ra.member_id);
      if (name) {
        const list = routineAssigneesMap.get(ra.routine_template_id) ?? [];
        list.push(name);
        routineAssigneesMap.set(ra.routine_template_id, list);
      }
    }

    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      children: members.map((m) => ({
        name: m.display_name,
        color: m.color
      })),
      groups: groups.map((g) => ({
        name: g.name,
        assignedChild: g.assigned_member_id ? memberMap.get(g.assigned_member_id) ?? null : null
      })),
      chores: choreTemplates.map((c) => ({
        title: c.title,
        instructions: c.instructions,
        icon: c.icon,
        assignmentPolicy: c.assignment_policy,
        approvalRequired: c.approval_required,
        isFlexible: c.is_flexible,
        scheduleKind: c.schedule_kind,
        dueTime: c.due_time,
        weekdays: c.weekdays,
        groupName: c.chore_group_id ? groupMap.get(c.chore_group_id) ?? null : null,
        assignedChildren: choreAssigneesMap.get(c.id) ?? []
      })),
      routines: routineTemplates.map((r) => ({
        title: r.title,
        icon: r.icon,
        scheduleKind: r.schedule_kind,
        dueTime: r.due_time,
        weekdays: r.weekdays,
        steps: routineStepsMap.get(r.id) ?? [],
        assignedChildren: routineAssigneesMap.get(r.id) ?? []
      }))
    };

    return NextResponse.json(backup, {
      headers: {
        "Content-Disposition": `attachment; filename="homeboard-setup-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const context = await requireContext(true);
    const body = await request.json();
    const data = importSchema.parse(body);

    const [household] = await db<{ timezone: string }[]>`SELECT timezone FROM households WHERE id = ${context.householdId}`;
    const today = dateInTimezone(new Date(), household.timezone);

    const existingMembers = await db<{ id: string; display_name: string }[]>`
      SELECT id, display_name FROM members WHERE household_id = ${context.householdId} AND role = 'child' AND active = true`;

    const memberLookup = new Map(existingMembers.map((m) => [m.display_name.trim().toLowerCase(), m.id]));

    let importedChildren = 0;
    let importedGroups = 0;
    let importedChores = 0;
    let importedRoutines = 0;

    await db.begin(async (tx) => {
      // 0. Process children first so they are available for groups, chores, and routines
      for (const childInput of data.children) {
        const key = childInput.name.trim().toLowerCase();
        const existingId = memberLookup.get(key);
        if (!existingId) {
          const color = childInput.color && /^#[0-9a-fA-F]{6}$/.test(childInput.color) ? childInput.color : "#8B71CB";
          const [inserted] = await tx<{ id: string }[]>`
            INSERT INTO members (household_id, role, display_name, color, active)
            VALUES (${context.householdId}, 'child', ${childInput.name.trim()}, ${color}, true)
            RETURNING id`;
          memberLookup.set(key, inserted.id);
          importedChildren++;
        }
      }

      // 1. Process groups
      const groupLookup = new Map<string, string>();
      for (const groupInput of data.groups) {
        const assignedId = groupInput.assignedChild
          ? memberLookup.get(groupInput.assignedChild.trim().toLowerCase()) ?? null
          : null;

        const [existing] = await tx<{ id: string }[]>`
          SELECT id FROM chore_groups WHERE household_id = ${context.householdId} AND LOWER(name) = LOWER(${groupInput.name.trim()})`;

        if (existing) {
          groupLookup.set(groupInput.name.trim().toLowerCase(), existing.id);
          if (assignedId) {
            await tx`UPDATE chore_groups SET assigned_member_id = ${assignedId} WHERE id = ${existing.id}`;
          }
        } else {
          const [inserted] = await tx<{ id: string }[]>`
            INSERT INTO chore_groups (household_id, name, assigned_member_id)
            VALUES (${context.householdId}, ${groupInput.name.trim()}, ${assignedId})
            RETURNING id`;
          groupLookup.set(groupInput.name.trim().toLowerCase(), inserted.id);
          importedGroups++;
        }
      }

      // 2. Process chores
      for (const choreInput of data.chores) {
        const groupId = choreInput.groupName
          ? groupLookup.get(choreInput.groupName.trim().toLowerCase()) ?? null
          : null;

        const assigneeIds: string[] = [];
        for (const childName of choreInput.assignedChildren) {
          const id = memberLookup.get(childName.trim().toLowerCase());
          if (id && !assigneeIds.includes(id)) assigneeIds.push(id);
        }

        let groupAssigneeId: string | null | undefined = undefined;
        if (groupId) {
          const [group] = await tx<{ assigned_member_id: string | null }[]>`
            SELECT assigned_member_id FROM chore_groups WHERE id = ${groupId}`;
          groupAssigneeId = group?.assigned_member_id ?? null;
        }

        let policy = choreInput.assignmentPolicy ?? (assigneeIds.length > 1 ? "every" : assigneeIds.length === 1 ? "individual" : "any");
        if (groupId) policy = "individual";

        const finalAssignees = resolveChoreAssignees(policy, assigneeIds, groupAssigneeId);

        const [choreTemplate] = await tx<{ id: string }[]>`
          INSERT INTO chore_templates (
            household_id, title, instructions, icon, assignment_policy, approval_required, is_flexible,
            schedule_kind, start_date, due_time, weekdays, chore_group_id
          ) VALUES (
            ${context.householdId}, ${choreInput.title}, ${choreInput.instructions ?? null}, ${choreInput.icon ?? null},
            ${policy}, ${choreInput.approvalRequired}, ${choreInput.isFlexible},
            ${choreInput.scheduleKind}, ${today}, ${choreInput.dueTime ?? null},
            ${choreInput.weekdays}, ${groupId}
          ) RETURNING id`;

        for (const mId of finalAssignees) {
          await tx`INSERT INTO chore_template_assignees (chore_template_id, member_id) VALUES (${choreTemplate.id}, ${mId})`;
        }
        importedChores++;
      }

      // 3. Process routines
      for (const routineInput of data.routines) {
        const assigneeIds: string[] = [];
        for (const childName of routineInput.assignedChildren) {
          const id = memberLookup.get(childName.trim().toLowerCase());
          if (id && !assigneeIds.includes(id)) assigneeIds.push(id);
        }

        const policy = assigneeIds.length > 0 ? "every" : "any";

        const [routineTemplate] = await tx<{ id: string }[]>`
          INSERT INTO routine_templates (household_id, title, icon, assignment_policy, schedule_kind, start_date, due_time, weekdays)
          VALUES (${context.householdId}, ${routineInput.title}, ${routineInput.icon ?? null}, ${policy}, ${routineInput.scheduleKind}, ${today}, ${routineInput.dueTime ?? null}, ${routineInput.weekdays})
          RETURNING id`;

        for (const mId of assigneeIds) {
          await tx`INSERT INTO routine_template_assignees (routine_template_id, member_id) VALUES (${routineTemplate.id}, ${mId})`;
        }

        const stepsToInsert = routineInput.steps.length ? routineInput.steps : ["Step 1"];
        for (const [position, stepTitle] of stepsToInsert.entries()) {
          await tx`INSERT INTO routine_steps (routine_template_id, position, title) VALUES (${routineTemplate.id}, ${position + 1}, ${stepTitle})`;
        }
        importedRoutines++;
      }
    });

    await materializeChores();
    await materializeRoutines();

    return NextResponse.json({
      success: true,
      importedChildren,
      importedGroups,
      importedChores,
      importedRoutines
    });
  } catch (error) { return apiError(error); }
}
