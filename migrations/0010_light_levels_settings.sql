ALTER TABLE events ADD COLUMN setup_duration_mins INTEGER DEFAULT 30;
ALTER TABLE events ADD COLUMN slider_time_start TEXT DEFAULT '00:00';
ALTER TABLE events ADD COLUMN slider_time_end TEXT DEFAULT '23:59';
