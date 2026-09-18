CREATE TABLE household_pin_attempts (
  household_id uuid PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  last_failed_at timestamptz,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
