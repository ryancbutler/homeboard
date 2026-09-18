"use client";

import { ArrowUpDown, Check, Clock3, Download, RefreshCw, RotateCcw, Search } from "lucide-react";
import { useParentControllerContext } from "./parent-controller";

export function ApprovalsTab() {
  const {
    members,
    dashboard,
    busy,
    historyChildFilter,
    setHistoryChildFilter,
    historyStatusFilter,
    setHistoryStatusFilter,
    historySearch,
    setHistorySearch,
    historySortBy,
    setHistorySortBy,
    historySortOrder,
    setHistorySortOrder,
    perform,
    review,
    undoChore,
    openReschedule,
    filteredHistory,
    children,
    pending,
    formatHistorySchedule,
  } = useParentControllerContext();
  return (<>
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
                      onChange={(e) => setHistorySortBy(e.target.value as "date" | "chore" | "child" | "status")}
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
                      <th scope="col">Schedule</th>
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
                          <td><span className="history-schedule-tag">{formatHistorySchedule(row)}</span></td>
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
          </>);
}
