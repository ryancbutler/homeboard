import { db, type Db } from "@/lib/db";
import { isMemberAway, isWorkExcused, vacationChoreStatus, type MemberAbsence } from "@/lib/member-absence";

export async function loadAbsences(householdId: string, sql: Db = db): Promise<MemberAbsence[]> {
  const rows = await sql<{ id: string; member_id: string; start_date: string; end_date: string }[]>`
    SELECT id, member_id, start_date, end_date FROM member_absences
    WHERE household_id = ${householdId} ORDER BY start_date DESC, id`;
  return rows.map((row) => ({ id: row.id, memberId: row.member_id, startDate: row.start_date, endDate: row.end_date }));
}

export async function loadVacationContext(householdId: string, sql: Db = db) {
  const [absences, children, choreAssignees, routineAssignees] = await Promise.all([
    loadAbsences(householdId, sql),
    sql<
      { id: string }[]
    >`SELECT id FROM members WHERE household_id = ${householdId} AND role = 'child' AND active = true`,
    sql<{ template_id: string; member_id: string }[]>`
      SELECT a.chore_template_id AS template_id, a.member_id FROM chore_template_assignees a
      JOIN chore_templates t ON t.id = a.chore_template_id WHERE t.household_id = ${householdId}`,
    sql<{ template_id: string; member_id: string }[]>`
      SELECT a.routine_template_id AS template_id, a.member_id FROM routine_template_assignees a
      JOIN routine_templates t ON t.id = a.routine_template_id WHERE t.household_id = ${householdId}`,
  ]);
  const activeIds = children.map((child) => child.id);
  function eligibleIds(kind: "chore" | "routine", templateId: string) {
    const assigned = (kind === "chore" ? choreAssignees : routineAssignees).filter(
      (row) => row.template_id === templateId
    );
    return assigned.length ? assigned.map((row) => row.member_id).filter((id) => activeIds.includes(id)) : activeIds;
  }
  return {
    absences,
    eligibleIds,
    isAway: (memberId: string, day: string) => isMemberAway(absences, memberId, day),
    isExcused: (kind: "chore" | "routine", templateId: string, ownerId: string | null, day: string) =>
      isWorkExcused(absences, ownerId, eligibleIds(kind, templateId), day),
    choreStatus: (templateId: string, ownerId: string | null, policy: string, day: string, status: string) =>
      vacationChoreStatus(
        status,
        ownerId || policy === "any" ? isWorkExcused(absences, ownerId, eligibleIds("chore", templateId), day) : false
      ),
  };
}
