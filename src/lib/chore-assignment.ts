export type AssignmentPolicy = "individual" | "any" | "every";

/**
 * Keep an assignment policy compatible with the selected assignees or group.
 * Group membership owns the assignment, so grouped chores are always individual.
 */
export function normalizeChoreAssignmentPolicy(
  assignmentPolicy: AssignmentPolicy,
  assigneeIds: string[] | undefined,
  hasGroup: boolean
): AssignmentPolicy {
  if (hasGroup) return "individual";
  if (assigneeIds === undefined) return assignmentPolicy;
  if (assigneeIds.length > 1 && assignmentPolicy === "individual") return "every";
  if (assigneeIds.length === 1) return "individual";
  if (assigneeIds.length === 0) return "any";
  return assignmentPolicy;
}

/** Returns the assignees that should be stored on a chore template. */
export function resolveChoreAssignees(
  assignmentPolicy: AssignmentPolicy,
  assigneeIds: string[],
  groupAssigneeId?: string | null
): string[] {
  if (groupAssigneeId !== undefined) {
    if (assignmentPolicy !== "individual") throw new Error("Chore groups can only be used with one-child chores");
    return groupAssigneeId ? [groupAssigneeId] : [];
  }
  if (assignmentPolicy === "individual" && assigneeIds.length > 1) {
    throw new Error("An individual chore needs at most one child");
  }
  return assigneeIds;
}
