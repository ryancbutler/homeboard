import { db } from "@/lib/db";
import { dateInTimezone, sundayOfWeek } from "@/lib/dates";
import type { DayPart } from "@/lib/day-order";
import { awayRangeFor, type AwayRange } from "@/lib/member-absence";
import { loadVacationContext } from "@/lib/member-absence-store";
import { fromZonedTime } from "date-fns-tz";

export type DashboardData = {
  household: {
    name: string;
    subheading: string;
    timezone: string;
    showBanner: boolean;
  };
  children: { id: string; name: string; color: string; avatarUrl: string | null; away: AwayRange | null }[];
  chores: {
    obligationId: string;
    occurrenceId: string;
    title: string;
    instructions: string | null;
    icon: string | null;
    scheduledFor: string;
    dueAt: string | null;
    policy: "individual" | "any" | "every";
    isFlexible: boolean;
    scheduleKind: string;
    weekdays: number[];
    status: string;
    approvalStatus: string;
    assignee: { id: string; name: string; color: string } | null;
    allowedChildren: { id: string; name: string; color: string }[];
    completedBy: string | null;
    completedAt: string | null;
    templateId: string;
    dayPart: DayPart | null;
    displayOrder: number | null;
  }[];
  routines: {
    id: string;
    title: string;
    icon: string | null;
    owner: string | null;
    ownerId: string | null;
    ownerColor: string | null;
    eligibleChildIds: string[];
    completedSteps: number;
    totalSteps: number;
    steps: { id: string; title: string; icon: string | null; completed: boolean }[];
    templateId: string;
    dayPart: DayPart | null;
    displayOrder: number | null;
  }[];
  generatedAt: string;
};

type ChoreChild = DashboardData["chores"][number]["allowedChildren"][number];

/**
 * Only shared chores are eligible to appear in more than one child's column.
 * A grouped individual chore without a group assignee is deliberately
 * unassigned; treating it as shared makes it leak into every child's list.
 */
export function allowedChildrenForChore(
  policy: DashboardData["chores"][number]["policy"],
  explicitlyAllowed: ChoreChild[] | undefined,
  children: ChoreChild[]
): ChoreChild[] {
  if (policy !== "any") return [];
  return explicitlyAllowed ?? children;
}

export async function dashboardFor(householdId: string): Promise<DashboardData> {
  const householdRows = await db<
    {
      name: string;
      subheading: string;
      timezone: string;
      show_banner: boolean;
    }[]
  >`
    SELECT name,
           COALESCE(subheading, 'Your people. Your little wins. Your home, together.') AS subheading,
           timezone,
           COALESCE(show_banner, true) AS show_banner
    FROM households WHERE id = ${householdId}`;
  const household = householdRows[0];
  if (!household) throw new Error("Household not found");
  const today = dateInTimezone(new Date(), household.timezone);
  const weekEndsOn = sundayOfWeek(today);
  const todayStart = fromZonedTime(`${today}T00:00:00`, household.timezone);
  const todayEnd = fromZonedTime(`${today}T23:59:59.999`, household.timezone);
  const [vacation, children, choreRows, routineRows] = await Promise.all([
    loadVacationContext(householdId),
    db<{ id: string; display_name: string; color: string; avatar_url: string | null }[]>`
      SELECT id, display_name, color, avatar_url FROM members
      WHERE household_id = ${householdId} AND role = 'child' AND active = true ORDER BY display_name`,
    db<
      {
        obligation_id: string;
        occurrence_id: string;
        title: string;
        instructions: string | null;
        scheduled_for: string;
        due_at: Date | null;
        assignment_policy: "individual" | "any" | "every";
        is_flexible: boolean;
        schedule_kind: string;
        weekdays: number[];
        status: string;
        approval_status: string;
        assignee_id: string | null;
        assignee_name: string | null;
        assignee_color: string | null;
        completed_by: string | null;
        completed_at: Date | null;
        template_id: string;
        icon: string | null;
        day_part: DayPart | null;
        display_order: number | null;
      }[]
    >`
      SELECT o.id AS obligation_id, co.id AS occurrence_id, ct.id AS template_id, ct.title, ct.instructions, ct.icon, ct.day_part, ct.display_order, co.scheduled_for,
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
          OR (ct.is_flexible = true AND co.scheduled_for >= ${today} AND co.scheduled_for <= ${weekEndsOn} AND o.status IN ('open', 'pending', 'rejected'))
          OR (o.rescheduled_from_obligation_id IS NOT NULL AND co.scheduled_for >= ${today} AND co.scheduled_for <= ${weekEndsOn} AND o.status IN ('open', 'pending', 'rejected'))
          OR (
            o.status = 'completed' AND (
              (ct.is_flexible = false AND co.scheduled_for = ${today})
              OR (ct.is_flexible = true AND o.completed_at BETWEEN ${todayStart} AND ${todayEnd})
            )
          )
        )
      ORDER BY (CASE WHEN o.status = 'completed' THEN 1 ELSE 0 END), co.scheduled_for, co.due_at NULLS LAST, ct.title`,
    db<
      {
        run_id: string;
        title: string;
        icon: string | null;
        owner: string | null;
        owner_id: string | null;
        owner_color: string | null;
        step_id: string;
        step_title: string;
        step_icon: string | null;
        completed: boolean;
        template_id: string;
        day_part: DayPart | null;
        display_order: number | null;
      }[]
    >`
      SELECT rr.id AS run_id, rt.id AS template_id, rt.title, rt.icon, rt.day_part, rt.display_order, m.display_name AS owner, m.id AS owner_id, m.color AS owner_color, rs.id AS step_id, rs.title AS step_title, rs.icon AS step_icon,
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
      ORDER BY rt.title, rs.position`,
  ]);
  const routines = new Map<string, DashboardData["routines"][number]>();
  for (const row of routineRows) {
    if (vacation.isExcused("routine", row.template_id, row.owner_id, today)) continue;
    const value = routines.get(row.run_id) ?? {
      id: row.run_id,
      title: row.title,
      icon: row.icon,
      owner: row.owner,
      ownerId: row.owner_id,
      ownerColor: row.owner_color,
      eligibleChildIds: vacation.eligibleIds("routine", row.template_id).filter((id) => !vacation.isAway(id, today)),
      completedSteps: 0,
      totalSteps: 0,
      steps: [],
      templateId: row.template_id,
      dayPart: row.day_part,
      displayOrder: row.display_order,
    };
    value.totalSteps += 1;
    if (row.completed) value.completedSteps += 1;
    value.steps.push({
      id: row.step_id,
      title: row.step_title,
      icon: row.step_icon,
      completed: Boolean(row.completed),
    });
    routines.set(row.run_id, value);
  }
  return {
    household: {
      name: household.name,
      subheading: household.subheading,
      timezone: household.timezone,
      showBanner: Boolean(household.show_banner),
    },
    children: children.map((child) => ({
      id: child.id,
      name: child.display_name,
      color: child.color,
      avatarUrl: child.avatar_url,
      away: awayRangeFor(vacation.absences, child.id, today),
    })),
    chores: choreRows
      .filter((row) => {
        const status = vacation.choreStatus(
          row.template_id,
          row.assignee_id,
          row.assignment_policy,
          row.scheduled_for,
          row.status
        );
        if (status === "excused") return false;
        // Future work can remain due after return while being paused today.
        if (["open", "rejected"].includes(status)) {
          if (row.assignee_id && vacation.isAway(row.assignee_id, today)) return false;
          if (
            !row.assignee_id &&
            row.assignment_policy === "any" &&
            !vacation.eligibleIds("chore", row.template_id).some((id) => !vacation.isAway(id, today))
          )
            return false;
        }
        return true;
      })
      .map((row) => ({
        obligationId: row.obligation_id,
        occurrenceId: row.occurrence_id,
        title: row.title,
        instructions: row.instructions,
        icon: row.icon ?? null,
        scheduledFor: row.scheduled_for,
        dueAt: row.due_at?.toISOString() ?? null,
        policy: row.assignment_policy,
        isFlexible: Boolean(row.is_flexible),
        scheduleKind: row.schedule_kind,
        weekdays: row.weekdays ?? [],
        status: row.status,
        approvalStatus: row.approval_status,
        assignee: row.assignee_id
          ? { id: row.assignee_id, name: row.assignee_name!, color: row.assignee_color! }
          : null,
        allowedChildren: allowedChildrenForChore(
          row.assignment_policy,
          children
            .filter(
              (child) =>
                vacation.eligibleIds("chore", row.template_id).includes(child.id) && !vacation.isAway(child.id, today)
            )
            .map((child) => ({ id: child.id, name: child.display_name, color: child.color })),
          children.map((child) => ({ id: child.id, name: child.display_name, color: child.color }))
        ),
        completedBy: row.completed_by,
        completedAt: row.completed_at?.toISOString() ?? null,
        templateId: row.template_id,
        dayPart: row.day_part,
        displayOrder: row.display_order,
      })),
    routines: [...routines.values()],
    generatedAt: new Date().toISOString(),
  };
}
