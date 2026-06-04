# Bonfire Night Planner — Claude Guide

---

## ⚠️ MOST IMPORTANT RULE — READ THIS FIRST ⚠️

**If Claude is not 100% certain about ANY aspect of a task — the intent, the approach, the scope, the design, the data model, anything — Claude MUST stop and ask questions using `AskUserQuestion` BEFORE writing any code or making any changes.**

**Do not guess. Do not assume. Do not proceed on incomplete information.**

### The questioning standard

- **Aim for at least 3 questions or more per user prompt**, even for seemingly simple requests.
- It is always better to ask too many questions than to build the wrong thing.
- Questions should cover: intent ("what problem are you solving?"), scope ("what should this NOT do?"), and design ("how should it look/behave?").
- If a request touches multiple concerns (UI + DB + API), ask about each layer separately.
- Do not bundle everything into one vague question — ask specific, targeted questions with clear options where possible.

### Examples of when to ask

| Situation | Do this |
|---|---|
| User asks for "a new page" | Ask what data it shows, who can see it, how it should be laid out |
| User asks to "fix a bug" | Ask for steps to reproduce, expected vs actual behaviour, whether a workaround exists |
| User asks to "add a feature" | Ask for the full user journey, edge cases, whether DB changes are needed |
| User asks to "make it look better" | Ask what specifically looks wrong, what the target feel is, which breakpoints matter |
| Any DB schema change | Ask whether a migration is needed, whether existing data needs backfilling |

**When in doubt: STOP AND ASK. Always use `AskUserQuestion` — never just ask in plain text, as the structured tool gives the user clear options and is easier to answer quickly.**

---

## What this project is

A personal event-planning PWA for one annual Bonfire Night celebration. It is both **beautiful and operationally useful on the night** — neither aspect is sacrificed for the other. The app is used from a phone on the night itself.

Built with: React + TypeScript + Vite + TanStack Query + Tailwind CSS v4 (via `@tailwindcss/vite`) + Cloudflare Pages + Cloudflare D1 (SQLite) + Hono (API routes via `functions/api/[[route]].ts`).

---

## Running the project

```bash
npm install        # package manager is npm (package-lock.json is the lockfile)
npm run dev        # Vite dev server (frontend only)
```

For full-stack local dev (API + D1) run Wrangler alongside Vite:
```bash
npx wrangler pages dev -- npm run dev
```

Build: `npm run build` (runs `tsc -b && vite build`)

---

## Database

- **D1 (SQLite)** — no JSON columns, no native arrays. Store lists as comma-separated strings or in a related table.
- Migrations live in `migrations/` as numbered SQL files: `0001_xxx.sql`, `0002_xxx.sql`, etc.
- The D1 database name is **`bonfire-night-db`**.
- **Apply migrations with the tracked runner** (records applied migrations in the `d1_migrations` table and runs only new ones — never re-runs old ones):
  ```bash
  npm run db:migrate          # local  (wrangler d1 migrations apply --local)
  npm run db:migrate:prod     # production (--remote)
  npm run db:migrate:status   # list which migrations are still unapplied on prod
  ```
- **⚠️ Migrations do NOT run automatically on deploy.** A Cloudflare Pages build ships *code* only — the schema is untouched until you run `db:migrate:prod`. Forgetting this is the classic cause of a 500 ("no such column") on save after merging a feature that added a column.
- Always create a numbered migration file for every schema change — never modify the DB schema ad hoc. Use only additive `ALTER TABLE ADD COLUMN` / `CREATE TABLE` so the tracked runner stays append-only.
- Flag DB migrations in PR descriptions so they are easy to spot.

### One-time reconciliation (RUN THIS on prod after merging the tracked-migrations change)
The project switched from ad-hoc `wrangler d1 execute` to the tracked runner. Any database that had migrations applied the *old* way **must be reconciled once** so the runner doesn't try to re-run already-applied migrations. **This has not been done on production yet — run it post-merge and verify with `db:migrate:status`:**
```bash
npm run db:reconcile:prod   # mark already-present migrations as applied in d1_migrations
npm run db:migrate:prod     # then run only the genuinely-missing ones
npm run db:migrate:status   # verify: should report nothing left to apply
```
`scripts/reconcile-d1-migrations.sql` is self-detecting and idempotent — it marks a migration applied only if its signature column/table actually exists, and re-applies the `0011` rsvp backfill if a database got the column without it. A brand-new database needs no reconciliation; just run `db:migrate`.

---

## API

- All routes live in `functions/api/[[route]].ts` using **Hono**.
- Auth is enforced via `requireAuth(async (c, org) => {...})` — never bypass or weaken it.
- Persist only validated/normalised values to D1. Validate inputs (ranges, formats, ordering) before every `DB.prepare().bind().run()` call.
- Raw SQL prepared statements are the pattern — do not introduce an ORM without discussion.

---

## Frontend architecture

- **TanStack Query** for all server state (`useQuery`, `useMutation`). Invalidate after mutations; use `onMutate` optimistic updates for frequent interactions (sliders, toggles, check-ins).
- **Zustand** (`useEventStore`) for cross-component UI state (current event, auth).
- **Local `useState`** for component-scoped ephemeral state.
- File naming: `PascalCase.tsx`. Location: match the nearest neighbour (`src/components/`, `src/pages/admin/`, etc.).
- Component size: split when exceeding ~200 lines **or** when reused elsewhere. Single-use components can stay large if it keeps the logic in one place.
- Mobile-first. The primary user is on an iPhone during the event. Match layout patterns of the nearest similar component for collapsed/expanded defaults.

---

## Styling

### Theme tokens (mandatory)
Tailwind CSS v4 custom tokens defined in `src/index.css`:
- `fire-*` (950 → 100) — ember/flame colours
- `smoke-*` (900 → 100) — cool grey-smoke tones

**Never use standard Tailwind blue, gray, or slate** for primary UI chrome. Always reach for `fire-*` or `smoke-*` first.

### Light / dark mode
- Dark is the default (`color-scheme: dark` on `:root`).
- Light mode is system-driven via `@media (prefers-color-scheme: light)` in `src/index.css`. There is no JS toggle.
- When writing new styles, check `src/index.css` for existing `prefers-color-scheme: light` overrides and add matching light-mode rules for any new CSS custom properties.
- The fire/ember aesthetic applies in both modes — warm embers in dark, warm amber/sepia in light.

### Dynamic styles
- Use Tailwind utilities where possible; inline `style={}` props for computed values (SVG positions, generated gradients).
- Avoid `style` for things Tailwind can handle statically.

---

## Git & PR workflow

- **Branch strategy**: use a `claude/<short-description>` feature branch for anything non-trivial. For tiny isolated fixes (typo, single-line bug), committing directly to `main` is acceptable.
- **Always run `tsc -b --noEmit` before committing.** Never commit code that fails the TypeScript check.
- **Always create a PR after pushing** a feature branch — ready for review (not draft).
- Commit messages: concise present-tense summary + blank line + detail if needed. Include the session URL at the bottom (as currently done).
- PR descriptions: mention any DB migrations required so they are easy to apply.

---

## Testing

The project uses **Vitest + React Testing Library** (to be set up). Target full coverage:
- Pure logic functions: SunCalc helpers, food calculations, smart timing math, light-level calculations.
- API route handlers (Hono).
- React components (key interactions and render states).

When setting up tests, use `vitest` with `@testing-library/react` and `@testing-library/user-event`. Keep test files co-located: `Foo.test.ts` / `Foo.test.tsx` alongside the source.

---

## Accessibility

Always add relevant ARIA attributes to new interactive elements:
- `aria-label` on icon-only buttons
- `role` and `aria-expanded` on disclosure/accordion patterns
- `aria-live` on dynamic status regions (toasts, counts)
- Proper `<label>` association for all inputs

---

## Opportunistic fixes

While working on a task, silently fix truly trivial issues in the same file (unused variables, typos, duplicate imports). Flag — but do not touch — anything larger or out of scope.

---

## Key constraints to remember

1. **SQLite / D1**: no JSON columns, no arrays, no `RETURNING` in older D1 builds — keep queries simple.
2. **Theme tokens**: `fire-*` and `smoke-*` are mandatory. No standard Tailwind grays for primary UI.
3. **Light mode exists**: it's `prefers-color-scheme` based. New CSS custom properties need light-mode overrides in `src/index.css`.
4. **Mobile first**: the primary user is on a phone at night. Tap targets, contrast, and readability in low light matter.
5. **PWA**: the app is installed as a PWA (`vite-plugin-pwa`). Don't break the service worker or manifest.
6. **No test suite yet**: tests are planned with Vitest — don't skip this when working on new logic-heavy features.
