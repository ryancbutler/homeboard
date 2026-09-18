-- A rescheduled obligation is a one-off replacement for one missed obligation.
-- Keeping the link lets reports retain the original missed record.
ALTER TABLE chore_obligations
  ADD COLUMN IF NOT EXISTS rescheduled_from_obligation_id uuid
    REFERENCES chore_obligations(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_obligations_one_reschedule_per_source
  ON chore_obligations (rescheduled_from_obligation_id)
  WHERE rescheduled_from_obligation_id IS NOT NULL;
