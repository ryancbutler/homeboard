"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, CheckCheck, Clock3, Home, KeyRound, Layers, ListChecks, RefreshCw, Settings, Sparkles, Users, X } from "lucide-react";
import { ParentControllerProvider, useParentControllerContext } from "./parent-controller";
import { ApprovalsTab } from "./approvals-tab";
import { ChoresTab } from "./chores-tab";
import { RoutinesTab } from "./routines-tab";
import { GroupsTab } from "./groups-tab";
import { FamilyTab } from "./family-tab";
import { SettingsTab } from "./settings-tab";

export default function ParentPage() {
  return <ParentControllerProvider><ParentContent /></ParentControllerProvider>;
}

function ParentContent() {
  const {
    authenticated,
    pinInput,
    setPinInput,
    pinError,
    activeTab,
    setActiveTab,
    members,
    groups,
    choreTemplates,
    routineTemplates,
    notice,
    busy,
    rescheduleDialog,
    setRescheduleDialog,
    handleUnlock,
    review,
    confirmReschedule,
    children,
    pending,
    familyToday,
  } = useParentControllerContext();
  const rescheduleModalRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = rescheduleModalRef.current;
    if (!dialog) return;
    if (rescheduleDialog && !dialog.open) dialog.showModal();
    if (!rescheduleDialog && dialog.open) dialog.close();
  }, [rescheduleDialog]);

  const dismissReschedule = () => {
    if (!busy) setRescheduleDialog(null);
  };

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
        {activeTab === "approvals" && <ApprovalsTab />}

        {/* TAB 2: Chores Management */}
        {activeTab === "chores" && <ChoresTab />}

        {/* TAB 3: Routines Management */}
        {activeTab === "routines" && <RoutinesTab />}

        {/* TAB 4: Chore Groups */}
        {activeTab === "groups" && <GroupsTab />}

        {/* TAB 5: Family (Children Only) */}
        {activeTab === "family" && <FamilyTab />}

        {/* TAB 6: Settings & PIN */}
        {activeTab === "settings" && <SettingsTab />}
      </div>
    </div>

    <footer className="board-footer">
      <span><Home size={16} aria-hidden="true" />homeboard</span>
      <p>A happy home is a team effort.</p>
    </footer>
    <dialog
      ref={rescheduleModalRef}
      className="reschedule-dialog"
      aria-labelledby="reschedule-title"
      aria-describedby="reschedule-description"
      onCancel={(event) => {
        event.preventDefault();
        dismissReschedule();
      }}
      onClick={(event) => {
        if (event.currentTarget === event.target) dismissReschedule();
      }}
    >
      {rescheduleDialog && (
        <>
          <div className="reschedule-dialog-head">
            <div>
              <p className="eyebrow">ONE-TIME CHANGE</p>
              <h2 id="reschedule-title">Reschedule {rescheduleDialog.title}</h2>
            </div>
            <button type="button" className="reschedule-close" aria-label="Close reschedule dialog" disabled={Boolean(busy)} onClick={dismissReschedule}>
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
            <button type="button" className="secondary" disabled={Boolean(busy)} onClick={dismissReschedule}>Cancel</button>
            <button type="button" className="primary" disabled={!rescheduleDialog.selectedDate || Boolean(busy)} onClick={confirmReschedule}>
              <RefreshCw size={16} aria-hidden="true" />
              {busy?.startsWith("reschedule-") ? "Rescheduling…" : "Reschedule chore"}
            </button>
          </div>
        </>
      )}
    </dialog>
  </main>;
}
