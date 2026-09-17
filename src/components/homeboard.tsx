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
  ListChecks,
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

export function Homeboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [chooser, setChooser] = useState<Chooser | null>(null);
  const [collapsedCompleted, setCollapsedCompleted] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

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
    void refresh();
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

  const openCount = useMemo(() => data?.chores.filter((chore) => chore.status === "open" || chore.status === "rejected").length ?? 0, [data]);
  const pendingCount = data?.chores.filter((chore) => chore.status === "pending").length ?? 0;
  const routineDone = data?.routines.reduce((count, routine) => count + routine.completedSteps, 0) ?? 0;
  const routineTotal = data?.routines.reduce((count, routine) => count + routine.totalSteps, 0) ?? 0;

  const hideBanner = async () => {
    setData((prev) => prev ? { ...prev, household: { ...prev.household, showBanner: false } } : null);
    try {
      await api("/api/v1/household", { method: "PATCH", body: JSON.stringify({ showBanner: false }) });
    } catch {
      // If client is in guest/device mode, state update is still applied locally
    }
  };

  const completeChore = async (id: string, actorId: string, choreTitle?: string) => {
    if (busy || offline) return;
    setBusy(id);
    try {
      const result = await api<{ status?: string }>(`/api/v1/obligations/${id}/complete`, {
        method: "POST",
        headers: { "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ actorId })
      });
      setNotice({
        title: result.status === "pending" ? "Nice work! Sent for parent approval." : "One less chore. One more little win!",
        undoChoreId: id,
        undoChoreTitle: choreTitle
      });
      setChooser(null);
      await refresh();
    } catch (cause) { setNotice({ title: "Couldn't save that", detail: cause instanceof Error ? cause.message : undefined }); }
    finally { setBusy(null); }
  };

  const undoChore = async (choreId: string) => {
    if (busy || offline) return;
    setBusy(choreId);
    try {
      await api(`/api/v1/obligations/${choreId}/undo`, { method: "POST" });
      setNotice({ title: "Chore restored back to your list!" });
      await refresh();
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

    <section className="board-stats" aria-label="Household overview">
      <article className="stat-card stat-lilac"><span className="stat-icon"><ListChecks aria-hidden="true" /></span><div><strong>{openCount}</strong><span>Chores to do</span></div><small>One at a time</small></article>
      <article className="stat-card stat-peach"><span className="stat-icon"><Clock3 aria-hidden="true" /></span><div><strong>{pendingCount}</strong><span>Waiting for approval</span></div><small>Ready for a high five</small></article>
      <article className="stat-card stat-mint"><span className="stat-icon"><CheckCheck aria-hidden="true" /></span><div><strong>{routineDone}<em> / {routineTotal}</em></strong><span>Routine steps done</span></div><small>Small habits, big wins</small></article>
    </section>

    <section className="child-columns-grid" id="chores" aria-label="Children to-do lists">
      {data.children.length === 0 ? (
        <div className="empty-state child-columns-empty">
          <span><Sparkles size={30} aria-hidden="true" /></span>
          <h3>No children added yet</h3>
          <p>Add your children in <a href="/parent">Parent mode</a> to display their to-do columns.</p>
        </div>
      ) : (
        data.children.map((child) => {
          const childChores = data.chores.filter((chore) =>
            chore.assignee?.id === child.id || (!chore.assignee && chore.allowedChildren.some((c) => c.id === child.id))
          );
          const activeChores = childChores.filter((c) => c.status !== "completed");
          const completedChores = childChores.filter((c) => c.status === "completed");

          const childRoutines = data.routines.filter((routine) => {
            if (routine.ownerId) return routine.ownerId === child.id;
            const hasAssigned = data.routines.some((r) => r.title === routine.title && r.ownerId === child.id);
            return !hasAssigned;
          });

          const allClear = activeChores.length === 0 && childRoutines.every((r) => r.steps.every((s) => s.completed));
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
                  <h3 className="section-subtitle">{routine.title}</h3>
                  <div className="task-cards-stack">
                    {routine.steps.map((step) => (
                      <div
                        key={step.id}
                        className={`child-task-card ${step.completed ? "task-done" : ""}`}
                      >
                        <span className={`task-icon-badge ${step.completed ? "done" : ""}`} aria-hidden="true">
                          {getTaskIcon(step.title)}
                        </span>
                        <div className="task-card-content">
                          <span className={`task-title-text ${step.completed ? "strikethrough" : ""}`}>{step.title}</span>
                        </div>
                        <button
                          type="button"
                          className={`task-circle-btn ${step.completed ? "checked" : ""}`}
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
                          <span className="task-circle-btn pending" title="Awaiting parent approval">
                            <Clock3 size={15} aria-hidden="true" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="task-circle-btn"
                            aria-label={`Mark ${chore.title} done`}
                            disabled={offline || Boolean(busy)}
                            onClick={() => {
                              const actor = chore.assignee?.id ?? child.id;
                              void completeChore(chore.obligationId, actor, chore.title);
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
                  <p>{completedChores.length > 0 ? "All chores handled! Great job!" : "All clear over here!"}</p>
                </div>
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
            onClick={() => chooser.type === "chore" ? void completeChore(chooser.id, child.id, chooser.title) : void toggleStep(chooser.runId, chooser.stepId, child.id, chooser.completed)}
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
