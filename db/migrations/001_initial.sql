CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE member_role AS ENUM ('parent', 'child');
CREATE TYPE assignment_policy AS ENUM ('individual', 'any', 'every');
CREATE TYPE schedule_kind AS ENUM ('once', 'daily', 'weekdays', 'weekly');
CREATE TYPE obligation_status AS ENUM ('open', 'pending', 'completed', 'rejected', 'missed');
CREATE TYPE approval_status AS ENUM ('not_required', 'pending', 'approved', 'rejected');

CREATE TABLE households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  fridge_pin_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  role member_role NOT NULL,
  display_name text NOT NULL,
  email text,
  color text NOT NULL DEFAULT '#4F46E5',
  avatar_url text,
  password_hash text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, email)
);

CREATE TABLE identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  provider text NOT NULL,
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, subject)
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  email text,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_by uuid NOT NULL REFERENCES members(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE display_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  label text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE device_pair_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_by uuid NOT NULL REFERENCES members(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chore_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text,
  assignment_policy assignment_policy NOT NULL DEFAULT 'individual',
  approval_required boolean NOT NULL DEFAULT false,
  schedule_kind schedule_kind NOT NULL,
  start_date date NOT NULL,
  due_time time,
  weekdays smallint[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chore_template_assignees (
  chore_template_id uuid NOT NULL REFERENCES chore_templates(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (chore_template_id, member_id)
);

CREATE TABLE chore_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_template_id uuid NOT NULL REFERENCES chore_templates(id) ON DELETE RESTRICT,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  scheduled_for date NOT NULL,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chore_template_id, scheduled_for)
);

CREATE TABLE chore_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id uuid NOT NULL REFERENCES chore_occurrences(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  status obligation_status NOT NULL DEFAULT 'open',
  approval_status approval_status NOT NULL DEFAULT 'not_required',
  completed_by uuid REFERENCES members(id) ON DELETE SET NULL,
  completed_at timestamptz,
  reviewed_by uuid REFERENCES members(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_note text,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE routine_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title text NOT NULL,
  assignment_policy assignment_policy NOT NULL DEFAULT 'individual',
  schedule_kind schedule_kind NOT NULL,
  start_date date NOT NULL,
  due_time time,
  weekdays smallint[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE routine_template_assignees (
  routine_template_id uuid NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (routine_template_id, member_id)
);

CREATE TABLE routine_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_template_id uuid NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
  position integer NOT NULL,
  title text NOT NULL,
  icon text,
  UNIQUE (routine_template_id, position)
);

CREATE TABLE routine_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_template_id uuid NOT NULL REFERENCES routine_templates(id) ON DELETE RESTRICT,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  scheduled_for date NOT NULL,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (routine_template_id, scheduled_for, member_id)
);

CREATE TABLE routine_step_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_run_id uuid NOT NULL REFERENCES routine_runs(id) ON DELETE CASCADE,
  routine_step_id uuid NOT NULL REFERENCES routine_steps(id) ON DELETE CASCADE,
  completed_by uuid REFERENCES members(id) ON DELETE SET NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (routine_run_id, routine_step_id)
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES members(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_occurrences_household_date ON chore_occurrences(household_id, scheduled_for);
CREATE INDEX idx_obligations_status ON chore_obligations(status);
CREATE UNIQUE INDEX idx_obligation_one_per_assignee ON chore_obligations (occurrence_id, COALESCE(member_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX idx_routine_runs_household_date ON routine_runs(household_id, scheduled_for);
