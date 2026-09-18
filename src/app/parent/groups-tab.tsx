"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useParentControllerContext } from "./parent-controller";

export function GroupsTab() {
  const {
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
    busy,
    createGroup,
    switchGroup,
    createRotation,
    stopRotation,
    startRenameGroup,
    saveGroupName,
    deleteGroup,
    children,
    rotatingGroupIds,
    childName,
    formatScheduledDate,
  } = useParentControllerContext();
  return (<section className="management-card group-card">
            <p className="eyebrow">TAKE TURNS, TOGETHER</p>
            <h2>Chore groups</h2>
            <p className="integration-copy">Create groups to bundle related chores. Assign a child when ready, or remove them to unassign.</p>
            {rotations.length > 0 && (
              <div className="rotation-list" aria-label="Active weekly group rotations">
                {rotations.map((rotation) => (
                  <article className="rotation-card" key={rotation.id}>
                    <div>
                      <strong>{rotation.firstGroup.name} ↔ {rotation.secondGroup.name}</strong>
                      <small>Swaps every Monday · started {formatScheduledDate(rotation.startDate)}</small>
                    </div>
                    <div className="rotation-preview">
                      <span>This week: {rotation.firstGroup.name} — {childName(rotation.current.firstGroupMemberId)}; {rotation.secondGroup.name} — {childName(rotation.current.secondGroupMemberId)}</span>
                      <span>Next week: {rotation.firstGroup.name} — {childName(rotation.next.firstGroupMemberId)}; {rotation.secondGroup.name} — {childName(rotation.next.secondGroupMemberId)}</span>
                    </div>
                    <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => stopRotation(rotation)}>Stop rotation</button>
                  </article>
                ))}
              </div>
            )}
            {groups.length >= 2 && children.length >= 2 && (
              <form className="rotation-create" onSubmit={createRotation}>
                <h3>Alternate two groups weekly</h3>
                <p className="form-hint">Choose who starts with each group. The groups switch children every Monday until you stop the rotation.</p>
                <div className="two-col">
                  <label>First group
                    <select required value={rotationFirstGroupId} onChange={(event) => setRotationFirstGroupId(event.target.value)}>
                      <option value="">Choose a group</option>
                      {groups.filter((group) => !rotatingGroupIds.has(group.id)).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                  </label>
                  <label>Child with first group
                    <select required value={rotationFirstMemberId} onChange={(event) => setRotationFirstMemberId(event.target.value)}>
                      <option value="">Choose a child</option>
                      {children.map((child) => <option key={child.id} value={child.id}>{child.displayName}</option>)}
                    </select>
                  </label>
                  <label>Second group
                    <select required value={rotationSecondGroupId} onChange={(event) => setRotationSecondGroupId(event.target.value)}>
                      <option value="">Choose a group</option>
                      {groups.filter((group) => !rotatingGroupIds.has(group.id) && group.id !== rotationFirstGroupId).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                  </label>
                  <label>Child with second group
                    <select required value={rotationSecondMemberId} onChange={(event) => setRotationSecondMemberId(event.target.value)}>
                      <option value="">Choose a child</option>
                      {children.filter((child) => child.id !== rotationFirstMemberId).map((child) => <option key={child.id} value={child.id}>{child.displayName}</option>)}
                    </select>
                  </label>
                </div>
                <label>First Monday
                  <input type="date" required value={rotationStartDate} onChange={(event) => setRotationStartDate(event.target.value)} />
                </label>
                <button className="primary" disabled={Boolean(busy) || !rotationFirstGroupId || !rotationSecondGroupId || !rotationFirstMemberId || !rotationSecondMemberId}>
                  {busy === "rotation" ? "Scheduling…" : "Start weekly rotation"}
                </button>
              </form>
            )}
            <div className="group-list">
              {groups.map((group) => (
                <div className="group-row" key={group.id}>
                  <div className="group-name-block">
                    {editingGroupId === group.id ? (
                      <form className="group-rename-form" onSubmit={(event) => saveGroupName(event, group)}>
                        <label className="sr-only" htmlFor={`group-name-${group.id}`}>Group name</label>
                        <input
                          id={`group-name-${group.id}`}
                          value={groupNameInput}
                          maxLength={80}
                          autoFocus
                          onChange={(event) => setGroupNameInput(event.target.value)}
                        />
                        <button type="submit" className="secondary" disabled={!groupNameInput.trim() || Boolean(busy)}>Save</button>
                        <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => setEditingGroupId(null)}>Cancel</button>
                      </form>
                    ) : (
                      <div className="group-name-line">
                        <strong>{group.name}</strong>
                        <button
                          type="button"
                          className="group-rename-button"
                          aria-label={`Rename ${group.name}`}
                          title={`Rename ${group.name}`}
                          disabled={Boolean(busy)}
                          onClick={() => startRenameGroup(group)}
                        >
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                    <small>
                      {group.templateCount} chore{group.templateCount === 1 ? "" : "s"} · {rotatingGroupIds.has(group.id) ? "weekly rotation active" : <>currently {group.assignedMemberId ? group.assignedMemberName : <em className="unassigned-text">Unassigned</em>}</>}
                    </small>
                  </div>
                  <div className="group-controls">
                    <select
                      aria-label={`Assign ${group.name}`}
                      value={group.assignedMemberId ?? ""}
                      disabled={Boolean(busy) || rotatingGroupIds.has(group.id)}
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
          </section>);
}
