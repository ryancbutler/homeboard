import { FormEvent, useState } from "react";
import type { ChoreGroup, ChoreGroupRotation } from "./parent-types";

type Options = {
  perform: (key: string, action: () => Promise<void>) => Promise<void>;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  setNotice: (notice: string) => void;
};

const nextMonday = () => {
  const value = new Date();
  const days = (8 - value.getDay()) % 7 || 7;
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};

export function useGroupManagement({ perform, request, setNotice }: Options) {
  const [rotationFirstGroupId, setRotationFirstGroupId] = useState("");
  const [rotationSecondGroupId, setRotationSecondGroupId] = useState("");
  const [rotationFirstMemberId, setRotationFirstMemberId] = useState("");
  const [rotationSecondMemberId, setRotationSecondMemberId] = useState("");
  const [rotationStartDate, setRotationStartDate] = useState(nextMonday);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupNameInput, setGroupNameInput] = useState("");

  const createGroup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    void perform("group", async () => {
      await request("/api/v1/chore-groups", { method: "POST", body: JSON.stringify({ name: form.get("groupName") }) });
      element.reset();
      setNotice("Chore group created. You can assign a child below.");
    });
  };

  const switchGroup = (groupId: string, memberId: string) => void perform(groupId, async () => {
    await request(`/api/v1/chore-groups/${groupId}`, { method: "PATCH", body: JSON.stringify({ assignedMemberId: memberId || null }) });
    setNotice(memberId ? "Group assignment updated for open chores." : "Child removed from group.");
  });

  const createRotation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void perform("rotation", async () => {
      await request("/api/v1/chore-group-rotations", {
        method: "POST",
        body: JSON.stringify({
          firstGroupId: rotationFirstGroupId,
          secondGroupId: rotationSecondGroupId,
          firstMemberId: rotationFirstMemberId,
          secondMemberId: rotationSecondMemberId,
          startDate: rotationStartDate
        })
      });
      setNotice("Weekly group rotation scheduled. Future chores will alternate automatically.");
    });
  };

  const stopRotation = (rotation: ChoreGroupRotation) => {
    if (!window.confirm(`Stop the rotation between ${rotation.firstGroup.name} and ${rotation.secondGroup.name}?`)) return;
    void perform(`stop-rotation-${rotation.id}`, async () => {
      await request(`/api/v1/chore-group-rotations/${rotation.id}`, { method: "DELETE" });
      setNotice("Group rotation stopped. Each group keeps this week's child.");
    });
  };

  const startRenameGroup = (group: ChoreGroup) => {
    setEditingGroupId(group.id);
    setGroupNameInput(group.name);
  };

  const saveGroupName = (event: FormEvent<HTMLFormElement>, group: ChoreGroup) => {
    event.preventDefault();
    const name = groupNameInput.trim();
    if (!name) return;
    if (name === group.name) {
      setEditingGroupId(null);
      return;
    }
    void perform(`rename-group-${group.id}`, async () => {
      await request(`/api/v1/chore-groups/${group.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
      setEditingGroupId(null);
      setNotice(`Group renamed to "${name}".`);
    });
  };

  const deleteGroup = (groupId: string, name: string) => {
    if (!window.confirm(`Delete group "${name}"? Existing chores will remain without a group.`)) return;
    void perform(`del-group-${groupId}`, async () => {
      await request(`/api/v1/chore-groups/${groupId}`, { method: "DELETE" });
      setNotice(`Group "${name}" deleted.`);
    });
  };

  return {
    rotationFirstGroupId, setRotationFirstGroupId, rotationSecondGroupId, setRotationSecondGroupId, rotationFirstMemberId,
    setRotationFirstMemberId, rotationSecondMemberId, setRotationSecondMemberId, rotationStartDate, setRotationStartDate,
    editingGroupId, setEditingGroupId, groupNameInput, setGroupNameInput, createGroup, switchGroup, createRotation,
    stopRotation, startRenameGroup, saveGroupName, deleteGroup
  };
}
