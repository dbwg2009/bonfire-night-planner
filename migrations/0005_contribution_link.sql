-- Contribution link and match funding ratio on events.
-- Run with: npx wrangler d1 execute bonfire-night-db --remote --file=./migrations/0005_contribution_link.sql

ALTER TABLE events ADD COLUMN contribution_link TEXT;
ALTER TABLE events ADD COLUMN contribution_match_ratio REAL NOT NULL DEFAULT 0.5;
