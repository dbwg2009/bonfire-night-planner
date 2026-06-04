-- Status page check history.
-- The /api/status endpoint also creates this lazily (CREATE TABLE IF NOT EXISTS),
-- so running this manually is optional.
-- Run with: npx wrangler d1 execute bonfire-night-db --remote --file=./migrations/0004_status_checks.sql

CREATE TABLE IF NOT EXISTS status_checks (
  id TEXT PRIMARY KEY,
  checked_at TEXT NOT NULL,
  component TEXT NOT NULL,
  ok INTEGER NOT NULL,
  latency_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_status_component_time ON status_checks(component, checked_at);
