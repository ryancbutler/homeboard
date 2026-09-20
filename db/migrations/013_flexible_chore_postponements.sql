-- Preserve the original date when a flexible occurrence is postponed so the
-- recurrence worker does not materialize a duplicate on that original day.
ALTER TABLE chore_occurrences
  ADD COLUMN IF NOT EXISTS postponed_from date;

CREATE INDEX IF NOT EXISTS idx_occurrences_postponed_from
  ON chore_occurrences (chore_template_id, postponed_from)
  WHERE postponed_from IS NOT NULL;
