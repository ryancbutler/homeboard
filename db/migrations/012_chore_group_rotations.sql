CREATE TABLE chore_group_rotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  first_group_id uuid NOT NULL REFERENCES chore_groups(id) ON DELETE CASCADE,
  second_group_id uuid NOT NULL REFERENCES chore_groups(id) ON DELETE CASCADE,
  first_member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  second_member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (first_group_id <> second_group_id),
  CHECK (first_member_id <> second_member_id),
  CHECK (EXTRACT(ISODOW FROM start_date) = 1)
);

CREATE UNIQUE INDEX idx_chore_group_rotations_first_group ON chore_group_rotations(first_group_id);
CREATE UNIQUE INDEX idx_chore_group_rotations_second_group ON chore_group_rotations(second_group_id);
