DROP TABLE IF EXISTS photo_assets CASCADE;
DROP TABLE IF EXISTS calendar_event_projections CASCADE;
DROP TABLE IF EXISTS selected_calendars CASCADE;
DROP TABLE IF EXISTS calendar_connections CASCADE;

ALTER TABLE households
  DROP COLUMN IF EXISTS show_calendar,
  DROP COLUMN IF EXISTS slideshow_idle_seconds;
