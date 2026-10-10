-- PostgreSQL migration baseline: 015
CREATE TABLE member_absences (
  id text PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  member_id text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  start_date text NOT NULL,
  end_date text NOT NULL,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (start_date <= end_date)
);
CREATE INDEX idx_member_absences_dates ON member_absences(household_id, member_id, start_date, end_date);
