-- PostgreSQL otherwise treats NULL owners as distinct, creating another shared
-- routine on every worker run. Existing completions and routine runs are retained.
CREATE UNIQUE INDEX idx_routine_one_per_owner
  ON routine_runs (routine_template_id, scheduled_for, COALESCE(member_id, '00000000-0000-0000-0000-000000000000'::uuid));
