-- PostgreSQL migration baseline: 014
ALTER TABLE chore_templates ADD COLUMN day_part text CHECK(day_part IN ('morning','afternoon','evening'));
ALTER TABLE chore_templates ADD COLUMN display_order integer;
ALTER TABLE routine_templates ADD COLUMN day_part text CHECK(day_part IN ('morning','afternoon','evening'));
ALTER TABLE routine_templates ADD COLUMN display_order integer;
