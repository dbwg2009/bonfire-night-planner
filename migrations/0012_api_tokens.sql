-- Long-lived API tokens for the Claude MCP connector (/api/mcp/<token>).
-- Only a SHA-256 hash of each token is stored; the plaintext is shown once at
-- creation. A token acts as the organiser who created it, with that organiser's
-- current permissions, and is revoked by deleting its row.
--
-- Apply with the tracked runner:  npm run db:migrate  /  npm run db:migrate:prod

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  organiser_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL UNIQUE,
  token_hint TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (organiser_id) REFERENCES organisers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_api_tokens_event ON api_tokens(event_id);
