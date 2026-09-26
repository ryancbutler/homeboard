import { describe, expect, it } from "vitest";
import { allowedChildrenForChore } from "@/lib/dashboard";

const children = [
  { id: "remy", name: "Remy", color: "#8b5cf6", avatarUrl: null },
  { id: "taylor", name: "Taylor", color: "#f97316", avatarUrl: null },
];

describe("dashboard chore visibility", () => {
  it("does not show an unassigned individual group chore to every child", () => {
    expect(allowedChildrenForChore("individual", undefined, children)).toEqual([]);
  });

  it("keeps an unassigned shared chore available to every child", () => {
    expect(allowedChildrenForChore("any", undefined, children)).toEqual(children);
  });

  it("limits a shared chore to its explicitly allowed children", () => {
    expect(allowedChildrenForChore("any", [children[0]], children)).toEqual([children[0]]);
  });
});
