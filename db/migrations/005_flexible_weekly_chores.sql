ALTER TABLE chore_templates
  ADD COLUMN IF NOT EXISTS is_flexible boolean NOT NULL DEFAULT false;
