-- Add light level settings to events
ALTER TABLE events ADD COLUMN light_walk_by TEXT DEFAULT '';
ALTER TABLE events ADD COLUMN light_fireworks_after TEXT DEFAULT '';
ALTER TABLE events ADD COLUMN light_notes TEXT DEFAULT '';
ALTER TABLE events ADD COLUMN lat REAL;
ALTER TABLE events ADD COLUMN lon REAL;

-- Add light level target to schedule items (0–100, manually assigned)
ALTER TABLE schedule_items ADD COLUMN light_level_target INTEGER;
