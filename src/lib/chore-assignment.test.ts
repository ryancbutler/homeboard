import { describe, expect, it } from "vitest";
import { normalizeChoreAssignmentPolicy, resolveChoreAssignees } from "@/lib/chore-assignment";

describe("chore group assignments", () => {
  it("uses the group's assignee for grouped chores", () => {
    expect(resolveChoreAssignees("individual", ["old-child"], "group-child")).toEqual(["group-child"]);
  });

  it("returns empty assignees when a group has no assigned child yet", () => {
    expect(resolveChoreAssignees("individual", [], null)).toEqual([]);
  });

  it("only allows one-child chores in a group", () => {
    expect(() => resolveChoreAssignees("every", [], "group-child")).toThrow("Chore groups can only");
  });

  it("uses an individual policy when moving a chore into a group", () => {
    expect(normalizeChoreAssignmentPolicy("any", [], true)).toBe("individual");
  });

  it("keeps direct assignment rules for ungrouped chores", () => {
    expect(() => resolveChoreAssignees("individual", ["one", "two"])).toThrow("at most one child");
    expect(resolveChoreAssignees("individual", ["one"])).toEqual(["one"]);
    expect(resolveChoreAssignees("any", ["one", "two"])).toEqual(["one", "two"]);
  });
});
