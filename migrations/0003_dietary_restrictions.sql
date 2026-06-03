-- Add dietary restrictions/allergen fields to guests
-- Run with: npx wrangler d1 execute bonfire-night-db --remote --file=./migrations/0003_dietary_restrictions.sql

ALTER TABLE guests ADD COLUMN dietary_restrictions TEXT DEFAULT '[]';
ALTER TABLE guests ADD COLUMN dietary_notes TEXT DEFAULT '';
