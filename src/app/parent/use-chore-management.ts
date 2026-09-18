import { FormEvent, useMemo, useState } from "react";
import { formSchedule, matchingIcons } from "./parent-utils";

export type ChoreTemplate = {
  id: string;
  title: string;
  instructions: string | null;
  icon: string | null;
  assignmentPolicy: "individual" | "any" | "every";
  approvalRequired: boolean;
  isFlexible: boolean;
  scheduleKind: string;
  startDate: string;
  dueTime: string | null;
  nextScheduledFor: string | null;
  weekdays: number[];
  active: boolean;
  groupId: string | null;
  assigneeIds: string[];
};

type Options = {
  perform: (key: string, action: () => Promise<void>) => Promise<void>;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  setNotice: (notice: string) => void;
  timezone: string;
  selectChores: () => void;
};

export function useChoreManagement({ perform, request, setNotice, timezone, selectChores }: Options) {
  const [editingChore, setEditingChore] = useState<ChoreTemplate | null>(null);
  const [choreTitleInput, setChoreTitleInput] = useState("");
  const [choreIcon, setChoreIcon] = useState("");
  const [choreIconFilter, setChoreIconFilter] = useState("");
  const [choreScheduleKind, setChoreScheduleKind] = useState("daily");
  const [choreWeekdays, setChoreWeekdays] = useState<number[]>([1]);
  const [choreIsFlexible, setChoreIsFlexible] = useState(false);
  const [choreSelectedGroupId, setChoreSelectedGroupId] = useState("");
  const [choreAssigneeIds, setChoreAssigneeIds] = useState<string[]>([]);
  const [chorePolicy, setChorePolicy] = useState<"individual" | "any" | "every">("individual");
  const [choreApprovalRequired, setChoreApprovalRequired] = useState(false);
  const filteredChoreIcons = useMemo(() => matchingIcons(choreIconFilter), [choreIconFilter]);

  const startEditChore = (chore: ChoreTemplate) => {
    setEditingChore(chore);
    setChoreTitleInput(chore.title);
    setChoreIcon(chore.icon ?? "");
    setChoreIconFilter("");
    setChoreScheduleKind(chore.scheduleKind);
    setChoreWeekdays(chore.weekdays.length ? chore.weekdays : [1]);
    setChoreIsFlexible(chore.isFlexible);
    setChoreSelectedGroupId(chore.groupId ?? "");
    setChoreAssigneeIds(chore.assigneeIds);
    setChorePolicy(chore.assignmentPolicy);
    setChoreApprovalRequired(chore.approvalRequired);
    selectChores();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditChore = () => {
    setEditingChore(null);
    setChoreTitleInput("");
    setChoreIcon("");
    setChoreIconFilter("");
    setChoreScheduleKind("daily");
    setChoreWeekdays([1]);
    setChoreIsFlexible(false);
    setChoreSelectedGroupId("");
    setChoreAssigneeIds([]);
    setChorePolicy("individual");
    setChoreApprovalRequired(false);
  };

  const saveChore = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const title = String(form.get("title"));
    const instructions = form.get("instructions") ? String(form.get("instructions")) : undefined;
    const groupId = choreSelectedGroupId || null;
    let policy = chorePolicy;
    if (choreAssigneeIds.length > 1 && policy === "individual") policy = "every";
    else if (choreAssigneeIds.length === 1) policy = "individual";
    else if (choreAssigneeIds.length === 0) policy = "any";

    void perform("chore-save", async () => {
      const payload = {
        title,
        instructions,
        icon: choreIcon || null,
        assignmentPolicy: policy,
        approvalRequired: choreApprovalRequired,
        isFlexible: choreScheduleKind === "weekly" ? choreIsFlexible : false,
        assigneeIds: choreAssigneeIds,
        groupId,
        schedule: formSchedule(choreScheduleKind, choreWeekdays, timezone)
      };
      if (editingChore) {
        await request(`/api/v1/chore-templates/${editingChore.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        setNotice(`Chore "${title}" updated.`);
      } else {
        await request("/api/v1/chore-templates", { method: "POST", body: JSON.stringify(payload) });
        setNotice(`Chore "${title}" created and scheduled.`);
      }
      cancelEditChore();
      element.reset();
    });
  };

  const deleteChore = (id: string, title: string) => {
    if (!window.confirm(`Delete chore "${title}"? This will remove all open and upcoming copies.`)) return;
    void perform(`del-chore-${id}`, async () => {
      await request(`/api/v1/chore-templates/${id}`, { method: "DELETE" });
      setNotice(`Chore "${title}" deleted.`);
    });
  };

  return {
    editingChore, choreTitleInput, setChoreTitleInput, choreIcon, setChoreIcon, choreIconFilter, setChoreIconFilter,
    choreScheduleKind, setChoreScheduleKind, choreWeekdays, setChoreWeekdays, choreIsFlexible, setChoreIsFlexible,
    choreSelectedGroupId, setChoreSelectedGroupId, choreAssigneeIds, setChoreAssigneeIds, chorePolicy, setChorePolicy,
    choreApprovalRequired, setChoreApprovalRequired, filteredChoreIcons, startEditChore, cancelEditChore, saveChore, deleteChore
  };
}
