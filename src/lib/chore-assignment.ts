export type AssignmentPolicy = "individual" | "any" | "every";

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
