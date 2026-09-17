CREATE TABLE chore_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name text NOT NULL,
  assigned_member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, name)
);

ALTER TABLE chore_templates
  ADD COLUMN chore_group_id uuid REFERENCES chore_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_chore_templates_group ON chore_templates(chore_group_id);
