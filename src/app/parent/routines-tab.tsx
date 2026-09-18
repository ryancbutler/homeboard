"use client";

import { Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { useParentControllerContext } from "./parent-controller";

export function RoutinesTab() {
  const {
    routineTemplates,
    busy,
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
    startEditRoutine,
    cancelEditRoutine,
    saveRoutine,
    deleteRoutine,
    children,
    dayNames,
    resolveTaskIcon,
    CHORE_ICONS,
  } = useParentControllerContext();
  return (<div className="parent-grid" id="routine-form-section">
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
                        <span className="step-icon-preview" aria-hidden="true">{resolveTaskIcon(step.title || `Step ${idx + 1}`, step.icon || null, 17)}</span>
                        <input
                          type="text"
                          required
                          maxLength={120}
                          value={step.title}
                          placeholder={`Step ${idx + 1} (e.g. Brush teeth)`}
                          onChange={(e) => {
                            const updated = [...routineSteps];
                            updated[idx] = { ...updated[idx], title: e.target.value };
                            setRoutineSteps(updated);
                          }}
                        />
                        <label className="sr-only" htmlFor={`routine-step-icon-${idx}`}>Icon for step {idx + 1}</label>
                        <select
                          id={`routine-step-icon-${idx}`}
                          className="step-icon-select"
                          value={step.icon}
                          onChange={(e) => {
                            const updated = [...routineSteps];
                            updated[idx] = { ...updated[idx], icon: e.target.value };
                            setRoutineSteps(updated);
                          }}
                        >
                          <option value="">Auto icon</option>
                          {CHORE_ICONS.map((icon) => <option key={icon.id} value={icon.id}>{icon.label}</option>)}
                        </select>
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
                      onClick={() => setRoutineSteps([...routineSteps, { title: "", icon: "" }])}
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
          </div>);
}
