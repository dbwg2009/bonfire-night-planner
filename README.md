# 🔥 Bonfire Night Planner

A fully tailored mobile-first web app for planning an annual Bonfire Night event. Built with React, Vite, Cloudflare Pages, and Cloudflare D1.

## Features

- **Guest management** — RSVP tracking, dietary preferences, pick-up scheduling, emergency contacts
- **PIN-based admin login** — Square-style keypad, custom roles per co-organiser
- **Live check-in register** — Tap to check guests in at meeting point and destination
- **Smart food calculator** — Weighted algorithm with configurable split ratio and buffer
- **Finance tracker** — Contributions and expenses with budget vs actual
- **Tasks** — Full to-do list with stages, owners and due dates
- **Schedule** — Evening timeline with activity types and map links
- **Venue locations** — Compare potential venues with pros/cons, permissions, logistics
- **Conflicting event planner** — Sub-event scheduling (e.g. school production on the same night)
- **Weather widget** — Met Office + Open-Meteo cross-referenced, with light levels (golden hour, sunset, full dark)
- **WhatsApp copy** — One-tap formatted messages for pick-ups, RSVP summary, shopping list, event info
- **Full PWA** — Install to home screen, fire/ember particle animations

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS v4
- **UI**: Custom glassmorphism components (shadcn/ui patterns + Radix UI primitives)
- **Routing**: React Router v7
- **State**: TanStack Query + Zustand (with persistence)
- **API**: Hono on Cloudflare Pages Functions
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Auth**: PIN-based with SHA-256 hashing + JWT tokens
- **PWA**: vite-plugin-pwa + Workbox

## Deployment

### 1. Install Wrangler
```bash
npm install -g wrangler
wrangler login
```

### 2. Create D1 database
```bash
cd bonfire-night-planner
npm run db:create
```
Copy the `database_id` from the output and paste it into `wrangler.toml` replacing the placeholder.

### 3. Run migrations
Applies every migration in `migrations/` via the tracked runner (`wrangler d1 migrations apply`), which records applied migrations in a `d1_migrations` table and only ever runs new ones.
```bash
npm run db:migrate:prod      # apply all pending migrations to production
npm run db:migrate:status    # list which migrations are still unapplied on prod
```
> **Migrations do not run automatically on deploy.** A Pages build ships code only — re-run `npm run db:migrate:prod` whenever you merge a change that adds a migration, or saves will 500 with `no such column`.
>
> **Already have a database that was migrated the old way** (ad-hoc `wrangler d1 execute`)? Reconcile it once so the tracked runner doesn't re-run old migrations:
> ```bash
> npm run db:reconcile:prod   # mark already-applied migrations as tracked
> npm run db:migrate:prod     # then apply only the genuinely-missing ones
> ```

### 4. Connect to Cloudflare Pages
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Select the `bonfire-night-planner` repository
3. Build settings:
   - **Framework**: Vite
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
4. Add environment variables:
   - `JWT_SECRET` — a long random string (run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `MET_OFFICE_API_KEY` — your Met Office DataPoint API key (get free at metoffice.gov.uk/services/data/datapoint)
5. Deploy

### 5. Bind D1 to Pages
After the first deploy:
1. Pages project → **Settings** → **Functions** → **D1 database bindings**
2. Variable name: `DB`, Database: `bonfire-night-db`
3. Redeploy (any new push will trigger this)

### 6. Seed your first event and owner account
Run these in your terminal (replace values as needed):

```bash
# Create the 2026 event
wrangler d1 execute bonfire-night-db --remote --command \
  "INSERT INTO events (id,year,name,date,status,meeting_location,event_location,food_split_ratio,food_buffer_factor) VALUES ('evt-2026',2026,'Bonfire Night 2026','2026-11-05','planning','21 Agincourt Square','TBC',0.6,1.1)"

# Create your owner account (replace PIN_HASH with the hash of your PIN)
wrangler d1 execute bonfire-night-db --remote --command \
  "INSERT INTO organisers (id,name,pin_hash,color,is_owner,permissions,event_id) VALUES ('org-owner','Daniel','PIN_HASH_HERE','#e85f00',1,'{\"guest_management\":true,\"finance\":true,\"check_in\":true,\"tasks_and_settings\":true}','evt-2026')"
```

To generate your PIN hash, open the browser console on your deployed site and run:
```js
const h = await (async p => {
  const d = new TextEncoder().encode(p + 'bonfire-salt-v1')
  const hash = await crypto.subtle.digest('SHA-256', d)
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,'0')).join('')
})('YOUR_PIN')
```

## Local development

```bash
npm install
npm run dev        # Frontend only (API calls will fail — no local D1)
```

For full local dev with the API:
```bash
npm run db:migrate  # Run migrations against local D1
npm run pages:dev   # Cloudflare Pages dev server with D1 binding
```
