ALTER TABLE households
  ADD COLUMN IF NOT EXISTS subheading text NOT NULL DEFAULT 'Your people. Your little wins. Your home, together.',
  ADD COLUMN IF NOT EXISTS show_banner boolean NOT NULL DEFAULT true;
