"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bath,
  Bed,
  BookOpen,
  Calendar,
  Car,
  Cat,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock3,
  Dog,
  Home,
  Leaf,
  Moon,
  RefreshCw,
  RotateCcw,
  Settings2,
  Shirt,
  Smile,
  Sparkles,
  Star,
  Sunrise,
  Trash2,
  Users,
  Utensils,
  X
} from "lucide-react";
import type { DashboardData } from "@/lib/dashboard";
import { resolveTaskIcon } from "@/lib/icons";

type Person = DashboardData["children"][number];
type Notice = { title: string; detail?: string; undoChoreId?: string; undoChoreTitle?: string } | null;
type Chooser = { type: "chore"; id: string; title: string; children: Pick<Person, "id" | "name" | "color">[] } |
  { type: "routine"; runId: string; stepId: string; completed: boolean; children: Pick<Person, "id" | "name" | "color">[] };

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error((await response.json().catch(() => ({ error: "Request failed" }))).error);
  const value = await response.json();
  if (response.headers.get("X-Homeboard-Offline") === "true") throw new Error("You're offline. Reconnect to update your board.");
  return value;
};
const initials = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2);

const formatScheduleBadge = (chore: { scheduleKind?: string; weekdays?: number[]; isFlexible?: boolean; scheduledFor: string }) => {
  if (chore.isFlexible) {
    const day = new Date(`${chore.scheduledFor}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" });
    return `Flexible (by ${day})`;
  }
  switch (chore.scheduleKind) {
    case "daily":
      return "Daily";
    case "weekdays":
      return "Weekdays";
    case "weekly": {
      const days = (chore.weekdays ?? []).map((w) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][w]).filter(Boolean);
      return days.length ? `Weekly (${days.join(", ")})` : "Weekly";
    }
    case "once":
      return "One time";
    default:
      return chore.scheduleKind ? chore.scheduleKind.charAt(0).toUpperCase() + chore.scheduleKind.slice(1) : "Scheduled";
  }
};

const getTaskIcon = (title: string, icon?: string | null) => resolveTaskIcon(title, icon);
const PRAISE_MESSAGES = [
  "All chores handled! Great job!",
  "You crushed today's list—awesome work!",
  "Big win! Everything that matters is done.",
  "Way to show up for the team!",
  "Look at that—your hard work paid off!",
  "All set! Enjoy the rest of your day.",
];
const CONFETTI = Array.from({ length: 144 }, (_, index) => index);
const choreBelongsTo = (chore: DashboardData["chores"][number], childId: string) =>
  chore.assignee?.id === childId || (!chore.assignee && chore.allowedChildren.some((child) => child.id === childId));

export function Homeboard({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState<DashboardData | null>(initialData);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [chooser, setChooser] = useState<Chooser | null>(null);
  const [collapsedCompleted, setCollapsedCompleted] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const praiseByChild = useRef<Record<string, string>>({});
  const confettiTimers = useRef<Record<string, number>>({});
  const [celebratingChildren, setCelebratingChildren] = useState<Record<string, boolean>>({});

  // Apply the mutation response before requesting a new dashboard snapshot.  Some
  // display devices can take noticeably longer to receive that follow-up request,
  // so relying on refresh alone leaves the tapped chore looking in-progress.
  const updateChore = useCallback((id: string, changes: Partial<DashboardData["chores"][number]>) => {
    setData((previous) => previous ? {
      ...previous,
      chores: previous.chores.map((chore) => chore.obligationId === id ? { ...chore, ...changes } : chore)
    } : previous);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/v1/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error("Your board couldn't connect. Please try again.");
      const next = await response.json() as DashboardData;
      setData(next);
      setOffline(response.headers.get("X-Homeboard-Offline") === "true");
      setError(null);
    } catch (cause) {
      setOffline(true);
      setError(cause instanceof Error ? cause.message : "Unable to refresh the household dashboard.");
    } finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 30_000);
    const wake = () => void refresh();
    const disconnect = () => setOffline(true);
    window.addEventListener("online", wake);
    window.addEventListener("offline", disconnect);
    return () => { window.clearInterval(timer); window.removeEventListener("online", wake); window.removeEventListener("offline", disconnect); };
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 15_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (chooser && !dialog.current?.open) dialog.current?.showModal();
    if (!chooser && dialog.current?.open) dialog.current.close();
  }, [chooser]);

  const today = useMemo(() => data
    ? new Intl.DateTimeFormat("en-CA", { timeZone: data.household.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
    : "", [data?.household.timezone]);
  const isOptionalFlexible = useCallback((chore: DashboardData["chores"][number]) =>
    Boolean(chore.isFlexible && chore.scheduledFor > today), [today]);
  const celebrateChild = useCallback((childId: string) => {
    praiseByChild.current[childId] = PRAISE_MESSAGES[Math.floor(Math.random() * PRAISE_MESSAGES.length)];
    window.clearTimeout(confettiTimers.current[childId]);
    setCelebratingChildren((current) => ({ ...current, [childId]: true }));
    confettiTimers.current[childId] = window.setTimeout(() => {
      setCelebratingChildren((current) => ({ ...current, [childId]: false }));
    }, 5200);
  }, []);
  const isFinalRequiredChoreForChild = useCallback((id: string, childId: string) => {
    const requiredChores = (data?.chores.filter((chore) => choreBelongsTo(chore, childId)) ?? [])
      .filter((chore) => !isOptionalFlexible(chore));
    return requiredChores.some((chore) => chore.obligationId === id) &&
      requiredChores.every((chore) => chore.obligationId === id || chore.status === "completed");
  }, [data, isOptionalFlexible]);
  const openCount = useMemo(() => data?.chores.filter((chore) =>
    !isOptionalFlexible(chore) && (chore.status === "open" || chore.status === "rejected")
  ).length ?? 0, [data, isOptionalFlexible]);
  const pendingCount = data?.chores.filter((chore) => !isOptionalFlexible(chore) && chore.status === "pending").length ?? 0;
  const childProgress = useMemo(() => (data?.children ?? []).map((child) => {
    const chores = (data?.chores.filter((chore) => choreBelongsTo(chore, child.id)) ?? []).filter((chore) => !isOptionalFlexible(chore));
    const routines = data?.routines.filter((routine) => {
      if (routine.ownerId) return routine.ownerId === child.id;
      const hasAssignedVersion = data?.routines.some((other) => other.title === routine.title && other.ownerId === child.id);
      return !hasAssignedVersion;
    }) ?? [];
    const choresDone = chores.filter((chore) => chore.status === "completed" || chore.status === "pending").length;
    const choresLeft = chores.filter((chore) => chore.status === "open" || chore.status === "rejected").length;
    const pending = chores.filter((chore) => chore.status === "pending").length;
    const routineDone = routines.reduce((count, routine) => count + routine.completedSteps, 0);
    const routineTotal = routines.reduce((count, routine) => count + routine.totalSteps, 0);
    const actionsLeft = choresLeft + routineTotal - routineDone;
    return { child, actionsLeft, choresDone, choresTotal: chores.length, pending, routineDone, routineTotal };
  }), [data, isOptionalFlexible]);
  const sharedOpenCount = useMemo(() => data?.chores.filter((chore) =>
    !isOptionalFlexible(chore) && !chore.assignee && chore.policy === "any" && (chore.status === "open" || chore.status === "rejected")
  ).length ?? 0, [data, isOptionalFlexible]);
  const allClearByChild = useMemo(() => Object.fromEntries((data?.children ?? []).map((child) => {
    const requiredChores = (data?.chores.filter((chore) => choreBelongsTo(chore, child.id)) ?? []).filter((chore) => !isOptionalFlexible(chore));
    const routines = data?.routines.filter((routine) => {
      if (routine.ownerId) return routine.ownerId === child.id;
      return !data?.routines.some((other) => other.title === routine.title && other.ownerId === child.id);
    }) ?? [];
    return [child.id, requiredChores.every((chore) => chore.status === "completed") && routines.every((routine) => routine.steps.every((step) => step.completed))];
  })), [data, isOptionalFlexible]);
  useEffect(() => () => {
    Object.values(confettiTimers.current).forEach((timer) => window.clearTimeout(timer));
  }, []);

  const praiseFor = (childId: string) => praiseByChild.current[childId] ??=
    PRAISE_MESSAGES[Math.floor(Math.random() * PRAISE_MESSAGES.length)];

  const hideBanner = async () => {
    setData((prev) => prev ? { ...prev, household: { ...prev.household, showBanner: false } } : null);
    try {
      await api("/api/v1/household", { method: "PATCH", body: JSON.stringify({ showBanner: false }) });
    } catch {
      // If client is in guest/device mode, state update is still applied locally
    }
  };

  const completeChore = async (id: string, actorId: string, childId: string, choreTitle?: string) => {
    if (busy || offline) return;
    setBusy(id);
    try {
      const result = await api<{ status?: string; approval_status?: string }>(`/api/v1/obligations/${id}/complete`, {
        method: "POST",
        headers: { "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ actorId })
      });
      const status = result.status ?? "completed";
      updateChore(id, {
        status,
        approvalStatus: result.approval_status ?? (status === "pending" ? "pending" : "approved"),
        completedBy: actorId,
        completedAt: new Date().toISOString()
      });
      if (status === "completed" && isFinalRequiredChoreForChild(id, childId)) celebrateChild(childId);
      setNotice({
        title: status === "pending" ? "Nice work! Sent for parent approval." : "One less chore. One more little win!",
        undoChoreId: id,
        undoChoreTitle: choreTitle
      });
      setChooser(null);
      void refresh();
    } catch (cause) { setNotice({ title: "Couldn't save that", detail: cause instanceof Error ? cause.message : undefined }); }
    finally { setBusy(null); }
  };

  const undoChore = async (choreId: string) => {
    if (busy || offline) return;
    setBusy(choreId);
    try {
      const result = await api<{ status?: string }>(`/api/v1/obligations/${choreId}/undo`, { method: "POST" });
      updateChore(choreId, {
        status: result.status ?? "open",
        approvalStatus: "not_required",
        completedBy: null,
        completedAt: null
      });
      setNotice({ title: "Chore restored back to your list!" });
      void refresh();
    } catch (cause) {
      setNotice({ title: "Couldn't undo", detail: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const toggleStep = async (runId: string, stepId: string, actorId: string | undefined, completed: boolean) => {
    if (busy || offline) return;
    setBusy(stepId);
    try {
      await api(`/api/v1/routine-runs/${runId}/steps/${stepId}`, {
        method: "POST",
        body: JSON.stringify({ actorId: actorId || undefined, completed })
      });
      setChooser(null);
      await refresh();
    } catch (cause) { setNotice({ title: "Couldn't update routine", detail: cause instanceof Error ? cause.message : undefined }); }
    finally { setBusy(null); }
  };

  if (!data) return <main className="loading-shell"><div className="brand-mark"><Home aria-hidden="true" /></div><h1>Homeboard</h1><p role="status">{error ?? "Getting your family's day ready…"}</p>{error && <button className="primary" disabled={refreshing} onClick={() => void refresh()}>{refreshing ? "Connecting…" : "Try again"}</button>}</main>;

  return <main className="board" id="main">
    {Object.values(celebratingChildren).some(Boolean) && (
      <div className="celebration-confetti" aria-hidden="true">
        {CONFETTI.map((piece) => <span key={piece} style={{ "--confetti-x": `${(piece * 37) % 100}%`, "--confetti-y": `${((piece * 47) % 130) - 20}dvh`, "--confetti-delay": `${(piece % 12) * 65}ms`, "--confetti-color": ["#f3b64d", "#e76f83", "#6b9ac4", "#72a36a", "#9b77c6"][piece % 5] } as React.CSSProperties} />)}
      </div>
    )}
    <a href="#chores" className="skip-link">Skip to chores</a>
    <header className="board-header">
      <a href="/" className="brand"><span className="brand-mark"><Home size={14} aria-hidden="true" /></span>homeboard<span className="brand-tag">a little more together</span></a>
      <div className="header-actions"><span className="connection"><i className={offline ? "offline" : ""} />{offline ? "Offline" : "All synced"}</span><a href="/parent" className="parent-link"><Settings2 size={13} aria-hidden="true" />Parent mode</a></div>
    </header>

    <section className="welcome">
      <div>
        <p className="eyebrow">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: data.household.timezone }).format(new Date())}</p>
        <h1>{data.household.name}<span className="heading-spark"><Sparkles aria-hidden="true" /></span></h1>
        <p>{data.household.subheading}</p>
      </div>
      <button className="refresh-button" disabled={refreshing} onClick={() => void refresh()}><RefreshCw size={16} className={refreshing ? "spinning" : ""} aria-hidden="true" />{refreshing ? "Refreshing…" : "Refresh board"}</button>
    </section>
    {offline && <p className="offline-banner" role="status">You're offline. This is your last saved board. Reconnect to check things off.</p>}

    {data.household.showBanner && (
      <section className="hero">
        <button className="banner-dismiss" aria-label="Hide banner" onClick={() => void hideBanner()} title="Hide banner">
          <X size={18} aria-hidden="true" />
        </button>
        <div className="hero-copy">
          <p className="hero-kicker"><Star size={15} aria-hidden="true" /> A LITTLE TEAMWORK GOES A LONG WAY</p>
          <h2>{openCount ? <>Little chores.<br /><span>Big team energy.</span></> : <>Look at you go.<br /><span>Chores, handled!</span></>}</h2>
          <p>{openCount ? `${openCount} chore${openCount === 1 ? "" : "s"} to tackle. Let's make a little room for the good stuff.` : pendingCount ? "Your work is done. A parent just needs to take a look." : "Everything is checked off. Enjoy a little more time together."}</p>
          <a href="#chores" className="hero-link">Let's do this <ArrowRight size={17} aria-hidden="true" /></a>
        </div>
        <div className="team-art" aria-hidden="true">
          <div className="art-orbit" />
          <div className="art-check"><CheckCheck size={76} strokeWidth={2.5} /></div>
          <span className="art-star"><Star fill="currentColor" /></span>
          <div className="team-ticket">
            <span className="ticket-icon"><Users size={20} /></span>
            <div>
              <strong>Team {data.household.name.replace(/^The /, "").replace(/ Home$/, "")}</strong>
              <small>Every helping hand counts.</small>
            </div>
          </div>
          <span className="art-dot" />
        </div>
      </section>
    )}

    {childProgress.length > 0 && (
      <section className="daily-progress" aria-label="Today's progress">
        {childProgress.map(({ child, actionsLeft, choresDone, choresTotal, pending, routineDone, routineTotal }) => (
          <article
            key={child.id}
            className="child-progress-card"
            style={{ "--child-color": child.color } as React.CSSProperties}
          >
            <header className="child-progress-header">
              <span className="child-progress-avatar" style={{ backgroundColor: child.color }} aria-hidden="true">{initials(child.name)}</span>
              <div><h2>{child.name}</h2><p>Today’s progress</p></div>
              <span className={`child-progress-status ${actionsLeft === 0 ? "all-done" : ""}`}>{actionsLeft === 0 ? "All clear" : `${actionsLeft} left`}</span>
            </header>
            <div className="child-progress-row">
              <div className="child-progress-label"><span>Chores</span><strong>{choresTotal ? <>{choresDone} <em>/ {choresTotal} done</em></> : "None today"}</strong></div>
              <progress className="child-progress-bar" value={choresDone} max={Math.max(choresTotal, 1)} aria-label={`${child.name}: ${choresDone} of ${choresTotal} chores done`} />
            </div>
            {routineTotal > 0 && (
              <div className="child-progress-row">
                <div className="child-progress-label"><span>Routines</span><strong>{routineDone} <em>/ {routineTotal} steps</em></strong></div>
                <progress className="child-progress-bar routine-progress-bar" value={routineDone} max={routineTotal} aria-label={`${child.name}: ${routineDone} of ${routineTotal} routine steps done`} />
              </div>
            )}
            {pending > 0 && <p className="child-progress-note"><Clock3 size={13} aria-hidden="true" />{pending} sent to a parent for review</p>}
          </article>
        ))}
        {sharedOpenCount > 0 && <p className="team-progress-note"><Users size={15} aria-hidden="true" />{sharedOpenCount} team chore{sharedOpenCount === 1 ? "" : "s"} available for anyone to pick up.</p>}
      </section>
    )}

    <section className="child-columns-grid" id="chores" aria-label="Children to-do lists">
      {data.children.length === 0 ? (
        <div className="empty-state child-columns-empty">
          <span><Sparkles size={30} aria-hidden="true" /></span>
          <h3>No children added yet</h3>
          <p>Add your children in <a href="/parent">Parent mode</a> to display their to-do columns.</p>
        </div>
      ) : (
        data.children.map((child) => {
          const childChores = data.chores.filter((chore) => choreBelongsTo(chore, child.id));
          const activeChores = childChores.filter((chore) => chore.status !== "completed" && !isOptionalFlexible(chore));
          const optionalFlexibleChores = childChores.filter((chore) => chore.status !== "completed" && isOptionalFlexible(chore));
          const completedChores = childChores.filter((c) => c.status === "completed");

          const childRoutines = data.routines.filter((routine) => {
            if (routine.ownerId) return routine.ownerId === child.id;
            const hasAssigned = data.routines.some((r) => r.title === routine.title && r.ownerId === child.id);
            return !hasAssigned;
          });

          const allClear = allClearByChild[child.id];
          const isCompletedCollapsed = collapsedCompleted[child.id] ?? false;

          return (
            <article
              key={child.id}
              className="child-column"
              style={{
                "--col-accent": child.color,
                backgroundColor: `color-mix(in srgb, ${child.color} 7%, #fcfaf6)`,
                borderColor: `color-mix(in srgb, ${child.color} 22%, #e8e0d5)`
              } as React.CSSProperties}
            >
              {/* Child Header: Avatar and Name */}
              <header className="child-col-header">
                <div
                  className="child-avatar"
                  style={{ backgroundColor: child.color }}
                  aria-hidden="true"
                >
                  {initials(child.name)}
                </div>
                <h2 className="child-name">{child.name}</h2>
              </header>

              {/* Routine Sections */}
              {childRoutines.map((routine) => (
                <section className="column-task-section" key={`routine-${routine.id}`}>
                  <h3 className="section-subtitle routine-title">
                    <span className="routine-title-icon" aria-hidden="true">{getTaskIcon(routine.title, routine.icon)}</span>
                    {routine.title}
                  </h3>
                  <div className="task-cards-stack">
                    {routine.steps.map((step) => (
                      <div
                        key={step.id}
                        className={`child-task-card ${step.completed ? "task-done" : ""}`}
                      >
                        <span className={`task-icon-badge ${step.completed ? "done" : ""}`} aria-hidden="true">
                          {getTaskIcon(step.title, step.icon)}
                        </span>
                        <div className="task-card-content">
                          <span className={`task-title-text ${step.completed ? "strikethrough" : ""}`}>{step.title}</span>
                        </div>
                        <button
                          type="button"
                          className={`task-checkbox-btn ${step.completed ? "checked" : ""}`}
                          aria-label={step.completed ? `Uncheck ${step.title}` : `Complete ${step.title}`}
                          disabled={offline || Boolean(busy)}
                          onClick={() => void toggleStep(routine.id, step.id, child.id, !step.completed)}
                        >
                          {step.completed ? (
                            <Check size={16} strokeWidth={3} aria-hidden="true" />
                          ) : busy === step.id ? (
                            <RefreshCw size={13} className="spinning" aria-hidden="true" />
                          ) : null}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              {/* Active Chores Section */}
              {activeChores.length > 0 && (
                <section className="column-task-section">
                  {childRoutines.length > 0 && <h3 className="section-subtitle">Chores</h3>}
                  <div className="task-cards-stack">
                    {activeChores.map((chore) => (
                      <div
                        key={chore.obligationId}
                        className={`child-task-card ${chore.status === "pending" ? "task-pending" : ""}`}
                      >
                        <span className="task-icon-badge" aria-hidden="true">
                          {getTaskIcon(chore.title, chore.icon)}
                        </span>
                        <div className="task-card-content">
                          <span className="task-title-text">{chore.title}</span>
                          {chore.instructions && (
                            <p className="task-subtext">{chore.instructions}</p>
                          )}
                          <div className="task-badges-row">
                            <span className="task-mini-badge">
                              <Calendar size={11} aria-hidden="true" />
                              {formatScheduleBadge(chore)}
                            </span>
                            {chore.policy === "any" && !chore.assignee && (
                              <span className="task-mini-badge team">Team chore</span>
                            )}
                            {chore.status === "pending" && (
                              <span className="task-mini-badge pending">Awaiting approval</span>
                            )}
                            {chore.status === "rejected" && (
                              <span className="task-mini-badge rejected">Try once more</span>
                            )}
                          </div>
                        </div>
                        {chore.status === "pending" ? (
                          <span className="task-checkbox-btn pending" title="Awaiting parent approval">
                            <Clock3 size={15} aria-hidden="true" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="task-checkbox-btn"
                            aria-label={`Mark ${chore.title} done`}
                            disabled={offline || Boolean(busy)}
                            onClick={() => {
                              const actor = chore.assignee?.id ?? child.id;
                              void completeChore(chore.obligationId, actor, child.id, chore.title);
                            }}
                          >
                            {busy === chore.obligationId ? (
                              <RefreshCw size={13} className="spinning" aria-hidden="true" />
                            ) : null}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* All Clear Empty State */}
              {allClear && (
                <div className="column-all-clear">
                  <Sparkles size={24} aria-hidden="true" />
                  <p>{praiseFor(child.id)}</p>
                </div>
              )}

              {optionalFlexibleChores.length > 0 && (
                <section className="column-task-section flexible-upcoming-section">
                  <h3 className="section-subtitle">Flexible / upcoming</h3>
                  <p className="flexible-upcoming-copy">Optional until its scheduled day.</p>
                  <div className="task-cards-stack">
                    {optionalFlexibleChores.map((chore) => (
                      <div key={chore.obligationId} className={`child-task-card task-optional ${chore.status === "pending" ? "task-pending" : ""}`}>
                        <span className="task-icon-badge" aria-hidden="true">{getTaskIcon(chore.title, chore.icon)}</span>
                        <div className="task-card-content">
                          <span className="task-title-text">{chore.title}</span>
                          {chore.instructions && <p className="task-subtext">{chore.instructions}</p>}
                          <div className="task-badges-row">
                            <span className="task-mini-badge optional"><Calendar size={11} aria-hidden="true" />Optional until {new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${chore.scheduledFor}T12:00:00.000Z`))}</span>
                            {chore.policy === "any" && !chore.assignee && <span className="task-mini-badge team">Team chore</span>}
                          </div>
                        </div>
                        {chore.status === "pending" ? <span className="task-checkbox-btn pending" title="Awaiting parent approval"><Clock3 size={15} aria-hidden="true" /></span> : (
                          <button type="button" className="task-checkbox-btn" aria-label={`Mark ${chore.title} done`} disabled={offline || Boolean(busy)} onClick={() => void completeChore(chore.obligationId, chore.assignee?.id ?? child.id, child.id, chore.title)}>
                            {busy === chore.obligationId ? <RefreshCw size={13} className="spinning" aria-hidden="true" /> : null}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Completed Chores Drawer */}
              {completedChores.length > 0 && (
                <div className="column-completed-drawer">
                  <button
                    type="button"
                    className="completed-drawer-header"
                    onClick={() => setCollapsedCompleted((prev) => ({ ...prev, [child.id]: !isCompletedCollapsed }))}
                  >
                    <CheckCheck size={14} aria-hidden="true" />
                    <span>Done today ({completedChores.length})</span>
                    {isCompletedCollapsed ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronUp size={14} aria-hidden="true" />}
                  </button>
                  {!isCompletedCollapsed && (
                    <div className="task-cards-stack completed-stack">
                      {completedChores.map((chore) => (
                        <div key={chore.obligationId} className="child-task-card task-done">
                          <span className="task-icon-badge done" aria-hidden="true">
                            <Check size={15} strokeWidth={2.5} />
                          </span>
                          <div className="task-card-content">
                            <span className="task-title-text strikethrough">{chore.title}</span>
                          </div>
                          <button
                            type="button"
                            className="task-undo-link"
                            title={`Undo "${chore.title}"`}
                            disabled={offline || Boolean(busy)}
                            onClick={() => undoChore(chore.obligationId)}
                          >
                            <RotateCcw size={12} aria-hidden="true" /> Undo
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })
      )}
    </section>

    <footer className="board-footer">
      <span><Home size={16} aria-hidden="true" />homeboard</span>
      <p>A happy home is a team effort.</p>
      <span className="footer-note">Made for your everyday</span>
    </footer>

    {notice && (
      <div className="toast" role="status">
        <CheckCheck size={22} aria-hidden="true" />
        <div>
          <strong>{notice.title}</strong>
          {notice.detail && <p>{notice.detail}</p>}
        </div>
        {notice.undoChoreId && (
          <button
            className="toast-undo"
            onClick={() => void undoChore(notice.undoChoreId!)}
            disabled={Boolean(busy) || offline}
          >
            Undo
          </button>
        )}
        <button aria-label="Dismiss notification" onClick={() => setNotice(null)}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
    )}

    <dialog ref={dialog} className="person-picker" aria-labelledby="picker-title" onCancel={() => setChooser(null)} onClose={() => setChooser(null)}>
      <button className="close" aria-label="Close name chooser" onClick={() => setChooser(null)}><X size={22} aria-hidden="true" /></button>
      <p className="eyebrow">{chooser?.type === "routine" && !chooser.completed ? "LET'S UPDATE THAT STEP" : "GIVE CREDIT WHERE IT'S DUE"}</p>
      <h2 id="picker-title">Who helped out?</h2>
      <p className="picker-copy">Choose your name to update the board.</p>
      <div className="people">
        {chooser?.children.map((child) => (
          <button
            key={child.id}
            disabled={Boolean(busy) || offline}
            onClick={() => chooser.type === "chore" ? void completeChore(chooser.id, child.id, child.id, chooser.title) : void toggleStep(chooser.runId, chooser.stepId, child.id, chooser.completed)}
          >
            <span style={{ borderColor: child.color }}>{initials(child.name)}</span>
            {child.name}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
      {chooser?.children.length === 0 && <p>Add a child in Parent mode first.</p>}
    </dialog>
  </main>;
}

function HeartNote() { return <Star size={14} aria-hidden="true" />; }
