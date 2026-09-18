import { describe, expect, it } from "vitest";
import { rotationAssignee } from "@/lib/chore-group-rotation";

const rotation = {
  id: "rotation", first_group_id: "group-a", second_group_id: "group-b",
  first_member_id: "child-1", second_member_id: "child-2", start_date: "2026-09-21"
};

describe("chore group rotations", () => {
  it("alternates each Monday and keeps one owner for the whole week", () => {
    expect(rotationAssignee(rotation, "group-a", "2026-09-21")).toBe("child-1");
    expect(rotationAssignee(rotation, "group-a", "2026-09-27")).toBe("child-1");
    expect(rotationAssignee(rotation, "group-a", "2026-09-28")).toBe("child-2");
    expect(rotationAssignee(rotation, "group-b", "2026-09-28")).toBe("child-1");
    expect(rotationAssignee(rotation, "group-a", "2026-10-05")).toBe("child-1");
  });

  it("does not apply before the rotation starts or to another group", () => {
    expect(rotationAssignee(rotation, "group-a", "2026-09-20")).toBeNull();
    expect(rotationAssignee(rotation, "other", "2026-09-21")).toBeNull();
  });
});
