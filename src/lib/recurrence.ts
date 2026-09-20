import { databaseDialect, db } from "@/lib/db";
import { dateInTimezone, dueAt, scheduledDays, type Schedule } from "@/lib/dates";
import { rotationAssignee, type ChoreGroupRotation } from "@/lib/chore-group-rotation";

type Template = {
  id: string;
  household_id: string;
  title: string;
  assignment_policy: "individual" | "any" | "every";
  approval_required: boolean;
  schedule_kind: Schedule["kind"];
  start_date: string;
  due_time: string | null;
  weekdays: number[];
};

export async function materializeChores(until = new Date(Date.now() + 30 * 86_400_000)) {
  const templates = await db<(Template & { chore_group_id: string | null })[]>`
    SELECT ct.*, COALESCE(ct.weekdays, '{}') AS weekdays
    FROM chore_templates ct WHERE ct.active = true`;
  const rotations = await db<ChoreGroupRotation[]>`
    SELECT id, first_group_id, second_group_id, first_member_id, second_member_id, start_date
    FROM chore_group_rotations`;
  const rotationsByGroup = new Map<string, ChoreGroupRotation>();
  for (const rotation of rotations) {
    rotationsByGroup.set(rotation.first_group_id, rotation);
    rotationsByGroup.set(rotation.second_group_id, rotation);
  }
  for (const template of templates) {
    const [{ timezone }] = await db<
      { timezone: string }[]
    >`SELECT timezone FROM households WHERE id = ${template.household_id}`;
    const today = dateInTimezone(new Date(), timezone);
    const finalDay = dateInTimezone(until, timezone);
    const schedule: Schedule = {
      kind: template.schedule_kind,
      startDate: template.start_date,
      weekdays: template.weekdays,
      dueTime: template.due_time,
    };
    const assignees = await db<
      { member_id: string }[]
    >`SELECT member_id FROM chore_template_assignees WHERE chore_template_id = ${template.id}`;
    for (const day of scheduledDays(schedule, today, finalDay)) {
      const rotation = template.chore_group_id ? rotationsByGroup.get(template.chore_group_id) : undefined;
      const rotatingAssignee =
        rotation && template.chore_group_id ? rotationAssignee(rotation, template.chore_group_id, day) : null;
      const occurrence = await db<{ id: string }[]>`
        INSERT INTO chore_occurrences (chore_template_id, household_id, scheduled_for, due_at)
        SELECT ${template.id}, ${template.household_id}, ${day}, ${dueAt(day, template.due_time, timezone)}
        WHERE NOT EXISTS (
          SELECT 1 FROM chore_occurrences
          WHERE chore_template_id = ${template.id} AND (scheduled_for = ${day} OR postponed_from = ${day})
        )
        ON CONFLICT (chore_template_id, scheduled_for) DO UPDATE SET scheduled_for = EXCLUDED.scheduled_for
        RETURNING id`;
      if (!occurrence[0]) continue;
      const occurrenceId = occurrence[0].id;
      if (template.assignment_policy === "every") {
        for (const assignee of assignees)
          await db`
          INSERT INTO chore_obligations (occurrence_id, member_id, approval_status)
          VALUES (${occurrenceId}, ${assignee.member_id}, 'not_required')
          ON CONFLICT DO NOTHING`;
      } else {
        await db`
          INSERT INTO chore_obligations (occurrence_id, member_id, approval_status)
          SELECT ${occurrenceId}, ${rotatingAssignee ?? (template.assignment_policy === "individual" ? (assignees[0]?.member_id ?? null) : null)}, 'not_required'
          WHERE NOT EXISTS (SELECT 1 FROM chore_obligations WHERE occurrence_id = ${occurrenceId})
          ON CONFLICT DO NOTHING`;
      }
    }
  }
}

export async function markMissed() {
  if (databaseDialect === "sqlite") {
    await db`
      UPDATE chore_obligations SET status = 'missed'
      WHERE status IN ('open', 'rejected') AND occurrence_id IN (
        SELECT id FROM chore_occurrences WHERE scheduled_for < date('now')
      )`;
    return;
  }
  await db`
    UPDATE chore_obligations o SET status = 'missed'
    FROM chore_occurrences c, households h
    WHERE o.occurrence_id = c.id AND h.id = c.household_id AND o.status IN ('open', 'rejected')
      AND c.scheduled_for < (now() AT TIME ZONE h.timezone)::date`;
}

export async function materializeRoutines(until = new Date(Date.now() + 30 * 86_400_000)) {
  const templates = await db<
    {
      id: string;
      household_id: string;
      assignment_policy: "individual" | "any" | "every";
      schedule_kind: Schedule["kind"];
      start_date: string;
      due_time: string | null;
      weekdays: number[];
    }[]
  >`SELECT id, household_id, assignment_policy, schedule_kind, start_date, due_time, COALESCE(weekdays, '{}') AS weekdays FROM routine_templates WHERE active = true`;
  for (const template of templates) {
    const [{ timezone }] = await db<
      { timezone: string }[]
    >`SELECT timezone FROM households WHERE id = ${template.household_id}`;
    const today = dateInTimezone(new Date(), timezone);
    const schedule: Schedule = {
      kind: template.schedule_kind,
      startDate: template.start_date,
      weekdays: template.weekdays,
      dueTime: template.due_time,
    };
    const assignees = await db<
      { member_id: string }[]
    >`SELECT member_id FROM routine_template_assignees WHERE routine_template_id = ${template.id}`;
    if (assignees.length > 0) {
      await db`
        DELETE FROM routine_runs
        WHERE routine_template_id = ${template.id} AND member_id IS NULL AND scheduled_for >= ${today}`;
    }
    for (const day of scheduledDays(schedule, today, dateInTimezone(until, timezone))) {
      const owners =
        template.assignment_policy === "every"
          ? assignees.map((value) => value.member_id)
          : [template.assignment_policy === "individual" ? (assignees[0]?.member_id ?? null) : null];
      for (const owner of owners)
        await db`
        INSERT INTO routine_runs (routine_template_id, household_id, scheduled_for, member_id)
        VALUES (${template.id}, ${template.household_id}, ${day}, ${owner})
        ON CONFLICT DO NOTHING`;
    }
  }
}
