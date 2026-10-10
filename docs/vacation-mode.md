# Vacation mode

Parents schedule time away under **Parent → Family → Vacation mode**. Choose one or more children and the first and last away days. Both days are included, using the household timezone. Single days, past dates, and overlapping ranges are supported. Overlapping or adjacent ranges produce one continuous away period and return date.

Away children stay visible on the board with an **Away through** message and return date. Their task lists and progress indicators pause. Normal schedules resume the following day; away-day work does not become a catch-up list.

## Chores, routines, and reporting

- Individual and per-child chores are excused when their scheduled date is covered. Open, rejected, and missed chores appear as **Excused — away** in history.
- Flexible weekly chores use their scheduled due date, including after postponement or rescheduling. A chore due after the child returns remains due.
- Shared chores and routines stay available to eligible children who are home. An occurrence is excused only when every eligible child is away on its scheduled date. Individual responsibilities are not transferred, and weekly rotations continue normally.
- Completed work and pending approvals keep their recorded status and credit. Partial routine completions are preserved.
- Excused chores are excluded from expected counts, completion rates, and attention lists. Reports include an excused count, and CSV exports include both the displayed status and `raw_status`.
- Editing or deleting a range recalculates dates immediately. Dates no longer covered by another range count normally again, including past missed chores.

The scheduler still materializes occurrences and records overdue statuses. Vacation excusal is a view of that history, calculated from current absence ranges rather than a destructive update to task statuses. This preserves reversibility and does not introduce routine-history reporting.

## API and storage

All absence endpoints require parent access and scope operations to the current household:

| Endpoint                              | Behavior                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/member-absences`         | List ranges as `{ id, memberId, startDate, endDate }`.                                                        |
| `POST /api/v1/member-absences`        | Accept `{ memberIds, startDate, endDate }`; create all selected children's ranges atomically and return them. |
| `PUT /api/v1/member-absences/[id]`    | Replace a range's start/end dates; keep its child unchanged.                                                  |
| `DELETE /api/v1/member-absences/[id]` | Delete a range and recalculate its coverage.                                                                  |

Creation and editing validate real `YYYY-MM-DD` dates, date order, and active children. Creation rejects duplicate IDs. Changes and imports write audit events. Missing or foreign ranges return 404; unauthorized parent operations return 401.

`member_absences` stores household/child IDs, dates, and timestamps. PostgreSQL migration `015_member_absences.sql` and SQLite migration `003_member_absences.sql` add it without rewriting existing completion data. Child deletion cascades to its ranges.

Dashboard children include `away: null | { startDate, endDate, returnDate }`. Shared routines include `eligibleChildIds`. Completion and routine-step endpoints recheck vacation coverage to reject stale paused-work actions.

Setup backup version 5 includes `absences: [{ child, startDate, endDate }]`, using the existing child-name mapping. Imports skip identical ranges, preserve history, and accept older backups without absence data. Unknown vacation child names fail the import transaction.

## Verification

Run `npm test`, `npx tsc --noEmit`, `npm run build`, and `npm run validate:migrations`. Vacation integration tests use an in-memory SQLite database by default and cover upgrades, range changes, shared eligibility, completion/approval preservation, routines, CSV, backups, recurrence, and household midnight.

To run the same integration suite against PostgreSQL, point `VACATION_TEST_DATABASE_URL` at an empty, disposable test database and run `npx vitest run src/lib/vacation.integration.test.ts`. The suite applies all migrations and writes synthetic fixture data. Recreate that database before another run.
