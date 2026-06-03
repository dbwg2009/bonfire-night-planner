-- Contribution milestone tracker.
-- Run with: npx wrangler d1 execute bonfire-night-db --remote --file=./migrations/0006_milestones.sql

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  amount INTEGER NOT NULL,        -- cumulative target in pence
  emoji TEXT DEFAULT '',          -- e.g. "🎆"
  icon_preset TEXT DEFAULT '',    -- key from preset library
  icon_image TEXT DEFAULT '',     -- base64 encoded compressed image
  important INTEGER NOT NULL DEFAULT 1,  -- 1 = show on compact bar, 0 = full tracker only
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_milestones_event ON milestones(event_id, amount);
