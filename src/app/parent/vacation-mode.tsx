"use client";

import { CalendarDays, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { dateInTimezone } from "@/lib/dates";
import { nextCalendarDay } from "@/lib/member-absence";
import { useParentControllerContext } from "./parent-controller";
import { useAbsenceManagement } from "./use-absence-management";

const formatDay = (day: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));

export function VacationMode() {
  const { children, absences, dashboard, busy, perform, request, setNotice } = useParentControllerContext();
  const management = useAbsenceManagement({ perform, request, setNotice });
  const firstDayInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (management.editing) firstDayInput.current?.focus();
  }, [management.editing]);
  const today = dateInTimezone(new Date(), dashboard?.household.timezone ?? "America/Chicago");
  let saveLabel = management.editing ? "Save away dates" : "Schedule time away";
  if (busy === "absence") saveLabel = "Saving…";
  const ranges = absences
    .filter((range) => children.some((child) => child.id === range.memberId))
    .sort((a, b) => Number(a.endDate < today) - Number(b.endDate < today) || a.startDate.localeCompare(b.startDate));
  return (
    <section className="management-card vacation-card" aria-labelledby="vacation-title">
      <div className="history-head">
        <div>
          <p className="eyebrow">ROOM FOR TIME AWAY</p>
          <h2 id="vacation-title">
            <CalendarDays size={22} aria-hidden="true" /> Vacation mode
          </h2>
          <p className="integration-copy">
            Pause chores and routines when a child is away. Unfinished work on away days is excused from completion
            rates.
          </p>
        </div>
      </div>
      <form
        className="vacation-form"
        onSubmit={management.save}
        aria-label={management.editing ? "Edit away dates" : "Schedule vacation"}
      >
        <fieldset disabled={Boolean(busy) || Boolean(management.editing)}>
          <legend>Children taking time away</legend>
          <div className="vacation-children">
            {children.map((child) => (
              <label key={child.id}>
                <input
                  type="checkbox"
                  checked={management.memberIds.includes(child.id)}
                  onChange={(event) => {
                    management.setMemberIds(
                      event.target.checked
                        ? [...management.memberIds, child.id]
                        : management.memberIds.filter((id) => id !== child.id)
                    );
                  }}
                />
                {child.displayName}
              </label>
            ))}
            {!children.length && <p className="form-hint">Add a child above to schedule time away.</p>}
          </div>
        </fieldset>
        <div className="vacation-dates">
          <label>
            First away day
            <input
              type="date"
              ref={firstDayInput}
              required
              value={management.startDate}
              disabled={Boolean(busy)}
              onChange={(event) => management.setStartDate(event.target.value)}
            />
          </label>
          <label>
            Last away day
            <input
              type="date"
              required
              min={management.startDate || undefined}
              value={management.endDate}
              disabled={Boolean(busy)}
              onChange={(event) => management.setEndDate(event.target.value)}
            />
          </label>
        </div>
        <p className="form-hint">
          Both dates are included, using your household timezone. Past dates can excuse work you forgot to pause.
        </p>
        {management.startDate && management.endDate && management.startDate <= management.endDate && (
          <p className="vacation-return">
            Back to the usual schedule on {formatDay(nextCalendarDay(management.endDate))}.
          </p>
        )}
        <p className="form-hint" id="vacation-edit-effect">
          Editing or deleting a range makes dates no longer covered count normally again, including past missed chores.
          Completed work and pending approvals stay recorded.
        </p>
        {management.error && (
          <p className="weekly-error" role="alert">
            {management.error}
          </p>
        )}
        <div className="vacation-actions">
          <button className="primary" disabled={Boolean(busy) || !management.memberIds.length}>
            {saveLabel}
          </button>
          {management.editing && (
            <button type="button" className="secondary" disabled={Boolean(busy)} onClick={management.reset}>
              Cancel edit
            </button>
          )}
        </div>
      </form>
      <div className="vacation-ranges" aria-label="Scheduled away ranges">
        {ranges.map((range) => {
          const name = children.find((child) => child.id === range.memberId)?.displayName;
          let status = "Away now";
          if (range.endDate < today) status = "Past";
          else if (range.startDate > today) status = "Upcoming";
          return (
            <article className="vacation-range" key={range.id}>
              <div>
                <h3>
                  {name} <span className="pill excused">{status}</span>
                </h3>
                <p>
                  {formatDay(range.startDate)} – {formatDay(range.endDate)}
                </p>
              </div>
              <div className="vacation-actions">
                <button
                  type="button"
                  className="secondary"
                  aria-label={`Edit away dates for ${name}, ${formatDay(range.startDate)}`}
                  aria-describedby="vacation-edit-effect"
                  disabled={Boolean(busy)}
                  onClick={() => management.edit(range)}
                >
                  <Pencil size={16} aria-hidden="true" /> Edit
                </button>
                <button
                  type="button"
                  className="secondary"
                  aria-label={`Delete away range for ${name}, ${formatDay(range.startDate)}`}
                  aria-describedby="vacation-edit-effect"
                  disabled={Boolean(busy)}
                  onClick={() => management.remove(range)}
                >
                  <Trash2 size={16} aria-hidden="true" /> Delete
                </button>
              </div>
            </article>
          );
        })}
        {!ranges.length && <p className="form-hint">No time away scheduled yet.</p>}
      </div>
    </section>
  );
}
