"use client";

import { Pencil, Search, Sparkles, Trash2, X } from "lucide-react";
import { useParentControllerContext } from "./parent-controller";

export function ChoresTab() {
  const {
    members,
    groups,
    choreTemplates,
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
    startEditChore,
    cancelEditChore,
    saveChore,
    deleteChore,
    children,
    dayNames,
    formatScheduledDate,
    resolveTaskIcon,
    CHORE_ICONS,
  } = useParentControllerContext();
  return (<div className="parent-grid" id="chore-form-section">
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
                <details className="optional-chore-details">
                  <summary>Optional details and icon</summary>
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
                </details>

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

                <details className="optional-chore-details">
                  <summary>More scheduling and assignment options</summary>
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
                </details>

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
          </div>);
}
