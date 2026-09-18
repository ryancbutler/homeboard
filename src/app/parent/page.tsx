"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  Check,
  CheckCheck,
  Clock3,
  Download,
  FileJson,
  FileUp,
  Home,
  KeyRound,
  Layers,
  ListChecks,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X
} from "lucide-react";
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
  steps: { id: string; position: number; title: string }[];
  assignees: { id: string; name: string }[];
};

type NavTab = "approvals" | "chores" | "routines" | "groups" | "family" | "settings";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const formatScheduledDate = (date: string | null) => date
  ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00.000Z`))
  : "No upcoming instance";

const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error((await response.json().catch(() => ({ error: "Unable to connect. Please try again." }))).error);
  return response.json();
};

export default function ParentPage() {
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  const [activeTab, setActiveTab] = useState<NavTab>("approvals");

  const [members, setMembers] = useState<Member[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [groups, setGroups] = useState<ChoreGroup[]>([]);
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

  const filteredChoreIcons = useMemo(() => {
    const q = choreIconFilter.trim().toLowerCase();
    if (!q) return CHORE_ICONS;
    return CHORE_ICONS.filter(
      (icon) =>
        icon.id.toLowerCase().includes(q) ||
        icon.label.toLowerCase().includes(q) ||
        (icon.category && icon.category.toLowerCase().includes(q)) ||
        (icon.keywords && icon.keywords.some((k) => k.toLowerCase().includes(q)))
    );
  }, [choreIconFilter]);
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
  const [routineSteps, setRoutineSteps] = useState<string[]>(["", "", ""]);
  const filteredRoutineIcons = useMemo(() => {
    const q = routineIconFilter.trim().toLowerCase();
    if (!q) return CHORE_ICONS;
    return CHORE_ICONS.filter(
      (icon) =>
        icon.id.toLowerCase().includes(q) ||
        icon.label.toLowerCase().includes(q) ||
        (icon.category && icon.category.toLowerCase().includes(q)) ||
        (icon.keywords && icon.keywords.some((k) => k.toLowerCase().includes(q)))
    );
  }, [routineIconFilter]);

  // History filtering & sorting state
  const [historyChildFilter, setHistoryChildFilter] = useState("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState("");
  const [historySortBy, setHistorySortBy] = useState<"date" | "chore" | "child" | "status">("date");
  const [historySortOrder, setHistorySortOrder] = useState<"asc" | "desc">("desc");
  const [rescheduleDialog, setRescheduleDialog] = useState<RescheduleDialog | null>(null);

  const load = async () => {
    const [nextMembers, nextReport, nextGroups, nextChores, nextRoutines, nextDashboard] = await Promise.all([
      request<Member[]>("/api/v1/members"),
      request<Report>("/api/v1/reports"),
      request<ChoreGroup[]>("/api/v1/chore-groups"),
      request<ChoreTemplate[]>("/api/v1/chore-templates"),
      request<RoutineTemplate[]>("/api/v1/routine-templates"),
      request<DashboardData>("/api/v1/dashboard"),
    ]);
    setMembers(nextMembers);
    setReport(nextReport);
    setGroups(nextGroups);
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
        schedule: {
          kind: schedule,
          startDate: dateInTimezone(new Date(), dashboard?.household.timezone ?? "America/Chicago"),
          weekdays: schedule === "weekly" ? (choreWeekdays.length ? choreWeekdays : [1]) : schedule === "weekdays" ? [1, 2, 3, 4, 5] : []
        }
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
    setRoutineSteps(routine.steps.length ? routine.steps.map((s) => s.title) : [""]);
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
    setRoutineSteps(["", "", ""]);
  };

  const saveRoutine = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const title = String(form.get("routineTitle"));
    const validSteps = routineSteps.map((s) => s.trim()).filter(Boolean);

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
        schedule: {
          kind: routineScheduleKind,
          startDate: dateInTimezone(new Date(), dashboard?.household.timezone ?? "America/Chicago"),
          weekdays: routineScheduleKind === "weekly" ? (routineWeekdays.length ? routineWeekdays : [1]) : routineScheduleKind === "weekdays" ? [1, 2, 3, 4, 5] : []
        }
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
    void perform("import", async () => {
      const text = await importFile.text();
      const json = JSON.parse(text);
      const res = await request<{
        success: boolean;
        importedChildren?: number;
        importedGroups: number;
        importedChores: number;
        importedRoutines: number;
      }>("/api/v1/backup", {
        method: "POST",
        body: JSON.stringify(json)
      });
      setNotice(`Import successful! Restored ${res.importedChildren ? `${res.importedChildren} children, ` : ""}${res.importedChores} chores, ${res.importedRoutines} routines, and ${res.importedGroups} groups.`);
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

  // Keep this memo before the PIN-lock return so hook ordering is identical
  // before and after authentication.
  const children = members.filter((member) => member.role === "child" && member.active);
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

  if (!authenticated) {
    return <main className="parent-shell pin-lock-shell">
      <header className="parent-header">
        <div>
          <a href="/" className="back"><ArrowLeft size={16} aria-hidden="true" />Household board</a>
          <p className="eyebrow">PARENT ACCESS ONLY</p>
          <h1>Parent mode</h1>
          <p>Enter your 4-digit PIN to manage chores, routines, family members, and settings.</p>
        </div>
      </header>
      <section className="management-card pin-card">
        <div className="pin-icon-wrap"><KeyRound size={28} aria-hidden="true" /></div>
        <h2>Enter Parent PIN</h2>
        <form onSubmit={handleUnlock} className="pin-form">
          <label>
            PIN
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              maxLength={20}
              placeholder="••••"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              autoFocus
            />
          </label>
          {pinError && <p className="pin-error" role="alert">{pinError}</p>}
          <button className="primary" disabled={busy === "unlock"}>
            {busy === "unlock" ? "Checking…" : "Unlock Parent mode"}
          </button>
        </form>
      </section>
    </main>;
  }

  return <main className="parent-shell">
    <header className="parent-header">
      <div>
        <a href="/" className="back"><ArrowLeft size={16} aria-hidden="true" />Household board</a>
        <p className="eyebrow">A LITTLE PLANNING, A HAPPIER HOME</p>
        <h1>Parent mode</h1>
        <p>Manage chores, routines, family members, and board displays.</p>
      </div>
    </header>

    {notice && <p className="parent-notice" role="status">{notice}</p>}

    <section className="family-pulse" aria-labelledby="family-pulse-title">
      <div className="family-pulse-head">
        <div>
          <p className="eyebrow">TODAY AT A GLANCE</p>
          <h2 id="family-pulse-title">Each child&apos;s day</h2>
        </div>
        {pending.length > 0 && (
          <div className="needs-attention" role="status">
            <Clock3 size={20} aria-hidden="true" />
            <div>
              <span>Needs attention</span>
              <strong>{pending.length} approval{pending.length === 1 ? "" : "s"} to review</strong>
            </div>
          </div>
        )}
      </div>

      {!familyToday ? <p className="form-hint">Loading today&apos;s family picture…</p> : (
        <>
          <div className="parent-progress-grid">
            {familyToday.children.map((child) => (
              <article className="parent-progress-card" key={child.id}>
                <div className="parent-progress-heading">
                  <span className="parent-progress-avatar" style={{ backgroundColor: child.color }} aria-hidden="true">
                    {child.name.slice(0, 1)}
                  </span>
                  <div>
                    <h3>{child.name}</h3>
                    <p>{child.openChores ? `${child.openChores} chore${child.openChores === 1 ? "" : "s"} left` : "Chores are done"}</p>
                  </div>
                </div>

                <div className="parent-progress-metric">
                  <div><span>Chores</span><strong>{child.totalChores ? `${child.finishedChores} / ${child.totalChores}` : "None today"}</strong></div>
                  {child.totalChores > 0 && <progress value={child.finishedChores} max={child.totalChores} aria-label={`${child.name}: ${child.finishedChores} of ${child.totalChores} chores finished`} />}
                </div>
                <div className="parent-progress-metric">
                  <div><span>Routine steps</span><strong>{child.totalRoutineSteps ? `${child.completedRoutineSteps} / ${child.totalRoutineSteps}` : "None today"}</strong></div>
                  {child.totalRoutineSteps > 0 && <progress value={child.completedRoutineSteps} max={child.totalRoutineSteps} aria-label={`${child.name}: ${child.completedRoutineSteps} of ${child.totalRoutineSteps} routine steps complete`} />}
                </div>
              </article>
            ))}
          </div>

          {familyToday.sharedOpenChores > 0 && (
            <p className="shared-work-callout"><Home size={18} aria-hidden="true" />{familyToday.sharedOpenChores} shared or unassigned chore{familyToday.sharedOpenChores === 1 ? "" : "s"} still open</p>
          )}
        </>
      )}
    </section>

    {/* Consolidated Layout with Left Sidebar Menu */}
    <div className="parent-layout">
      <nav className="parent-sidebar" aria-label="Parent sections">
        <div className="sidebar-brand">
          <p className="eyebrow">SECTIONS</p>
          <h2>Navigation</h2>
        </div>
        <ul className="sidebar-menu">
          <li>
            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === "approvals" ? "active" : ""}`}
              onClick={() => setActiveTab("approvals")}
            >
              <CheckCheck size={18} aria-hidden="true" />
              <span>Approvals & History</span>
              {pending.length > 0 && <span className="sidebar-badge">{pending.length}</span>}
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === "chores" ? "active" : ""}`}
              onClick={() => setActiveTab("chores")}
            >
              <ListChecks size={18} aria-hidden="true" />
              <span>Chores</span>
              <span className="sidebar-count">{choreTemplates.length}</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === "routines" ? "active" : ""}`}
              onClick={() => setActiveTab("routines")}
            >
              <Sparkles size={18} aria-hidden="true" />
              <span>Routines</span>
              <span className="sidebar-count">{routineTemplates.length}</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === "groups" ? "active" : ""}`}
              onClick={() => setActiveTab("groups")}
            >
              <Layers size={18} aria-hidden="true" />
              <span>Chore Groups</span>
              <span className="sidebar-count">{groups.length}</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === "family" ? "active" : ""}`}
              onClick={() => setActiveTab("family")}
            >
              <Users size={18} aria-hidden="true" />
              <span>Family (Children)</span>
              <span className="sidebar-count">{children.length}</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`sidebar-nav-item ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              <Settings size={18} aria-hidden="true" />
              <span>Board & PIN</span>
            </button>
          </li>
        </ul>
      </nav>

      <div className="parent-content-area">
        {/* TAB 1: Approvals & History */}
        {activeTab === "approvals" && (
          <>
            {/* Approvals */}
            <section className="management-card approval-card">
              <div className="history-head">
                <div>
                  <p className="eyebrow">READY FOR A HIGH FIVE</p>
                  <h2>Parent approvals <span className="count-badge">{pending.length}</span></h2>
                </div>
                <button className="secondary" disabled={Boolean(busy)} onClick={() => void perform("refresh", async () => {})}><RefreshCw size={16} aria-hidden="true" />Refresh</button>
              </div>
              {!dashboard ? <p className="form-hint">Loading approvals…</p> : !pending.length ? <p className="form-hint">All caught up. Finished chores that need your approval will appear here.</p> : pending.map((chore) => {
                const completedByName = members.find((member) => member.id === chore.completedBy)?.displayName ?? chore.assignee?.name ?? "a teammate";
                const completedTime = chore.completedAt
                  ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: dashboard.household.timezone }).format(new Date(chore.completedAt))
                  : null;

                return (
                  <article className="approval-item" key={chore.obligationId}>
                    <div>
                      <h3>{chore.title}</h3>
                      <p>
                        Completed by {completedByName}
                        {completedTime && <span className="approval-time"> · {completedTime}</span>}
                      </p>
                    </div>
                    <div className="approval-actions">
                      <button className="secondary" disabled={Boolean(busy)} onClick={() => review(chore.obligationId, "reject")}>Try again</button>
                      <button className="primary" disabled={Boolean(busy)} onClick={() => review(chore.obligationId, "approve")}><Check size={17} aria-hidden="true" />{busy === chore.obligationId ? "Saving…" : "Approve"}</button>
                    </div>
                  </article>
                );
              })}
            </section>

            {/* Chore History with Filter, Sort, and Undo */}
            <section className="management-card history">
              <div className="history-head">
                <div>
                  <p className="eyebrow">THE LITTLE WINS ADD UP</p>
                  <h2>Chore history</h2>
                  <p>Filter, sort, undo, or reschedule a missed chore below.</p>
                </div>
                <a className="csv" href="/api/v1/reports?format=csv">
                  <Download size={16} aria-hidden="true" />Download CSV
                </a>
              </div>

              {/* Filter and Sort Toolbar */}
              <div className="history-toolbar">
                <input
                  type="search"
                  className="search-input"
                  placeholder="Search by chore name or child…"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />

                <select
                  aria-label="Filter by child"
                  value={historyChildFilter}
                  onChange={(e) => setHistoryChildFilter(e.target.value)}
                >
                  <option value="all">All children</option>
                  {children.map((c) => (
                    <option key={c.id} value={c.displayName}>{c.displayName}</option>
                  ))}
                  <option value="Shared">Shared</option>
                </select>

                <select
                  aria-label="Filter by status"
                  value={historyStatusFilter}
                  onChange={(e) => setHistoryStatusFilter(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending approval</option>
                  <option value="open">Open</option>
                  <option value="missed">Missed</option>
                  <option value="rejected">Try again</option>
                </select>

                <select
                  aria-label="Sort by"
                  value={historySortBy}
                  onChange={(e) => setHistorySortBy(e.target.value as any)}
                >
                  <option value="date">Sort by Date</option>
                  <option value="chore">Sort by Chore</option>
                  <option value="child">Sort by Child</option>
                  <option value="status">Sort by Status</option>
                </select>

                <button
                  type="button"
                  className="history-sort-toggle"
                  title="Toggle ascending / descending"
                  onClick={() => setHistorySortOrder(historySortOrder === "asc" ? "desc" : "asc")}
                >
                  <ArrowUpDown size={14} aria-hidden="true" />
                  {historySortOrder === "asc" ? "Ascending" : "Descending"}
                </button>
              </div>

              <div className="history-table">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Date & Time</th>
                      <th scope="col">Chore</th>
                      <th scope="col">Child</th>
                      <th scope="col">Status</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.map((row, index) => {
                      const completedTime = row.completed_at
                        ? new Intl.DateTimeFormat("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            timeZone: dashboard?.household.timezone ?? "America/Chicago"
                          }).format(new Date(row.completed_at))
                        : null;

                      return (
                        <tr key={row.obligation_id || `${row.history_date}-${index}`}>
                          <td>
                            <div className="history-date-cell">
                              <span>{row.history_date}</span>
                              {completedTime && (
                                <span className="history-time-tag">
                                  <Clock3 size={11} aria-hidden="true" /> {completedTime}
                                </span>
                              )}
                            </div>
                          </td>
                          <td><strong>{row.title}</strong></td>
                          <td>{row.child ?? "Shared"}</td>
                          <td>
                            <span className={`pill ${row.status}`}>{row.status}</span>
                            {row.status === "completed" && completedTime && (
                              <small className="status-time-hint">{completedTime}</small>
                            )}
                            {row.status === "missed" && row.rescheduled_for && (
                              <small className="status-time-hint">Rescheduled for {row.rescheduled_for}</small>
                            )}
                          </td>
                          <td>
                            {row.obligation_id && (row.status === "completed" || row.status === "pending" || row.status === "rejected") && (
                              <button
                                type="button"
                                className="history-undo-button"
                                title={`Undo "${row.title}" for ${row.child ?? "child"}`}
                                disabled={Boolean(busy)}
                                onClick={() => undoChore(row.obligation_id, row.title)}
                              >
                                <RotateCcw size={13} aria-hidden="true" />
                                Undo
                              </button>
                            )}
                            {row.obligation_id && row.status === "missed" && !row.rescheduled_for && (
                              <button
                                type="button"
                                className="history-reschedule-button"
                                disabled={Boolean(busy)}
                                onClick={() => openReschedule(row)}
                              >
                                <RefreshCw size={13} aria-hidden="true" />
                                Reschedule
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredHistory.length === 0 && <p className="empty">No matching history entries found.</p>}
              </div>
            </section>
          </>
        )}

        {/* TAB 2: Chores Management */}
        {activeTab === "chores" && (
          <div className="parent-grid" id="chore-form-section">
            <section className="management-card">
              <p className="eyebrow">SHARE THE LOAD</p>
              <h2>{editingChore ? `Edit chore: ${editingChore.title}` : "New chore"}</h2>
              <form onSubmit={saveChore}>
                <label>
                  Chore name
                  <input
                    required
                    maxLength={120}
                    name="title"
                    key={editingChore?.id}
                    defaultValue={editingChore?.title ?? ""}
                    placeholder="Take out recycling"
                    onChange={(e) => setChoreTitleInput(e.target.value)}
                  />
                </label>
                <label>
                  Instructions
                  <input
                    name="instructions"
                    maxLength={500}
                    key={`inst-${editingChore?.id}`}
                    defaultValue={editingChore?.instructions ?? ""}
                    placeholder="A few details to help them out"
                  />
                </label>

                <div className="icon-selector-section">
                  <div className="icon-selector-header">
                    <span className="form-label-text">Chore icon</span>
                    <span className="icon-current-preview">
                      Preview:
                      <span className="icon-preview-badge">
                        {resolveTaskIcon(choreTitleInput || editingChore?.title || "Chore", choreIcon || null, 18)}
                      </span>
                      <small>{choreIcon ? CHORE_ICONS.find((i) => i.id === choreIcon)?.label : "Auto-detected"}</small>
                    </span>
                  </div>
                  <div className="icon-search-wrap">
                    <Search size={14} className="icon-search-lens" aria-hidden="true" />
                    <input
                      type="search"
                      className="icon-search-input"
                      placeholder="Search 60 icons (e.g. water, pets, shoes, school, food)..."
                      value={choreIconFilter}
                      onChange={(e) => setChoreIconFilter(e.target.value)}
                    />
                    {choreIconFilter && (
                      <button
                        type="button"
                        className="icon-search-clear"
                        onClick={() => setChoreIconFilter("")}
                        aria-label="Clear icon search"
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="icon-picker-grid">
                    {!choreIconFilter && (
                      <button
                        type="button"
                        className={`icon-picker-btn auto ${!choreIcon ? "selected" : ""}`}
                        onClick={() => setChoreIcon("")}
                        title="Auto-detect icon based on title"
                      >
                        <Sparkles size={16} aria-hidden="true" />
                        <span>Auto</span>
                      </button>
                    )}
                    {filteredChoreIcons.map(({ id, label, Icon }) => {
                      const isSelected = choreIcon === id;
                      return (
                        <button
                          type="button"
                          key={id}
                          className={`icon-picker-btn ${isSelected ? "selected" : ""}`}
                          onClick={() => setChoreIcon(isSelected ? "" : id)}
                          title={label}
                          aria-label={label}
                        >
                          <Icon size={18} aria-hidden="true" />
                        </button>
                      );
                    })}
                    {filteredChoreIcons.length === 0 && (
                      <div className="icon-picker-empty">
                        <span>No icons matching &ldquo;{choreIconFilter}&rdquo;</span>
                        <button
                          type="button"
                          className="text-btn"
                          onClick={() => setChoreIconFilter("")}
                        >
                          Show all icons
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="two-col">
                  <label>Schedule
                    <select name="schedule" value={choreScheduleKind} onChange={(e) => setChoreScheduleKind(e.target.value)}>
                      <option value="daily">Daily</option>
                      <option value="weekdays">Weekdays (Mon-Fri)</option>
                      <option value="weekly">Weekly</option>
                      <option value="once">One time</option>
                    </select>
                  </label>

                  {choreScheduleKind === "weekly" && (
                    <div className="weekday-selector">
                      <span className="form-label-text">Select weekly day(s)</span>
                      <div className="weekday-pills">
                        {dayNames.map((day, index) => {
                          const selected = choreWeekdays.includes(index);
                          return (
                            <button
                              type="button"
                              key={day}
                              className={`weekday-pill ${selected ? "selected" : ""}`}
                              onClick={() => {
                                if (selected) {
                                  if (choreWeekdays.length > 1) setChoreWeekdays(choreWeekdays.filter((d) => d !== index));
                                } else {
                                  setChoreWeekdays([...choreWeekdays, index].sort());
                                }
                              }}
                            >
                              {day.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {choreScheduleKind === "weekly" && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={choreIsFlexible}
                      onChange={(e) => setChoreIsFlexible(e.target.checked)}
                    />
                    Flexible completion (due by selected day, but can be done anytime during the week)
                  </label>
                )}

                <label>Chore group (optional)
                  <select
                    name="group"
                    value={choreSelectedGroupId}
                    onChange={(e) => {
                      setChoreSelectedGroupId(e.target.value);
                      if (e.target.value) setChoreAssigneeIds([]);
                    }}
                  >
                    <option value="">No group — assign directly</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} {group.assignedMemberId ? `· ${group.assignedMemberName}` : "(unassigned)"}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset disabled={Boolean(choreSelectedGroupId)}>
                  <legend>Assign to child</legend>
                  <div className="assignee-checkboxes">
                    {children.map((child) => (
                      <label className="check" key={child.id}>
                        <input
                          type="checkbox"
                          checked={choreAssigneeIds.includes(child.id)}
                          onChange={(e) => {
                            if (e.target.checked) setChoreAssigneeIds([...choreAssigneeIds, child.id]);
                            else setChoreAssigneeIds(choreAssigneeIds.filter((id) => id !== child.id));
                          }}
                        />
                        <i style={{ background: child.color }} />
                        {child.displayName}
                      </label>
                    ))}
                    {!children.length && <p className="form-hint">Add a child profile in the Family section first.</p>}
                  </div>

                  {!choreSelectedGroupId && !choreAssigneeIds.length && children.length > 0 && (
                    <p className="form-hint">No child selected — this chore will be open to any child.</p>
                  )}

                  {choreAssigneeIds.length > 1 && (
                    <div className="multi-child-policy">
                      <label className="radio-label">
                        <input
                          type="radio"
                          name="policyChoice"
                          checked={chorePolicy === "every"}
                          onChange={() => setChorePolicy("every")}
                        />
                        Every child gets their own copy
                      </label>
                      <label className="radio-label">
                        <input
                          type="radio"
                          name="policyChoice"
                          checked={chorePolicy === "any"}
                          onChange={() => setChorePolicy("any")}
                        />
                        Shared (first child to complete finishes it)
                      </label>
                    </div>
                  )}
                </fieldset>

                <label className="check">
                  <input
                    name="approval"
                    type="checkbox"
                    checked={choreApprovalRequired}
                    onChange={(e) => setChoreApprovalRequired(e.target.checked)}
                  />
                  Require parent approval
                </label>

                <div className="form-actions">
                  <button className="primary" disabled={busy === "chore-save"}>
                    {busy === "chore-save" ? "Saving…" : editingChore ? "Update chore" : "Create chore"}
                  </button>
                  {editingChore && (
                    <button type="button" className="secondary" onClick={cancelEditChore}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>

            {/* Existing Chores List */}
            <section className="management-card">
              <p className="eyebrow">ACTIVE CHORES</p>
              <h2>Existing chores ({choreTemplates.length})</h2>
              <div className="template-list">
                {choreTemplates.map((chore) => (
                  <div className="template-row" key={chore.id}>
                    <div className="template-item-main">
                      <span className="template-icon-badge" aria-hidden="true">
                        {resolveTaskIcon(chore.title, chore.icon, 18)}
                      </span>
                      <div>
                        <strong>{chore.title}</strong>
                        <small>
                          {chore.scheduleKind}
                          {chore.scheduleKind === "weekly" && chore.weekdays && ` (${chore.weekdays.map((w) => dayNames[w]?.slice(0, 3)).join(", ")})`}
                          {chore.isFlexible && " · Flexible"} · {
                            chore.groupId
                              ? `Group: ${groups.find((g) => g.id === chore.groupId)?.name ?? "Group"}`
                              : chore.assigneeIds.length
                              ? chore.assigneeIds.map((id) => members.find((m) => m.id === id)?.displayName).filter(Boolean).join(", ")
                              : "Unassigned"
                          }
                          {chore.approvalRequired && " · Approval required"}
                        </small>
                        <small className="template-scheduled">Scheduled: {formatScheduledDate(chore.nextScheduledFor)}</small>
                      </div>
                    </div>
                    <div className="template-actions">
                      <button
                        type="button"
                        className="icon-action-button"
                        title="Edit chore"
                        onClick={() => startEditChore(chore)}
                      >
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-action-button danger"
                        title="Delete chore"
                        onClick={() => deleteChore(chore.id, chore.title)}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
                {!choreTemplates.length && <p className="form-hint">No chores created yet.</p>}
              </div>
            </section>
          </div>
        )}

        {/* TAB 3: Routines Management */}
        {activeTab === "routines" && (
          <div className="parent-grid" id="routine-form-section">
            <section className="management-card">
              <p className="eyebrow">HABITS & ROUTINES</p>
              <h2>{editingRoutine ? `Edit routine: ${editingRoutine.title}` : "New daily routine"}</h2>
              <form onSubmit={saveRoutine}>
                <label>Routine title
                  <input required maxLength={120} name="routineTitle" value={routineTitleInput} onChange={(e) => setRoutineTitleInput(e.target.value)} placeholder="e.g. Morning routine, Bedtime checklist" />
                </label>

                <div className="icon-selector-section">
                  <div className="icon-selector-header">
                    <span className="form-label-text">Routine icon</span>
                    <span className="icon-current-preview">
                      Preview:
                      <span className="icon-preview-badge">{resolveTaskIcon(routineTitleInput || "Routine", routineIcon || null, 18)}</span>
                      <small>{routineIcon ? CHORE_ICONS.find((i) => i.id === routineIcon)?.label : "Auto-detected"}</small>
                    </span>
                  </div>
                  <div className="icon-search-wrap">
                    <Search size={14} className="icon-search-lens" aria-hidden="true" />
                    <input type="search" className="icon-search-input" placeholder="Search routine icons..." value={routineIconFilter} onChange={(e) => setRoutineIconFilter(e.target.value)} />
                    {routineIconFilter && <button type="button" className="icon-search-clear" onClick={() => setRoutineIconFilter("")} aria-label="Clear icon search"><X size={13} aria-hidden="true" /></button>}
                  </div>
                  <div className="icon-picker-grid">
                    {!routineIconFilter && (
                      <button type="button" className={`icon-picker-btn auto ${!routineIcon ? "selected" : ""}`} onClick={() => setRoutineIcon("")} title="Auto-detect icon based on title">
                        <Sparkles size={16} aria-hidden="true" /><span>Auto</span>
                      </button>
                    )}
                    {filteredRoutineIcons.map(({ id, label, Icon }) => {
                      const isSelected = routineIcon === id;
                      return <button type="button" key={id} className={`icon-picker-btn ${isSelected ? "selected" : ""}`} onClick={() => setRoutineIcon(isSelected ? "" : id)} title={label} aria-label={label}><Icon size={18} aria-hidden="true" /></button>;
                    })}
                    {filteredRoutineIcons.length === 0 && (
                      <div className="icon-picker-empty"><span>No icons matching &ldquo;{routineIconFilter}&rdquo;</span><button type="button" className="text-btn" onClick={() => setRoutineIconFilter("")}>Show all icons</button></div>
                    )}
                  </div>
                </div>

                <div className="two-col">
                  <label>Schedule
                    <select name="routineSchedule" value={routineScheduleKind} onChange={(e) => setRoutineScheduleKind(e.target.value)}>
                      <option value="daily">Daily</option>
                      <option value="weekdays">Weekdays (Mon-Fri)</option>
                      <option value="weekly">Weekly</option>
                      <option value="once">One time</option>
                    </select>
                  </label>

                  {routineScheduleKind === "weekly" && (
                    <div className="weekday-selector">
                      <span className="form-label-text">Select weekly day(s)</span>
                      <div className="weekday-pills">
                        {dayNames.map((day, index) => {
                          const selected = routineWeekdays.includes(index);
                          return (
                            <button
                              type="button"
                              key={day}
                              className={`weekday-pill ${selected ? "selected" : ""}`}
                              onClick={() => {
                                if (selected) {
                                  if (routineWeekdays.length > 1) setRoutineWeekdays(routineWeekdays.filter((d) => d !== index));
                                } else {
                                  setRoutineWeekdays([...routineWeekdays, index].sort());
                                }
                              }}
                            >
                              {day.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <fieldset>
                  <legend>Assign whole routine to</legend>
                  <div className="assignee-checkboxes">
                    {children.map((child) => (
                      <label className="check" key={child.id}>
                        <input
                          type="checkbox"
                          checked={routineAssigneeIds.includes(child.id)}
                          onChange={(e) => {
                            if (e.target.checked) setRoutineAssigneeIds([...routineAssigneeIds, child.id]);
                            else setRoutineAssigneeIds(routineAssigneeIds.filter((id) => id !== child.id));
                          }}
                        />
                        <i style={{ background: child.color }} />
                        {child.displayName}
                      </label>
                    ))}
                  </div>
                  <p className="form-hint">
                    {children.length
                      ? (routineAssigneeIds.length
                          ? "Assigned children will each get their own personal routine checklist."
                          : "No child selected — routine will be available for all children.")
                      : "Add a child profile in the Family section first."}
                  </p>
                </fieldset>

                <fieldset>
                  <legend>Routine steps</legend>
                  <div className="dynamic-steps">
                    {routineSteps.map((step, idx) => (
                      <div className="step-input-row" key={idx}>
                        <span className="step-number">{idx + 1}</span>
                        <input
                          type="text"
                          required
                          maxLength={120}
                          value={step}
                          placeholder={`Step ${idx + 1} (e.g. Brush teeth)`}
                          onChange={(e) => {
                            const updated = [...routineSteps];
                            updated[idx] = e.target.value;
                            setRoutineSteps(updated);
                          }}
                        />
                        {routineSteps.length > 1 && (
                          <button
                            type="button"
                            className="icon-action-button danger"
                            onClick={() => setRoutineSteps(routineSteps.filter((_, i) => i !== idx))}
                            title="Remove step"
                          >
                            <X size={15} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="secondary add-step-button"
                      onClick={() => setRoutineSteps([...routineSteps, ""])}
                    >
                      <Plus size={15} aria-hidden="true" /> Add step
                    </button>
                  </div>
                </fieldset>

                <div className="form-actions">
                  <button className="primary" disabled={busy === "routine-save"}>
                    {busy === "routine-save" ? "Saving…" : editingRoutine ? "Update routine" : "Create routine"}
                  </button>
                  {editingRoutine && (
                    <button type="button" className="secondary" onClick={cancelEditRoutine}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>

            {/* Existing Routines List */}
            <section className="management-card">
              <p className="eyebrow">ACTIVE ROUTINES</p>
              <h2>Existing routines ({routineTemplates.length})</h2>
              <div className="template-list">
                {routineTemplates.map((routine) => (
                  <div className="template-row" key={routine.id}>
                    <div className="template-item-main">
                      <span className="template-icon-badge" aria-hidden="true">{resolveTaskIcon(routine.title, routine.icon, 18)}</span>
                      <div>
                        <strong>{routine.title}</strong>
                        <small>
                          {routine.scheduleKind}
                          {routine.scheduleKind === "weekly" && routine.weekdays && ` (${routine.weekdays.map((w) => dayNames[w]?.slice(0, 3)).join(", ")})`}
                          {" · "}{routine.steps.length} step{routine.steps.length === 1 ? "" : "s"} · Assigned to: {
                            routine.assignees.length ? routine.assignees.map((a) => a.name).join(", ") : "Unassigned"
                          }
                        </small>
                        <ol className="template-step-preview">
                          {routine.steps.slice(0, 3).map((s) => (
                            <li key={s.id}>{s.title}</li>
                          ))}
                          {routine.steps.length > 3 && <li>+{routine.steps.length - 3} more</li>}
                        </ol>
                      </div>
                    </div>
                    <div className="template-actions">
                      <button
                        type="button"
                        className="icon-action-button"
                        title="Edit routine"
                        onClick={() => startEditRoutine(routine)}
                      >
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-action-button danger"
                        title="Delete routine"
                        onClick={() => deleteRoutine(routine.id, routine.title)}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
                {!routineTemplates.length && <p className="form-hint">No routines created yet.</p>}
              </div>
            </section>
          </div>
        )}

        {/* TAB 4: Chore Groups */}
        {activeTab === "groups" && (
          <section className="management-card group-card">
            <p className="eyebrow">TAKE TURNS, TOGETHER</p>
            <h2>Chore groups</h2>
            <p className="integration-copy">Create groups to bundle related chores. Assign a child when ready, or remove them to unassign.</p>
            <div className="group-list">
              {groups.map((group) => (
                <div className="group-row" key={group.id}>
                  <div>
                    <strong>{group.name}</strong>
                    <small>
                      {group.templateCount} chore{group.templateCount === 1 ? "" : "s"} · currently {group.assignedMemberId ? group.assignedMemberName : <em className="unassigned-text">Unassigned</em>}
                    </small>
                  </div>
                  <div className="group-controls">
                    <select
                      aria-label={`Assign ${group.name}`}
                      value={group.assignedMemberId ?? ""}
                      disabled={Boolean(busy)}
                      onChange={(event) => switchGroup(group.id, event.target.value)}
                    >
                      <option value="">Unassigned (No child)</option>
                      {children.map((child) => (
                        <option key={child.id} value={child.id}>{child.displayName}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="group-delete-button"
                      aria-label={`Delete group ${group.name}`}
                      title={`Delete ${group.name}`}
                      disabled={Boolean(busy)}
                      onClick={() => deleteGroup(group.id, group.name)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
              {!groups.length && <p className="form-hint">No groups yet. Create a group below by name.</p>}
            </div>
            <form className="group-create" onSubmit={createGroup}>
              <label>Group name<input required name="groupName" placeholder="e.g. Upstairs chores" /></label>
              <button className="primary" disabled={Boolean(busy)}>{busy === "group" ? "Creating…" : "Create group"}</button>
            </form>
          </section>
        )}

        {/* TAB 5: Family (Children Only) */}
        {activeTab === "family" && (
          <section className="management-card">
            <p className="eyebrow">YOUR HOME TEAM</p>
            <h2>Children</h2>
            <p className="integration-copy">Add and manage children in your household. Parents manage everything through PIN protection.</p>
            <div className="member-list">
              {children.map((child) => (
                <div className="member" key={child.id}>
                  <i style={{ background: child.color }} />
                  <span>{child.displayName}</span>
                  <small>Child</small>
                  <button
                    type="button"
                    className="member-delete-button"
                    aria-label={`Delete child ${child.displayName}`}
                    title={`Delete ${child.displayName}`}
                    disabled={Boolean(busy)}
                    onClick={() => deleteChild(child.id, child.displayName)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
              {!children.length && <p className="form-hint">No children added yet. Add one below!</p>}
            </div>
            <form className="add-child" onSubmit={addChild}>
              <label>Child name<input required name="name" placeholder="First name" /></label>
              <label>Color<input name="color" type="color" defaultValue="#8B71CB" /></label>
              <button className="primary" disabled={Boolean(busy)}>{busy === "child" ? "Adding…" : "Add child"}</button>
            </form>
          </section>
        )}

        {/* TAB 6: Settings & PIN */}
        {activeTab === "settings" && (
          <div className="settings-stack">
            {/* Card 1: Board & Security */}
            <section className="management-card">
              <p className="eyebrow">CUSTOMIZE & PROTECT</p>
              <h2>Board & Security</h2>
              <p className="form-hint">Customize your board display and update parent access.</p>

              {dashboard && (
                <form onSubmit={updateHouseholdSettings} className="settings-section-form">
                  <div className="two-col">
                    <label>
                      Family name
                      <input required maxLength={100} name="householdName" defaultValue={dashboard.household.name} placeholder="e.g. The Johnson Home" />
                    </label>
                    <label>
                      Sub-saying
                      <input required maxLength={200} name="subheading" defaultValue={dashboard.household.subheading} placeholder="e.g. Your people. Your little wins. Your home, together." />
                    </label>
                  </div>
                  <div className="settings-toggles">
                    <label className="check">
                      <input name="showBanner" type="checkbox" defaultChecked={dashboard.household.showBanner} />
                      Show big hero banner on board
                    </label>
                  </div>
                  <div className="form-actions">
                    <button className="primary" disabled={busy === "household-settings"}>
                      {busy === "household-settings" ? "Saving…" : "Save board settings"}
                    </button>
                  </div>
                </form>
              )}

              <hr className="settings-divider" />

              <div className="settings-subgroup">
                <h3>Parent PIN</h3>
                <p className="form-hint">Change the 4-digit PIN required to unlock Parent mode.</p>
                <form onSubmit={changePin} className="pin-inline-row">
                  <label className="inline-label">
                    <span>New PIN</span>
                    <input required type="password" name="newPin" maxLength={20} placeholder="New 4-digit PIN" />
                  </label>
                  <button className="secondary" disabled={busy === "change-pin"}>
                    <KeyRound size={15} aria-hidden="true" />
                    {busy === "change-pin" ? "Updating…" : "Update PIN"}
                  </button>
                </form>
              </div>
            </section>

            {/* Card 2: Backup & Restore */}
            <section className="management-card">
              <p className="eyebrow">DATA MANAGEMENT</p>
              <h2>Export & Import Setup</h2>
              <p className="form-hint">
                Safely backup or restore your children, chores, routines, checklist steps, and groups.
              </p>

              <div className="backup-streamlined">
                <div className="backup-row">
                  <div>
                    <strong>Export setup</strong>
                    <p className="form-hint">Download a complete JSON backup file containing all children, chores, routines, steps, and groups.</p>
                  </div>
                  <button type="button" className="secondary" onClick={handleExport}>
                    <Download size={16} aria-hidden="true" />
                    Download JSON Backup
                  </button>
                </div>

                <hr className="settings-divider" />

                <div className="backup-row">
                  <div>
                    <strong>Import setup</strong>
                    <p className="form-hint">Upload a JSON backup file to restore into this household.</p>
                  </div>
                  <form onSubmit={handleImport} className="import-inline-form">
                    <div
                      className={`file-picker-control ${dragOver ? "drag-over" : ""} ${importFile ? "has-file" : ""}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file && (file.type === "application/json" || file.name.endsWith(".json"))) {
                          setImportFile(file);
                        }
                      }}
                    >
                      <input
                        ref={fileInputRef}
                        id="backup-file-input"
                        type="file"
                        accept=".json,application/json"
                        required
                        className="file-input-hidden"
                        onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                      />
                      <label
                        htmlFor="backup-file-input"
                        className="file-picker-trigger"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                      >
                        <FileUp size={15} aria-hidden="true" />
                        <span>{importFile ? "Change file" : "Choose file"}</span>
                      </label>
                      <div className="file-picker-status">
                        {importFile ? (
                          <div className="file-selected-info">
                            <FileJson size={15} className="file-badge-icon" aria-hidden="true" />
                            <span className="file-selected-name" title={importFile.name}>{importFile.name}</span>
                            <span className="file-selected-size">({(importFile.size / 1024).toFixed(1)} KB)</span>
                            <button
                              type="button"
                              className="file-clear-btn"
                              aria-label="Remove selected file"
                              title="Remove file"
                              onClick={clearImportFile}
                            >
                              <X size={14} aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <span className="file-placeholder">No file chosen</span>
                        )}
                      </div>
                    </div>
                    <button className="primary" disabled={!importFile || busy === "import"}>
                      <Upload size={16} aria-hidden="true" />
                      {busy === "import" ? "Importing…" : "Upload & Import"}
                    </button>
                  </form>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>

    <footer className="board-footer">
      <span><Home size={16} aria-hidden="true" />homeboard</span>
      <p>A happy home is a team effort.</p>
    </footer>
    {rescheduleDialog && (
      <div className="reschedule-backdrop" role="presentation" onMouseDown={() => !busy && setRescheduleDialog(null)}>
        <section className="reschedule-dialog" role="dialog" aria-modal="true" aria-labelledby="reschedule-title" aria-describedby="reschedule-description" onMouseDown={(event) => event.stopPropagation()}>
          <div className="reschedule-dialog-head">
            <div>
              <p className="eyebrow">ONE-TIME CHANGE</p>
              <h2 id="reschedule-title">Reschedule {rescheduleDialog.title}</h2>
            </div>
            <button type="button" className="reschedule-close" aria-label="Close reschedule dialog" disabled={Boolean(busy)} onClick={() => setRescheduleDialog(null)}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <p id="reschedule-description" className="reschedule-copy">
            Choose an available day for {rescheduleDialog.child ?? "this chore"}. The original missed entry stays in history, and the original due time carries over.
          </p>
          {!rescheduleDialog.days ? (
            <p className="form-hint" role="status">Checking this week&apos;s available days…</p>
          ) : (
            <div className="reschedule-days" aria-label="Available days through Sunday">
              {rescheduleDialog.days.map((day) => (
                <button key={day.date} type="button" className={`reschedule-day${rescheduleDialog.selectedDate === day.date ? " selected" : ""}`} disabled={!day.available || Boolean(busy)} aria-pressed={rescheduleDialog.selectedDate === day.date} onClick={() => setRescheduleDialog((current) => current ? { ...current, selectedDate: day.date } : current)}>
                  <span>{day.label}</span>
                  <small>{day.available ? "Available" : day.reason}</small>
                </button>
              ))}
            </div>
          )}
          <div className="reschedule-actions">
            <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => setRescheduleDialog(null)}>Cancel</button>
            <button type="button" className="primary" disabled={!rescheduleDialog.selectedDate || Boolean(busy)} onClick={confirmReschedule}>
              <RefreshCw size={16} aria-hidden="true" />
              {busy?.startsWith("reschedule-") ? "Rescheduling…" : "Reschedule chore"}
            </button>
          </div>
        </section>
      </div>
    )}
  </main>;
}
