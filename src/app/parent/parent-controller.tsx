"use client";

import { createContext, FormEvent, ReactNode, useContext, useMemo, useRef, useState } from "react";
import type { DashboardData } from "@/lib/dashboard";
import { CHORE_ICONS, resolveTaskIcon } from "@/lib/icons";
import { ChoreTemplate, useChoreManagement } from "./use-chore-management";
import { RoutineTemplate, useRoutineManagement } from "./use-routine-management";
import type { ChoreGroup, ChoreGroupRotation, Member } from "./parent-types";
import { useGroupManagement } from "./use-group-management";

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

type NavTab = "approvals" | "chores" | "routines" | "groups" | "family" | "settings";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const formatScheduledDate = (date: string | null) => date
  ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00.000Z`))
  : "No upcoming instance";

const formatHistorySchedule = (row: ReportRow) => {
  if (row.rescheduled_for) return `Rescheduled to ${formatScheduledDate(row.rescheduled_for)}`;
  if (row.is_flexible) return `Flexible · due ${formatScheduledDate(row.scheduled_for)}`;
  if (row.schedule_kind === "daily") return "Daily";
  if (row.schedule_kind === "weekdays") return "Weekdays (Mon–Fri)";
  if (row.schedule_kind === "once") return `One time · ${formatScheduledDate(row.scheduled_for)}`;
  return `Weekly · ${formatScheduledDate(row.scheduled_for)}`;
};

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
  const [choreTemplates, setChoreTemplates] = useState<ChoreTemplate[]>([]);
  const [routineTemplates, setRoutineTemplates] = useState<RoutineTemplate[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const chores = useChoreManagement({
    perform,
    request,
    setNotice,
    timezone: dashboard?.household.timezone ?? "America/Chicago",
    selectChores: () => setActiveTab("chores")
  });
  const routines = useRoutineManagement({
    perform,
    request,
    setNotice,
    timezone: dashboard?.household.timezone ?? "America/Chicago",
    selectRoutines: () => setActiveTab("routines")
  });
  const groupManagement = useGroupManagement({ perform, request, setNotice });

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
    ...groupManagement,
    choreTemplates,
    routineTemplates,
    dashboard,
    notice,
    busy,
    ...chores,
    ...routines,
    importFile,
    setImportFile,
    dragOver,
    setDragOver,
    fileInputRef,
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
