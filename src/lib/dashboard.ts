import { db } from "@/lib/db";
import { dateInTimezone } from "@/lib/dates";

export type DashboardData = {
  household: {
    name: string;
    subheading: string;
    timezone: string;
    showBanner: boolean;
  };
  children: { id: string; name: string; color: string; avatarUrl: string | null }[];
  chores: {
    obligationId: string; occurrenceId: string; title: string; instructions: string | null; icon: string | null; scheduledFor: string;
    dueAt: string | null; policy: "individual" | "any" | "every"; isFlexible: boolean; scheduleKind: string; weekdays: number[];
    status: string; approvalStatus: string;
    assignee: { id: string; name: string; color: string } | null;
    allowedChildren: { id: string; name: string; color: string }[];
    completedBy: string | null;
    completedAt: string | null;
  }[];
  routines: {
    id: string;
    title: string;
    owner: string | null;
    ownerId: string | null;
    ownerColor: string | null;
    completedSteps: number;
    totalSteps: number;
    steps: { id: string; title: string; completed: boolean }[];
  }[];
  generatedAt: string;
};

export async function dashboardFor(householdId: string): Promise<DashboardData> {
  const householdRows = await db<{
    name: string;
    subheading: string;
    timezone: string;
    show_banner: boolean;
  }[]>`
    SELECT name,
           COALESCE(subheading, 'Your people. Your little wins. Your home, together.') AS subheading,
           timezone,
           COALESCE(show_banner, true) AS show_banner
    FROM households WHERE id = ${householdId}`;
  const household = householdRows[0];
  if (!household) throw new Error("Household not found");
  const today = dateInTimezone(new Date(), household.timezone);
  const weekFromToday = dateInTimezone(new Date(Date.now() + 7 * 86_400_000), household.timezone);
  const [children, choreRows, routineRows] = await Promise.all([
    db<{ id: string; display_name: string; color: string; avatar_url: string | null }[]>`
      SELECT id, display_name, color, avatar_url FROM members
      WHERE household_id = ${householdId} AND role = 'child' AND active = true ORDER BY display_name`,
    db<{
      obligation_id: string; occurrence_id: string; title: string; instructions: string | null; scheduled_for: string; due_at: Date | null;
      assignment_policy: "individual" | "any" | "every"; is_flexible: boolean; schedule_kind: string; weekdays: number[];
      status: string; approval_status: string; assignee_id: string | null;
      assignee_name: string | null; assignee_color: string | null; completed_by: string | null; completed_at: Date | null; template_id: string; icon: string | null;
    }[]>`
      SELECT o.id AS obligation_id, co.id AS occurrence_id, ct.id AS template_id, ct.title, ct.instructions, ct.icon, co.scheduled_for,
        co.due_at, ct.assignment_policy, ct.is_flexible, ct.schedule_kind, COALESCE(ct.weekdays, '{}') AS weekdays,
        o.status, o.approval_status, o.member_id AS assignee_id,
        m.display_name AS assignee_name, m.color AS assignee_color, o.completed_by, o.completed_at
      FROM chore_obligations o
      JOIN chore_occurrences co ON co.id = o.occurrence_id
      JOIN chore_templates ct ON ct.id = co.chore_template_id
      LEFT JOIN members m ON m.id = o.member_id
      WHERE co.household_id = ${householdId}
        AND (
          (co.scheduled_for <= ${today} AND o.status IN ('open', 'pending', 'rejected'))
          OR (ct.is_flexible = true AND co.scheduled_for >= ${today} AND co.scheduled_for <= ${weekFromToday} AND o.status IN ('open', 'pending', 'rejected'))
          OR (co.scheduled_for = ${today} AND o.status = 'completed')
        )
      ORDER BY (CASE WHEN o.status = 'completed' THEN 1 ELSE 0 END), co.scheduled_for, co.due_at NULLS LAST, ct.title`,
    db<{ run_id: string; title: string; owner: string | null; owner_id: string | null; owner_color: string | null; step_id: string; step_title: string; completed: boolean }[]>`
      SELECT rr.id AS run_id, rt.title, m.display_name AS owner, m.id AS owner_id, m.color AS owner_color, rs.id AS step_id, rs.title AS step_title,
        (rsc.id IS NOT NULL) AS completed
      FROM routine_runs rr
      JOIN routine_templates rt ON rt.id = rr.routine_template_id
      LEFT JOIN members m ON m.id = rr.member_id
      JOIN routine_steps rs ON rs.routine_template_id = rt.id
      LEFT JOIN routine_step_completions rsc ON rsc.routine_run_id = rr.id AND rsc.routine_step_id = rs.id
      WHERE rr.household_id = ${householdId} AND rr.scheduled_for = ${today}
        AND (
          rr.member_id IS NOT NULL
          OR NOT EXISTS (SELECT 1 FROM routine_template_assignees rta WHERE rta.routine_template_id = rt.id)
        )
      ORDER BY rt.title, rs.position`
  ]);
  const allowedByTemplate = new Map<string, { id: string; name: string; color: string }[]>();
  const templateIds = [...new Set(choreRows.filter((row) => row.assignment_policy === "any").map((row) => row.template_id))];
  if (templateIds.length) {
    const allowed = await db<{ chore_template_id: string; id: string; display_name: string; color: string }[]>`
      SELECT cta.chore_template_id, m.id, m.display_name, m.color
      FROM chore_template_assignees cta JOIN members m ON m.id = cta.member_id
      WHERE cta.chore_template_id = ANY(${templateIds}) ORDER BY m.display_name`;
    for (const row of allowed) {
      const values = allowedByTemplate.get(row.chore_template_id) ?? [];
      values.push({ id: row.id, name: row.display_name, color: row.color });
      allowedByTemplate.set(row.chore_template_id, values);
    }
  }
  const routines = new Map<string, DashboardData["routines"][number]>();
  for (const row of routineRows) {
    const value = routines.get(row.run_id) ?? {
      id: row.run_id,
      title: row.title,
      owner: row.owner,
      ownerId: row.owner_id,
      ownerColor: row.owner_color,
      completedSteps: 0,
      totalSteps: 0,
      steps: []
    };
    value.totalSteps += 1;
    if (row.completed) value.completedSteps += 1;
    value.steps.push({ id: row.step_id, title: row.step_title, completed: row.completed });
    routines.set(row.run_id, value);
  }
  return {
    household: {
      name: household.name,
      subheading: household.subheading,
      timezone: household.timezone,
      showBanner: household.show_banner
    },
    children: children.map((child) => ({ id: child.id, name: child.display_name, color: child.color, avatarUrl: child.avatar_url })),
    chores: choreRows.map((row) => ({
      obligationId: row.obligation_id, occurrenceId: row.occurrence_id, title: row.title, instructions: row.instructions,
      icon: row.icon ?? null,
      scheduledFor: row.scheduled_for, dueAt: row.due_at?.toISOString() ?? null, policy: row.assignment_policy,
      isFlexible: row.is_flexible, scheduleKind: row.schedule_kind, weekdays: row.weekdays ?? [],
      status: row.status, approvalStatus: row.approval_status,
      assignee: row.assignee_id ? { id: row.assignee_id, name: row.assignee_name!, color: row.assignee_color! } : null,
      allowedChildren: allowedByTemplate.get(row.template_id) ?? children.map((child) => ({ id: child.id, name: child.display_name, color: child.color })),
      completedBy: row.completed_by,
      completedAt: row.completed_at?.toISOString() ?? null
    })),
    routines: [...routines.values()],
    generatedAt: new Date().toISOString()
  };
}
