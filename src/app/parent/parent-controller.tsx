"use client";

import { createContext, FormEvent, ReactNode, useContext, useMemo, useRef, useState } from "react";
import type { DashboardData } from "@/lib/dashboard";
import { dateInTimezone } from "@/lib/dates";
import { CHORE_ICONS, resolveTaskIcon } from "@/lib/icons";

type Member = { id: string; role: string; displayName: string; email: string | null; color: string; active: boolean };

type ReportRow = {
  obligation_id: string;
  scheduled_for: string;
  history_date: string;
  title: string;
  child: string | null;
  status: string;
  approval_status: string;
  completed_at: string | null;
  rescheduled_for: string | null;
  is_flexible: boolean;
  schedule_kind: string;
  weekdays: number[];
};

type RescheduleDay = { date: string; label: string; available: boolean; reason: string | null };
type RescheduleDialog = {
  obligationId: string;
  title: string;
  child: string | null;
  days: RescheduleDay[] | null;
  selectedDate: string | null;
};

type ReportSummary = {
  total: number;
  completed: number;
  pending: number;
  missed: number;
  completionRate: number;
};

type Report = {
  from?: string;
  to?: string;
  summary: ReportSummary;
  dailySummary?: ReportSummary;
  rows: ReportRow[];
};

type ChoreGroup = { id: string; name: string; assignedMemberId: string | null; assignedMemberName: string; templateCount: number };
type ChoreGroupRotation = {
  id: string;
  startDate: string;
  firstGroup: { id: string; name: string };
  secondGroup: { id: string; name: string };
  firstMember: { id: string; name: string };
  secondMember: { id: string; name: string };
  current: { firstGroupMemberId: string | null; secondGroupMemberId: string | null };
  next: { firstGroupMemberId: string | null; secondGroupMemberId: string | null };
};

type ChoreTemplate = {
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

type RoutineTemplate = {
  id: string;
  title: string;
  icon: string | null;
  assignmentPolicy: string;
  scheduleKind: string;
  startDate: string;
  dueTime: string | null;
  weekdays: number[];
  steps: { id: string; position: number; title: string; icon: string | null }[];
  assignees: { id: string; name: string }[];
};
type RoutineStepDraft = { title: string; icon: string };

type NavTab = "approvals" | "chores" | "routines" | "groups" | "family" | "settings";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const formatScheduledDate = (date: string | null) => date
  ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00.000Z`))
  : "No upcoming instance";

const nextMonday = () => {
  const value = new Date();
  const days = (8 - value.getDay()) % 7 || 7;
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};

const formatHistorySchedule = (row: ReportRow) => {
  if (row.rescheduled_for) return `Rescheduled to ${formatScheduledDate(row.rescheduled_for)}`;
  if (row.is_flexible) return `Flexible · due ${formatScheduledDate(row.scheduled_for)}`;
  if (row.schedule_kind === "daily") return "Daily";
  if (row.schedule_kind === "weekdays") return "Weekdays (Mon–Fri)";
  if (row.schedule_kind === "once") return `One time · ${formatScheduledDate(row.scheduled_for)}`;
  return `Weekly · ${formatScheduledDate(row.scheduled_for)}`;
};

const matchingIcons = (filter: string) => {
  const query = filter.trim().toLowerCase();
  if (!query) return CHORE_ICONS;
  return CHORE_ICONS.filter((icon) =>
    icon.id.toLowerCase().includes(query) ||
    icon.label.toLowerCase().includes(query) ||
    icon.category?.toLowerCase().includes(query) ||
    icon.keywords?.some((keyword) => keyword.toLowerCase().includes(query))
  );
};

const formSchedule = (kind: string, weekdays: number[], timezone: string) => ({
  kind,
  startDate: dateInTimezone(new Date(), timezone),
  weekdays: kind === "weekly" ? (weekdays.length ? weekdays : [1]) : kind === "weekdays" ? [1, 2, 3, 4, 5] : []
});

const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error((await response.json().catch(() => ({ error: "Unable to connect. Please try again." }))).error);
  return response.json();
};

function useParentController() {
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  const [activeTab, setActiveTab] = useState<NavTab>("approvals");

  const [members, setMembers] = useState<Member[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [groups, setGroups] = useState<ChoreGroup[]>([]);
  const [rotations, setRotations] = useState<ChoreGroupRotation[]>([]);
  const [rotationFirstGroupId, setRotationFirstGroupId] = useState("");
  const [rotationSecondGroupId, setRotationSecondGroupId] = useState("");
  const [rotationFirstMemberId, setRotationFirstMemberId] = useState("");
  const [rotationSecondMemberId, setRotationSecondMemberId] = useState("");
  const [rotationStartDate, setRotationStartDate] = useState(nextMonday);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [choreTemplates, setChoreTemplates] = useState<ChoreTemplate[]>([]);
  const [routineTemplates, setRoutineTemplates] = useState<RoutineTemplate[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Chore form state
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
  const [importFile, setImportFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Routine form state
  const [editingRoutine, setEditingRoutine] = useState<RoutineTemplate | null>(null);
  const [routineScheduleKind, setRoutineScheduleKind] = useState("daily");
  const [routineWeekdays, setRoutineWeekdays] = useState<number[]>([1]);
  const [routineTitleInput, setRoutineTitleInput] = useState("");
  const [routineIcon, setRoutineIcon] = useState("");
  const [routineIconFilter, setRoutineIconFilter] = useState("");
  const [routineAssigneeIds, setRoutineAssigneeIds] = useState<string[]>([]);
  const [routineSteps, setRoutineSteps] = useState<RoutineStepDraft[]>([{ title: "", icon: "" }, { title: "", icon: "" }, { title: "", icon: "" }]);
  const filteredRoutineIcons = useMemo(() => matchingIcons(routineIconFilter), [routineIconFilter]);

  // History filtering & sorting state
  const [historyChildFilter, setHistoryChildFilter] = useState("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState("");
  const [historySortBy, setHistorySortBy] = useState<"date" | "chore" | "child" | "status">("date");
  const [historySortOrder, setHistorySortOrder] = useState<"asc" | "desc">("desc");
  const [rescheduleDialog, setRescheduleDialog] = useState<RescheduleDialog | null>(null);

  const load = async () => {
    const [nextMembers, nextReport, nextGroups, nextRotations, nextChores, nextRoutines, nextDashboard] = await Promise.all([
      request<Member[]>("/api/v1/members"),
      request<Report>("/api/v1/reports"),
      request<ChoreGroup[]>("/api/v1/chore-groups"),
      request<ChoreGroupRotation[]>("/api/v1/chore-group-rotations"),
      request<ChoreTemplate[]>("/api/v1/chore-templates"),
      request<RoutineTemplate[]>("/api/v1/routine-templates"),
      request<DashboardData>("/api/v1/dashboard"),
    ]);
    setMembers(nextMembers);
    setReport(nextReport);
    setGroups(nextGroups);
    setRotations(nextRotations);
    setChoreTemplates(nextChores);
    setRoutineTemplates(nextRoutines);
    setDashboard(nextDashboard);
  };

  const perform = async (key: string, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try { await action(); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Couldn't save that. Please try again."); }
    finally { setBusy(null); }
  };

  const handleUnlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPinError("");
    setBusy("unlock");
    try {
      await request("/api/v1/auth/pin", { method: "POST", body: JSON.stringify({ pin: pinInput }) });
      setAuthenticated(true);
      setPinInput("");
      await load();
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "Incorrect PIN");
    } finally {
      setBusy(null);
    }
  };

  const addChild = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    void perform("child", async () => {
      await request("/api/v1/members", { method: "POST", body: JSON.stringify({ displayName: form.get("name"), color: form.get("color") }) });
      element.reset(); setNotice("Child profile added. Welcome to the team!");
    });
  };

  const deleteChild = (childId: string, name: string) => {
    if (!window.confirm(`Delete ${name}? This will remove their assigned chores and group assignments.`)) return;
    void perform(`delete-child-${childId}`, async () => {
      await request(`/api/v1/members/${childId}`, { method: "DELETE" });
      setNotice(`${name} has been removed.`);
    });
  };

  // Chore handlers
  const startEditChore = (chore: ChoreTemplate) => {
    setEditingChore(chore);
    setChoreTitleInput(chore.title);
    setChoreIcon(chore.icon ?? "");
    setChoreIconFilter("");
    setChoreScheduleKind(chore.scheduleKind);
    setChoreWeekdays(chore.weekdays?.length ? chore.weekdays : [1]);
    setChoreIsFlexible(chore.isFlexible ?? false);
    setChoreSelectedGroupId(chore.groupId ?? "");
    setChoreAssigneeIds(chore.assigneeIds ?? []);
    setChorePolicy(chore.assignmentPolicy);
    setChoreApprovalRequired(chore.approvalRequired ?? false);
    setActiveTab("chores");
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
    const schedule = choreScheduleKind;
    const title = String(form.get("title"));
    const instructions = form.get("instructions") ? String(form.get("instructions")) : undefined;
    const approvalRequired = choreApprovalRequired;
    // `null` is meaningful on PATCH: it removes an existing group assignment.
    const groupId = choreSelectedGroupId || null;

    // Auto-resolve policy
    let policy = chorePolicy;
    if (choreAssigneeIds.length > 1 && policy === "individual") {
      policy = "every";
    } else if (choreAssigneeIds.length === 1) {
      policy = "individual";
    } else if (choreAssigneeIds.length === 0) {
      policy = "any";
    }

    void perform("chore-save", async () => {
      const payload = {
        title,
        instructions,
        icon: choreIcon || null,
        assignmentPolicy: policy,
        approvalRequired,
        isFlexible: schedule === "weekly" ? choreIsFlexible : false,
        assigneeIds: choreAssigneeIds,
        groupId,
        schedule: formSchedule(schedule, choreWeekdays, dashboard?.household.timezone ?? "America/Chicago")
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

  // Routine handlers
  const startEditRoutine = (routine: RoutineTemplate) => {
    setEditingRoutine(routine);
    setRoutineTitleInput(routine.title);
    setRoutineScheduleKind(routine.scheduleKind);
    setRoutineWeekdays(routine.weekdays?.length ? routine.weekdays : [1]);
    setRoutineIcon(routine.icon ?? "");
    setRoutineIconFilter("");
    setRoutineAssigneeIds(routine.assignees.map((a) => a.id));
    setRoutineSteps(routine.steps.length ? routine.steps.map((s) => ({ title: s.title, icon: s.icon ?? "" })) : [{ title: "", icon: "" }]);
    setActiveTab("routines");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditRoutine = () => {
    setEditingRoutine(null);
    setRoutineTitleInput("");
    setRoutineScheduleKind("daily");
    setRoutineWeekdays([1]);
    setRoutineIcon("");
    setRoutineIconFilter("");
    setRoutineAssigneeIds([]);
    setRoutineSteps([{ title: "", icon: "" }, { title: "", icon: "" }, { title: "", icon: "" }]);
  };

  const saveRoutine = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const title = String(form.get("routineTitle"));
    const validSteps = routineSteps
      .map((step) => ({ title: step.title.trim(), icon: step.icon || null }))
      .filter((step) => Boolean(step.title));

    if (!validSteps.length) {
      setNotice("Please add at least one step for this routine.");
      return;
    }

    void perform("routine-save", async () => {
      const payload = {
        title,
        icon: routineIcon || null,
        assigneeIds: routineAssigneeIds,
        steps: validSteps,
        schedule: formSchedule(routineScheduleKind, routineWeekdays, dashboard?.household.timezone ?? "America/Chicago")
      };

      if (editingRoutine) {
        await request(`/api/v1/routine-templates/${editingRoutine.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        setNotice(`Routine "${title}" updated.`);
      } else {
        await request("/api/v1/routine-templates", { method: "POST", body: JSON.stringify(payload) });
        setNotice(`Routine "${title}" created.`);
      }
      cancelEditRoutine();
      element.reset();
    });
  };

  const deleteRoutine = (id: string, title: string) => {
    if (!window.confirm(`Delete routine "${title}"?`)) return;
    void perform(`del-routine-${id}`, async () => {
      await request(`/api/v1/routine-templates/${id}`, { method: "DELETE" });
      setNotice(`Routine "${title}" deleted.`);
    });
  };

  // Group handlers
  const createGroup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    void perform("group", async () => {
      await request("/api/v1/chore-groups", { method: "POST", body: JSON.stringify({ name: form.get("groupName") }) });
      element.reset(); setNotice("Chore group created. You can assign a child below.");
    });
  };

  const switchGroup = (groupId: string, memberId: string) => void perform(groupId, async () => {
    await request(`/api/v1/chore-groups/${groupId}`, {
      method: "PATCH",
      body: JSON.stringify({ assignedMemberId: memberId || null })
    });
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

  const review = (id: string, decision: "approve" | "reject") => void perform(id, async () => {
    await request(`/api/v1/obligations/${id}/review`, { method: "POST", body: JSON.stringify({ decision }) });
    setNotice(decision === "approve" ? "Chore approved. Another win for the team!" : "Chore sent back for another try.");
  });

  // Undo chore completion per child in history
  const undoChore = (obligationId: string, choreTitle: string) => {
    void perform(`undo-${obligationId}`, async () => {
      await request(`/api/v1/obligations/${obligationId}/undo`, { method: "POST" });
      setNotice(`Chore "${choreTitle}" has been undone and reset to open.`);
    });
  };

  const openReschedule = (row: ReportRow) => {
    setRescheduleDialog({ obligationId: row.obligation_id, title: row.title, child: row.child, days: null, selectedDate: null });
    void perform(`reschedule-options-${row.obligation_id}`, async () => {
      const options = await request<{ days: RescheduleDay[] }>(`/api/v1/obligations/${row.obligation_id}/reschedule`);
      setRescheduleDialog((current) => current?.obligationId === row.obligation_id ? { ...current, days: options.days } : current);
    });
  };

  const confirmReschedule = () => {
    if (!rescheduleDialog?.selectedDate) return;
    const { obligationId, selectedDate, title } = rescheduleDialog;
    void perform(`reschedule-${obligationId}`, async () => {
      await request(`/api/v1/obligations/${obligationId}/reschedule`, {
        method: "POST",
        body: JSON.stringify({ scheduledFor: selectedDate })
      });
      setRescheduleDialog(null);
      setNotice(`Chore "${title}" rescheduled for ${selectedDate}.`);
    });
  };

  const updateHouseholdSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void perform("household-settings", async () => {
      await request("/api/v1/household", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.get("householdName"),
          subheading: form.get("subheading"),
          showBanner: form.get("showBanner") === "on"
        })
      });
      setNotice("Board settings updated!");
    });
  };

  const changePin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const newPin = String(form.get("newPin"));
    void perform("change-pin", async () => {
      await request("/api/v1/auth/pin", {
        method: "PATCH",
        body: JSON.stringify({ newPin })
      });
      element.reset();
      setNotice("Parent PIN changed successfully!");
    });
  };

  const handleExport = () => {
    window.location.href = "/api/v1/backup";
  };

  const clearImportFile = () => {
    setImportFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!importFile) return;
    if (importFile.size > 1_000_000) {
      setNotice("Backup files must be smaller than 1 MB.");
      return;
    }
    if (!window.confirm("Import this setup? It adds missing children, groups, chores, and routines. Existing chores and routines with the same name will be left unchanged.")) return;
    void perform("import", async () => {
      const text = await importFile.text();
      const json = JSON.parse(text);
      const res = await request<{
        success: boolean;
        importedChildren?: number;
        importedGroups: number;
        importedChores: number;
        importedRoutines: number;
        skippedChores: number;
        skippedRoutines: number;
      }>("/api/v1/backup", {
        method: "POST",
        body: JSON.stringify(json)
      });
      const skipped = res.skippedChores + res.skippedRoutines;
      setNotice(`Import complete: added ${res.importedChildren ? `${res.importedChildren} children, ` : ""}${res.importedChores} chores, ${res.importedRoutines} routines, and ${res.importedGroups} groups.${skipped ? ` Left ${skipped} matching chore or routine${skipped === 1 ? "" : "s"} unchanged.` : ""}`);
      clearImportFile();
      (event.target as HTMLFormElement).reset();
    });
  };

  // Filtered & sorted history entries
  const filteredHistory = useMemo(() => {
    if (!report?.rows) return [];
    return report.rows.filter((row) => {
      if (historyChildFilter !== "all") {
        const rowChild = row.child ?? "Shared";
        if (rowChild !== historyChildFilter) return false;
      }
      if (historyStatusFilter !== "all" && row.status !== historyStatusFilter) return false;
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchesTitle = row.title.toLowerCase().includes(q);
        const matchesChild = (row.child ?? "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesChild) return false;
      }
      return true;
    }).sort((a, b) => {
      let cmp = 0;
      if (historySortBy === "date") {
        cmp = a.history_date.localeCompare(b.history_date);
      } else if (historySortBy === "chore") {
        cmp = a.title.localeCompare(b.title);
      } else if (historySortBy === "child") {
        cmp = (a.child ?? "").localeCompare(b.child ?? "");
      } else if (historySortBy === "status") {
        cmp = a.status.localeCompare(b.status);
      }
      return historySortOrder === "asc" ? cmp : -cmp;
    });
  }, [report?.rows, historyChildFilter, historyStatusFilter, historySearch, historySortBy, historySortOrder]);

  const children = members.filter((member) => member.role === "child" && member.active);
  const rotatingGroupIds = new Set(rotations.flatMap((rotation) => [rotation.firstGroup.id, rotation.secondGroup.id]));
  const childName = (id: string | null) => children.find((child) => child.id === id)?.displayName ?? "Waiting to start";
  const pending = dashboard?.chores.filter((chore) => chore.status === "pending") ?? [];
  const familyToday = useMemo(() => {
    if (!dashboard) return null;

    const isFinished = (status: string) => status === "completed" || status === "pending";
    const isStillOpen = (status: string) => status === "open" || status === "rejected";

    return {
      children: dashboard.children.map((child) => {
        const chores = dashboard.chores.filter((chore) => chore.assignee?.id === child.id);
        const routines = dashboard.routines.filter((routine) => routine.ownerId === child.id);
        const totalRoutineSteps = routines.reduce((total, routine) => total + routine.totalSteps, 0);
        const completedRoutineSteps = routines.reduce((total, routine) => total + routine.completedSteps, 0);

        return {
          ...child,
          totalChores: chores.length,
          finishedChores: chores.filter((chore) => isFinished(chore.status)).length,
          openChores: chores.filter((chore) => isStillOpen(chore.status)).length,
          totalRoutineSteps,
          completedRoutineSteps
        };
      }),
      sharedOpenChores: dashboard.chores.filter((chore) => !chore.assignee && isStillOpen(chore.status)).length
    };
  }, [dashboard]);

  return {
    authenticated,
    pinInput,
    setPinInput,
    pinError,
    activeTab,
    setActiveTab,
    members,
    groups,
    rotations,
    rotationFirstGroupId,
    setRotationFirstGroupId,
    rotationSecondGroupId,
    setRotationSecondGroupId,
    rotationFirstMemberId,
    setRotationFirstMemberId,
    rotationSecondMemberId,
    setRotationSecondMemberId,
    rotationStartDate,
    setRotationStartDate,
    editingGroupId,
    setEditingGroupId,
    groupNameInput,
    setGroupNameInput,
    choreTemplates,
    routineTemplates,
    dashboard,
    notice,
    busy,
    editingChore,
    choreTitleInput,
    setChoreTitleInput,
    choreIcon,
    setChoreIcon,
    choreIconFilter,
    setChoreIconFilter,
    choreScheduleKind,
    setChoreScheduleKind,
    choreWeekdays,
    setChoreWeekdays,
    choreIsFlexible,
    setChoreIsFlexible,
    choreSelectedGroupId,
    setChoreSelectedGroupId,
    choreAssigneeIds,
    setChoreAssigneeIds,
    chorePolicy,
    setChorePolicy,
    choreApprovalRequired,
    setChoreApprovalRequired,
    filteredChoreIcons,
    importFile,
    setImportFile,
    dragOver,
    setDragOver,
    fileInputRef,
    editingRoutine,
    routineScheduleKind,
    setRoutineScheduleKind,
    routineWeekdays,
    setRoutineWeekdays,
    routineTitleInput,
    setRoutineTitleInput,
    routineIcon,
    setRoutineIcon,
    routineIconFilter,
    setRoutineIconFilter,
    routineAssigneeIds,
    setRoutineAssigneeIds,
    routineSteps,
    setRoutineSteps,
    filteredRoutineIcons,
    historyChildFilter,
    setHistoryChildFilter,
    historyStatusFilter,
    setHistoryStatusFilter,
    historySearch,
    setHistorySearch,
    historySortBy,
    setHistorySortBy,
    historySortOrder,
    setHistorySortOrder,
    rescheduleDialog,
    setRescheduleDialog,
    perform,
    handleUnlock,
    addChild,
    deleteChild,
    startEditChore,
    cancelEditChore,
    saveChore,
    deleteChore,
    startEditRoutine,
    cancelEditRoutine,
    saveRoutine,
    deleteRoutine,
    createGroup,
    switchGroup,
    createRotation,
    stopRotation,
    startRenameGroup,
    saveGroupName,
    deleteGroup,
    review,
    undoChore,
    openReschedule,
    confirmReschedule,
    updateHouseholdSettings,
    changePin,
    handleExport,
    clearImportFile,
    handleImport,
    filteredHistory,
    children,
    rotatingGroupIds,
    childName,
    pending,
    familyToday,
    dayNames,
    formatScheduledDate,
    formatHistorySchedule,
    resolveTaskIcon,
    CHORE_ICONS,
  };
}

const ParentContext = createContext<ReturnType<typeof useParentController> | null>(null);

export function ParentControllerProvider({ children }: { children: ReactNode }) {
  const value = useParentController();
  return <ParentContext.Provider value={value}>{children}</ParentContext.Provider>;
}

export function useParentControllerContext() {
  const value = useContext(ParentContext);
  if (!value) throw new Error("Parent controller is unavailable");
  return value;
}
