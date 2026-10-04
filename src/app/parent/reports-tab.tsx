"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { mondayFor, shiftDay, summarizeWeeklyRows, type WeeklyChoreSummary } from "@/lib/weekly-report";
import { useParentControllerContext } from "./parent-controller";

type WeeklyReport = {
  from: string;
  to: string;
  rows: {
    history_date: string;
    title: string;
    child: string | null;
    status: string;
  }[];
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
  const attention = summary.missed + summary.rejected;
  return (
    <article className="weekly-chore-row">
      <div>
        <h3>{summary.title}</h3>
        <p>
          {summary.completed} done · {attention} {attention === 1 ? "missed check-off" : "missed check-offs"}
          {summary.open > 0 && ` · ${summary.open} still open`}
        </p>
        <div className="weekly-progress" aria-label={`${summary.title}: ${completePercent}% completed`}>
          <span style={{ width: `${completePercent}%` }} />
        </div>
      </div>
      <strong className={`weekly-pill ${tone}`}>
        {tone === "win" ? `${completePercent}%` : `${attention} missed`}
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

  const summary = useMemo(() => summarizeWeeklyRows(weeklyReport?.rows ?? [], child), [child, weeklyReport?.rows]);
  const weekEnd = weekStart ? shiftDay(weekStart, 6) : "";
  const nextWeek = weekStart ? shiftDay(weekStart, 7) : "";
  const canMoveForward = Boolean(latestDate && nextWeek && nextWeek <= mondayFor(latestDate));
  const attention = summary.attention[0];
  const win = summary.wins.find((item) => item.completed === item.total) ?? summary.wins[0];

  return (
    <section className="weekly-review" aria-labelledby="weekly-review-title">
      <header className="weekly-review-head">
        <div>
          <p className="eyebrow">WEEKLY FAMILY CHECK-IN</p>
          <h2 id="weekly-review-title">Celebrate the wins. Make the hard parts easier.</h2>
          <p>
            Use this together to see what was recorded, talk about the gaps, and choose one helpful change for next
            week.
          </p>
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
            <strong>{weekStart ? formatWeek(weekStart) : "Loading…"}</strong>
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
                <option key={member.id} value={member.displayName}>
                  {member.displayName}
                </option>
              ))}
              <option value="Shared">Shared chores</option>
            </select>
          </label>
        </div>
      </header>

      {error && (
        <p className="weekly-error" role="alert">
          {error}
        </p>
      )}
      {loading && !weeklyReport ? <p className="form-hint">Gathering this week&apos;s check-offs…</p> : null}

      {weeklyReport && (
        <>
          <div className="weekly-stat-grid" aria-label={`Weekly report for ${formatWeek(weekStart)}`}>
            <article>
              <CheckCircle2 size={20} aria-hidden="true" />
              <span>Recorded complete</span>
              <strong>{summary.completed}</strong>
              <small>of {summary.rows.length} scheduled check-offs</small>
            </article>
            <article>
              <Sparkles size={20} aria-hidden="true" />
              <span>Scheduled completion</span>
              <strong>{summary.completionRate}%</strong>
              <small>for {formatWeek(weekStart)}</small>
            </article>
            <article>
              <CircleAlert size={20} aria-hidden="true" />
              <span>Needs a conversation</span>
              <strong>{summary.missed + summary.rejected}</strong>
              <small>{summary.rejected ? `${summary.rejected} needs another try` : "missed check-offs"}</small>
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

          <section className="management-card weekly-plan">
            <div className="weekly-card-head">
              <div>
                <p className="eyebrow">ONE SMALL EXPERIMENT</p>
                <h2>A gentle plan for next week</h2>
              </div>
              <Lightbulb size={22} aria-hidden="true" />
            </div>
            <ol>
              <li>
                <strong>{attention ? `Talk about ${attention.title}` : "Name one routine that worked"}</strong>
                <span>
                  {attention
                    ? `${attention.missed + attention.rejected} check-off${attention.missed + attention.rejected === 1 ? "" : "s"} need attention. Ask what got in the way before deciding what to change.`
                    : "Ask what made it easier to remember, then keep that cue."}
                </span>
              </li>
              <li>
                <strong>Check the check-off</strong>
                <span>
                  A missed record may mean the chore was forgotten, the check-off was forgotten, or the timing did not
                  work. Let the child explain.
                </span>
              </li>
              <li>
                <strong>{win ? `Borrow a cue from ${win.title}` : "Choose one small shared cue"}</strong>
                <span>
                  {win
                    ? `It had ${win.completed} recorded completion${win.completed === 1 ? "" : "s"}. Try its reminder, time, or location for the harder chore.`
                    : "Pick a visual reminder, a routine partner, or a more realistic time — then revisit it next week."}
                </span>
              </li>
            </ol>
            <p className="weekly-note">
              This is a conversation guide, not a scorecard. Open and approval-pending chores are kept separate from
              missed work.
            </p>
          </section>

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
