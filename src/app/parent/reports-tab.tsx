"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import {
  mondayFor,
  reportForWeek,
  shiftDay,
  summarizeWeeklyRows,
  type WeeklyChoreSummary,
  type WeeklyReportRow,
} from "@/lib/weekly-report";
import { useParentControllerContext } from "./parent-controller";

type WeeklyReport = {
  from: string;
  to: string;
  rows: WeeklyReportRow[];
};

const formatDate = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(new Date(`${date}T12:00:00.000Z`));

const formatWeek = (weekStart: string) =>
  `${formatDate(weekStart, { month: "short", day: "numeric" })} – ${formatDate(shiftDay(weekStart, 6), {
    month: "short",
    day: "numeric",
  })}`;

function SummaryRow({ summary, tone }: { summary: WeeklyChoreSummary; tone: "win" | "attention" }) {
  const completePercent = summary.total ? Math.round((summary.completed / summary.total) * 100) : 0;
  return (
    <article className="weekly-chore-row">
      <div>
        <h3>{summary.title}</h3>
        <p>
          {summary.completed} done
          {summary.missed > 0 && ` · ${summary.missed} missed`}
          {summary.rejected > 0 && ` · ${summary.rejected} needs another try`}
          {summary.pending > 0 && ` · ${summary.pending} waiting for approval`}
          {summary.open > 0 && ` · ${summary.open} still open`}
        </p>
        <div className="weekly-progress" aria-label={`${summary.title}: ${completePercent}% completed`}>
          <span style={{ width: `${completePercent}%` }} />
        </div>
      </div>
      <strong className={`weekly-pill ${tone}`}>
        {tone === "win" ? `${completePercent}%` : `${summary.missed + summary.rejected} needs help`}
      </strong>
    </article>
  );
}

export function ReportsTab() {
  const { children, report, request } = useParentControllerContext();
  const latestDate = report?.to ?? "";
  const [weekStart, setWeekStart] = useState("");
  const [child, setChild] = useState("all");
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (latestDate && !weekStart) setWeekStart(mondayFor(latestDate));
  }, [latestDate, weekStart]);

  useEffect(() => {
    if (!weekStart) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    void request<WeeklyReport>(`/api/v1/reports?from=${weekStart}&to=${shiftDay(weekStart, 6)}`)
      .then((next) => {
        if (!cancelled) setWeeklyReport(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Unable to load this week. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [request, weekStart]);

  const weekEnd = weekStart ? shiftDay(weekStart, 6) : "";
  const displayedReport = reportForWeek(weeklyReport, weekStart);
  const summary = useMemo(
    () => summarizeWeeklyRows(displayedReport?.rows ?? [], child),
    [child, displayedReport?.rows]
  );
  const isCurrentWeek = Boolean(latestDate && weekStart === mondayFor(latestDate));
  const nextWeek = weekStart ? shiftDay(weekStart, 7) : "";
  const canMoveForward = Boolean(latestDate && nextWeek && nextWeek <= mondayFor(latestDate));

  return (
    <section className="weekly-review" aria-labelledby="weekly-review-title">
      <header className="weekly-review-head">
        <div>
          <p className="eyebrow">WEEKLY FAMILY CHECK-IN</p>
          <h2 id="weekly-review-title">Celebrate the wins. Make the hard parts easier.</h2>
          <p>Review completed chores, missed check-offs, and work that still needs attention together.</p>
        </div>
        <div className="weekly-controls">
          <div className="week-picker" aria-label="Report week">
            <button
              type="button"
              className="secondary"
              aria-label="Previous week"
              disabled={!weekStart}
              onClick={() => setWeekStart(shiftDay(weekStart, -7))}
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
            <strong>
              {weekStart ? formatWeek(weekStart) : "Loading…"}
              {isCurrentWeek && <small className="weekly-date-note"> · Week so far</small>}
            </strong>
            <button
              type="button"
              className="secondary"
              aria-label="Next week"
              disabled={!canMoveForward}
              onClick={() => setWeekStart(nextWeek)}
            >
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          <label className="weekly-child-filter">
            <span>Show</span>
            <select value={child} onChange={(event) => setChild(event.target.value)}>
              <option value="all">Everyone</option>
              {children.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
              <option value="shared">Shared chores</option>
            </select>
          </label>
        </div>
      </header>

      {error && (
        <p className="weekly-error" role="alert">
          {error}
        </p>
      )}
      {(loading || !displayedReport) && !error ? (
        <p className="form-hint" role="status">
          Gathering this week&apos;s check-offs…
        </p>
      ) : null}

      {displayedReport && (
        <>
          <div className="weekly-stat-grid" aria-label={`Weekly report for ${formatWeek(weekStart)}`}>
            <article>
              <CheckCircle2 size={20} aria-hidden="true" />
              <span>Recorded complete</span>
              <strong>{summary.completed}</strong>
              <small>
                of {summary.total} expected check-offs · {summary.excused} excused while away
              </small>
            </article>
            <article>
              <Sparkles size={20} aria-hidden="true" />
              <span>{isCurrentWeek ? "Completion so far" : "Completion"}</span>
              <strong>{summary.completionRate === null ? "No expected chores" : `${summary.completionRate}%`}</strong>
              <small>Open chores and those waiting for approval count toward the total.</small>
            </article>
            <article>
              <CircleAlert size={20} aria-hidden="true" />
              <span>Needs a conversation</span>
              <strong>{summary.missed + summary.rejected}</strong>
              <small>
                {summary.missed} missed · {summary.rejected} needs another try
              </small>
            </article>
            <article>
              <RefreshCw size={20} aria-hidden="true" />
              <span>Still in progress</span>
              <strong>{summary.open + summary.pending}</strong>
              <small>
                {summary.pending} waiting for approval · {summary.open} open
              </small>
            </article>
          </div>

          <div className="weekly-two-column">
            <section className="management-card weekly-card">
              <div className="weekly-card-head">
                <div>
                  <p className="eyebrow">LET&apos;S CELEBRATE</p>
                  <h2>What&apos;s going well</h2>
                </div>
                <Sparkles size={22} aria-hidden="true" />
              </div>
              {summary.wins.slice(0, 3).map((item) => (
                <SummaryRow key={item.title} summary={item} tone="win" />
              ))}
              {!summary.wins.length && (
                <p className="form-hint">
                  No completions were recorded for this selection yet. A new week is a fresh start.
                </p>
              )}
            </section>

            <section className="management-card weekly-card attention-card">
              <div className="weekly-card-head">
                <div>
                  <p className="eyebrow">MAKE IT EASIER</p>
                  <h2>What needs a little help</h2>
                </div>
                <Lightbulb size={22} aria-hidden="true" />
              </div>
              {summary.attention.slice(0, 3).map((item) => (
                <SummaryRow key={item.title} summary={item} tone="attention" />
              ))}
              {!summary.attention.length && (
                <p className="form-hint">
                  No missed or rejected check-offs this week. Keep using the routines that helped.
                </p>
              )}
            </section>
          </div>

          <section className="management-card weekly-detail-card">
            <div className="history-head">
              <div>
                <p className="eyebrow">THE DETAILS</p>
                <h2>Every chore this week</h2>
                <p>
                  Counts use the Homeboard history date. Flexible chores are counted on the day they were completed.
                </p>
              </div>
            </div>
            <div className="weekly-summary-list">
              {summary.choreSummaries.map((item) => (
                <article key={item.title}>
                  <h3>{item.title}</h3>
                  <div>
                    <span className="pill completed">{item.completed} done</span>
                    {item.missed > 0 && <span className="pill missed">{item.missed} missed</span>}
                    {item.open > 0 && <span className="pill open">{item.open} open</span>}
                    {item.pending > 0 && <span className="pill pending">{item.pending} pending</span>}
                    {item.rejected > 0 && <span className="pill rejected">{item.rejected} try again</span>}
                    {item.excused > 0 && <span className="pill excused">{item.excused} excused — away</span>}
                  </div>
                </article>
              ))}
              {!summary.choreSummaries.length && <p className="empty">No chores were scheduled for this week.</p>}
            </div>
          </section>
        </>
      )}
      {weekEnd && (
        <p className="weekly-date-note">
          Review window: {formatDate(weekStart, { weekday: "long", month: "long", day: "numeric" })} through{" "}
          {formatDate(weekEnd, { weekday: "long", month: "long", day: "numeric" })}.
        </p>
      )}
    </section>
  );
}
