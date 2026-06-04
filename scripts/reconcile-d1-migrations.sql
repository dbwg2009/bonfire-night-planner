-- ──────────────────────────────────────────────────────────────────────────────
-- ONE-TIME D1 MIGRATION RECONCILIATION
-- ──────────────────────────────────────────────────────────────────────────────
--
-- Background: migrations 0001–0011 were originally applied ad-hoc with
-- `wrangler d1 execute --file=...`, which does NOT record anything in a tracking
-- table. We are switching to `wrangler d1 migrations apply`, which tracks applied
-- migrations in a `d1_migrations` table and only runs ones it hasn't seen.
--
-- Run this ONCE against any database that already had migrations applied the old
-- way (i.e. production). It creates the tracking table (matching wrangler's exact
-- schema) and marks a migration as "already applied" ONLY if that migration's
-- signature object (a column or table it introduced) is actually present. Any
-- migration whose effect is missing is deliberately left untracked, so the
-- subsequent `wrangler d1 migrations apply` will run exactly the missing ones.
--
-- Safe to run more than once (INSERT OR IGNORE + IF NOT EXISTS).
--
--   Local:   npx wrangler d1 execute bonfire-night-db --local  --file=./scripts/reconcile-d1-migrations.sql
--   Remote:  npx wrangler d1 execute bonfire-night-db --remote --file=./scripts/reconcile-d1-migrations.sql
--
-- Then run:  npm run db:migrate:prod      (applies only the still-missing migrations)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS d1_migrations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 0001: base schema → the events table exists
INSERT OR IGNORE INTO d1_migrations (name) SELECT '0001_schema.sql'
  WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='events');

-- 0002: 2025 seed → the seeded event row exists
INSERT OR IGNORE INTO d1_migrations (name) SELECT '0002_seed_2025.sql'
  WHERE EXISTS (SELECT 1 FROM events WHERE id='evt-2025');

-- 0003: guests.dietary_restrictions column
INSERT OR IGNORE INTO d1_migrations (name) SELECT '0003_dietary_restrictions.sql'
  WHERE EXISTS (SELECT 1 FROM pragma_table_info('guests') WHERE name='dietary_restrictions');

-- 0004: status_checks table
INSERT OR IGNORE INTO d1_migrations (name) SELECT '0004_status_checks.sql'
  WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='status_checks');

-- 0005: events.contribution_link column
INSERT OR IGNORE INTO d1_migrations (name) SELECT '0005_contribution_link.sql'
  WHERE EXISTS (SELECT 1 FROM pragma_table_info('events') WHERE name='contribution_link');

-- 0006: milestones table
INSERT OR IGNORE INTO d1_migrations (name) SELECT '0006_milestones.sql'
  WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='milestones');

-- 0007: pickup_slots table
INSERT OR IGNORE INTO d1_migrations (name) SELECT '0007_pickup_slots.sql'
  WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='pickup_slots');

-- 0008: notifications table
INSERT OR IGNORE INTO d1_migrations (name) SELECT '0008_notifications.sql'
  WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='notifications');

-- 0009: events.light_walk_by column
INSERT OR IGNORE INTO d1_migrations (name) SELECT '0009_light_levels.sql'
  WHERE EXISTS (SELECT 1 FROM pragma_table_info('events') WHERE name='light_walk_by');

-- 0010: events.setup_duration_mins column
INSERT OR IGNORE INTO d1_migrations (name) SELECT '0010_light_levels_settings.sql'
  WHERE EXISTS (SELECT 1 FROM pragma_table_info('events') WHERE name='setup_duration_mins');

-- 0011: events.rsvp_enabled column
INSERT OR IGNORE INTO d1_migrations (name) SELECT '0011_rsvp_enabled.sql'
  WHERE EXISTS (SELECT 1 FROM pragma_table_info('events') WHERE name='rsvp_enabled');

-- 0011 also has a DATA side-effect: enable RSVP for the latest non-archived event.
-- Marking the migration applied on column-existence alone would skip that backfill
-- on a DB that got the column ad-hoc. Re-apply it idempotently (no-op once any
-- event already has rsvp_enabled = 1, so a deliberate "RSVP off everywhere" state
-- set *after* the backfill is left untouched as long as one event still has it on).
UPDATE events SET rsvp_enabled = 1
WHERE EXISTS (SELECT 1 FROM pragma_table_info('events') WHERE name='rsvp_enabled')
  AND NOT EXISTS (SELECT 1 FROM events WHERE rsvp_enabled = 1)
  AND id = (
    SELECT id FROM events
    WHERE status != 'archived'
    ORDER BY year DESC
    LIMIT 1
  );
