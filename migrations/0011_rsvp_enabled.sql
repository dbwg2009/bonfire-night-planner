-- Add rsvp_enabled flag per event.
-- The public /api/public/event endpoint and guest dashboard only surface the event
-- where rsvp_enabled = 1. New events default to 0 so adding a future year does not
-- silently hijack the live RSVP page.
--
-- Run locally:  npx wrangler d1 execute bonfire-planner --file=migrations/0011_rsvp_enabled.sql
-- Run remotely: npx wrangler d1 execute bonfire-planner --file=migrations/0011_rsvp_enabled.sql --remote

ALTER TABLE events ADD COLUMN rsvp_enabled INTEGER NOT NULL DEFAULT 0;

-- Enable RSVP for whichever event currently serves the public dashboard
-- (the most recent non-archived event, matching the old endpoint behaviour).
UPDATE events
SET rsvp_enabled = 1
WHERE id = (
  SELECT id FROM events
  WHERE status != 'archived'
  ORDER BY year DESC
  LIMIT 1
);
