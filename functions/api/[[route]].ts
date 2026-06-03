import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'

interface Env {
  DB: D1Database
  JWT_SECRET: string
  MET_OFFICE_API_KEY?: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }))

// JWT secret + algorithm.
//
// hono's verify() REQUIRES the algorithm to be passed explicitly. Calling
// verify(token, secret) throws `JwtAlgorithmRequired` before it ever checks the
// signature, so every authenticated request failed with a 401 regardless of the
// secret — which is what bounced users back to login. sign() defaults to HS256,
// so verify() must be told HS256 too.
const DEFAULT_JWT_SECRET = 'change-this-to-a-secure-random-string-in-production'
const JWT_ALG = 'HS256' as const
const getSecret = (env: Env) => env.JWT_SECRET ?? DEFAULT_JWT_SECRET

// ─── Auth helpers ──────────────────────────────────────────────────────────────

async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(pin + 'bonfire-salt-v1')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function getOrganiserFromToken(c: any): Promise<{ organiser: Record<string, unknown> | null; reason: string }> {
  const auth = c.req.header('Authorization')
  if (!auth) return { organiser: null, reason: 'no_auth_header' }
  if (!auth.startsWith('Bearer ')) return { organiser: null, reason: 'no_bearer_prefix' }
  const token = auth.slice(7)
  if (!token) return { organiser: null, reason: 'empty_token' }
  try {
    const payload = await verify(token, getSecret(c.env), JWT_ALG) as Record<string, unknown>
    return { organiser: payload, reason: 'ok' }
  } catch {
    return { organiser: null, reason: 'verify_failed' }
  }
}

function requireAuth(handler: (c: any, organiser: any) => Promise<Response>) {
  return async (c: any) => {
    const { organiser, reason } = await getOrganiserFromToken(c)
    if (!organiser) return c.json({ error: 'Unauthorised', reason }, 401)
    return handler(c, organiser)
  }
}

// JSON helpers
function parseJson<T>(val: string | null, fallback: T): T {
  if (!val) return fallback
  try { return JSON.parse(val) } catch { return fallback }
}

function mapEvent(row: Record<string, unknown>) {
  return { ...row, conflict_event_enabled: row.conflict_event_enabled === 1 }
}

function mapOrganiser(row: Record<string, unknown>) {
  return { ...row, is_owner: row.is_owner === 1, permissions: parseJson(row.permissions as string, {}) }
}

function mapGuest(row: Record<string, unknown>) {
  return {
    ...row,
    dietary: parseJson(row.dietary as string, []),
    dietary_restrictions: parseJson(row.dietary_restrictions as string, []),
    on_whatsapp: row.on_whatsapp === 1,
    conflict_event: row.conflict_event === 1
  }
}

function mapCheckin(row: Record<string, unknown>) {
  return { ...row, checked_in: row.checked_in === 1 }
}

function mapLocation(row: Record<string, unknown>) {
  return { ...row, pros: parseJson(row.pros as string, []), cons: parseJson(row.cons as string, []), fire_permission: row.fire_permission === 1, fireworks_permission: row.fireworks_permission === 1 }
}

// ─── Public (no auth) ─────────────────────────────────────────────────────────

// Returns safe public event info for the guest-facing view
app.get('/api/public/event', async (c) => {
  const event = await c.env.DB.prepare(
    "SELECT id, year, name, date, meeting_location, event_location, conflict_event_enabled, conflict_event_name FROM events WHERE status != 'archived' ORDER BY year DESC LIMIT 1"
  ).first()
  if (!event) return c.json({ error: 'No active event' }, 404)
  return c.json(mapEvent(event as Record<string, unknown>))
})

// Returns a single guest's public info (name, rsvp, pickup_time) — used for personalised guest links
app.get('/api/public/guest/:id', async (c) => {
  const guest = await c.env.DB.prepare(
    'SELECT id, name, rsvp_status, dietary, pickup_time FROM guests WHERE id = ?'
  ).bind(c.req.param('id')).first()
  if (!guest) return c.json({ error: 'Guest not found' }, 404)
  return c.json({ ...guest, dietary: parseJson(guest.dietary as string, []) })
})

// ─── Status / health (public) ──────────────────────────────────────────────────

const STATUS_COMPONENTS: { key: string; label: string }[] = [
  { key: 'frontend', label: 'Frontend' },
  { key: 'api', label: 'API / Functions' },
  { key: 'database', label: 'Database (D1)' },
  { key: 'auth', label: 'Auth service' },
  { key: 'open_meteo', label: 'Open-Meteo' },
  { key: 'met_office', label: 'Met Office DataHub' }
]

// Runs live health checks, records them to D1 for a rough recent-history view,
// and returns current status + uptime. Public — no auth.
app.get('/api/status', async (c) => {
  const origin = new URL(c.req.url).origin

  const check = async (key: string, fn: () => Promise<void>) => {
    const start = Date.now()
    try {
      await fn()
      return { key, ok: true, latency_ms: Date.now() - start, error: null as string | null }
    } catch (e) {
      return { key, ok: false, latency_ms: Date.now() - start, error: e instanceof Error ? e.message : String(e) }
    }
  }

  // api is up by definition (we're responding); the client measures round-trip.
  const results = [{ key: 'api', ok: true, latency_ms: 0, error: null as string | null }]

  results.push(await check('database', async () => {
    const r = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>()
    if (!r || r.ok !== 1) throw new Error('unexpected query result')
  }))

  results.push(await check('auth', async () => {
    // Exercise the full JWT sign+verify pipeline (the class of bug that broke
    // login) and confirm the organisers table is reachable.
    const token = await sign({ t: 1, exp: Math.floor(Date.now() / 1000) + 60 }, getSecret(c.env), JWT_ALG)
    await verify(token, getSecret(c.env), JWT_ALG)
    await c.env.DB.prepare('SELECT COUNT(*) AS n FROM organisers').first()
  }))

  results.push(await check('open_meteo', async () => {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=51.82&longitude=-3.02&daily=temperature_2m_max&forecast_days=1',
      { signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) throw new Error('HTTP ' + res.status)
  }))

  results.push(await check('met_office', async () => {
    const key = c.env.MET_OFFICE_API_KEY
    if (!key) throw new Error('API key not configured')
    const res = await fetch(
      'https://data.hub.api.metoffice.gov.uk/sitespecific/v0/point/daily?latitude=51.82&longitude=-3.02&includeLocationName=false',
      { headers: { apikey: key, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) throw new Error('HTTP ' + res.status)
  }))

  results.push(await check('frontend', async () => {
    const res = await fetch(origin + '/', { headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(6000) })
    if (!res.ok) throw new Error('index HTTP ' + res.status)
    if (!(await res.text()).includes('id="root"')) throw new Error('index missing app root')
  }))

  const now = new Date().toISOString()

  // Persist results + read recent history (best effort — never blocks live status).
  const history: Record<string, number[]> = {}
  try {
    await c.env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS status_checks (id TEXT PRIMARY KEY, checked_at TEXT NOT NULL, component TEXT NOT NULL, ok INTEGER NOT NULL, latency_ms INTEGER)'
    ).run()
    await c.env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_status_component_time ON status_checks(component, checked_at)'
    ).run()
    await c.env.DB.batch(results.map(r =>
      c.env.DB.prepare('INSERT INTO status_checks (id, checked_at, component, ok, latency_ms) VALUES (?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), now, r.key, r.ok ? 1 : 0, r.latency_ms)
    ))
    await c.env.DB.prepare("DELETE FROM status_checks WHERE checked_at < datetime('now', '-7 days')").run()
    const rows = (await c.env.DB.prepare(
      "SELECT component, ok FROM status_checks WHERE checked_at > datetime('now', '-1 day') ORDER BY checked_at ASC"
    ).all()).results as { component: string; ok: number }[]
    for (const row of rows) (history[row.component] ??= []).push(row.ok)
  } catch { /* history unavailable — still return live status */ }

  const components = STATUS_COMPONENTS.map(({ key, label }) => {
    const r = results.find(x => x.key === key)!
    const h = history[key] ?? []
    const okCount = h.filter(v => v === 1).length
    return {
      key,
      label,
      ok: r.ok,
      latency_ms: r.latency_ms,
      error: r.error,
      uptime_24h: h.length ? Math.round((okCount / h.length) * 1000) / 10 : null,
      history: h.slice(-40).map(v => v === 1)
    }
  })

  const allOk = components.every(x => x.ok)
  const anyOk = components.some(x => x.ok)
  return c.json({ checked_at: now, overall: allOk ? 'operational' : anyOk ? 'partial' : 'major', components })
})

// ─── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (c) => {
  const { pin } = await c.req.json()
  if (!pin) return c.json({ error: 'PIN required' }, 400)

  const hash = await hashPin(pin)
  const org = await c.env.DB.prepare('SELECT * FROM organisers WHERE pin_hash = ?').bind(hash).first()
  if (!org) return c.json({ error: 'Invalid PIN' }, 401)

  const payload = {
    id: org.id,
    name: org.name,
    event_id: org.event_id,
    is_owner: org.is_owner === 1,
    permissions: parseJson(org.permissions as string, {}),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 // 30 days
  }

  const token = await sign(payload, getSecret(c.env), JWT_ALG)
  return c.json({ token, organiser: mapOrganiser(org as Record<string, unknown>) })
})

// ─── Events ────────────────────────────────────────────────────────────────────

app.get('/api/events', requireAuth(async (c) => {
  const events = await c.env.DB.prepare('SELECT * FROM events ORDER BY year DESC').all()
  return c.json(events.results.map(mapEvent))
}))

app.get('/api/events/:id', requireAuth(async (c) => {
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(c.req.param('id')).first()
  if (!event) return c.json({ error: 'Not found' }, 404)
  return c.json(mapEvent(event as Record<string, unknown>))
}))

app.post('/api/events', requireAuth(async (c) => {
  const body = await c.req.json()
  await c.env.DB.prepare(
    'INSERT INTO events (id, year, name, date, status, meeting_location, event_location, conflict_event_enabled, conflict_event_name, food_split_ratio, food_buffer_factor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(body.id, body.year, body.name, body.date, body.status ?? 'planning', body.meeting_location ?? '', body.event_location ?? '', body.conflict_event_enabled ? 1 : 0, body.conflict_event_name ?? '', body.food_split_ratio ?? 0.6, body.food_buffer_factor ?? 1.1).run()
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(body.id).first()
  return c.json(mapEvent(event as Record<string, unknown>))
}))

app.put('/api/events/:id', requireAuth(async (c, org) => {
  const body = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE events SET name=?, date=?, meeting_location=?, event_location=?, conflict_event_enabled=?, conflict_event_name=?, food_split_ratio=?, food_buffer_factor=?, updated_at=datetime("now") WHERE id=?'
  ).bind(body.name, body.date, body.meeting_location ?? '', body.event_location ?? '', body.conflict_event_enabled ? 1 : 0, body.conflict_event_name ?? '', body.food_split_ratio ?? 0.6, body.food_buffer_factor ?? 1.1, c.req.param('id')).run()
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(c.req.param('id')).first()
  return c.json(mapEvent(event as Record<string, unknown>))
}))

// ─── Guests ────────────────────────────────────────────────────────────────────

app.get('/api/events/:eventId/guests', requireAuth(async (c) => {
  const guests = await c.env.DB.prepare('SELECT * FROM guests WHERE event_id = ? ORDER BY name').bind(c.req.param('eventId')).all()
  return c.json(guests.results.map(mapGuest))
}))

app.post('/api/events/:eventId/guests', requireAuth(async (c) => {
  const body = await c.req.json()
  await c.env.DB.prepare(
    'INSERT INTO guests (id, name, rsvp_status, dietary, dietary_restrictions, dietary_notes, pickup_time, emergency_contact, on_whatsapp, notes, conflict_event, event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(body.id, body.name, body.rsvp_status ?? 'pending', JSON.stringify(body.dietary ?? []), JSON.stringify(body.dietary_restrictions ?? []), body.dietary_notes ?? '', body.pickup_time ?? '', body.emergency_contact ?? '', body.on_whatsapp ? 1 : 0, body.notes ?? '', body.conflict_event ? 1 : 0, c.req.param('eventId')).run()
  const guest = await c.env.DB.prepare('SELECT * FROM guests WHERE id = ?').bind(body.id).first()
  return c.json(mapGuest(guest as Record<string, unknown>))
}))

app.put('/api/events/:eventId/guests/:id', requireAuth(async (c) => {
  const body = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE guests SET name=?, rsvp_status=?, dietary=?, dietary_restrictions=?, dietary_notes=?, pickup_time=?, emergency_contact=?, on_whatsapp=?, notes=?, conflict_event=?, updated_at=datetime("now") WHERE id=? AND event_id=?'
  ).bind(body.name, body.rsvp_status, JSON.stringify(body.dietary ?? []), JSON.stringify(body.dietary_restrictions ?? []), body.dietary_notes ?? '', body.pickup_time ?? '', body.emergency_contact ?? '', body.on_whatsapp ? 1 : 0, body.notes ?? '', body.conflict_event ? 1 : 0, c.req.param('id'), c.req.param('eventId')).run()
  const guest = await c.env.DB.prepare('SELECT * FROM guests WHERE id = ?').bind(c.req.param('id')).first()
  return c.json(mapGuest(guest as Record<string, unknown>))
}))

app.delete('/api/events/:eventId/guests/:id', requireAuth(async (c) => {
  await c.env.DB.prepare('DELETE FROM guests WHERE id = ? AND event_id = ?').bind(c.req.param('id'), c.req.param('eventId')).run()
  return c.json({ success: true })
}))

// Public RSVP (no auth required)
app.post('/api/events/:eventId/rsvp', async (c) => {
  const body = await c.req.json()
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO guests (id, name, rsvp_status, dietary, dietary_restrictions, dietary_notes, pickup_time, emergency_contact, event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, body.name, body.rsvp_status ?? 'pending', JSON.stringify(body.dietary ?? []), JSON.stringify(body.dietary_restrictions ?? []), body.dietary_notes ?? '', body.pickup_time ?? '', body.emergency_contact ?? '', c.req.param('eventId')).run()
  return c.json({ success: true, id })
})

// ─── Check-ins ─────────────────────────────────────────────────────────────────

app.get('/api/events/:eventId/checkins', requireAuth(async (c) => {
  const checkins = await c.env.DB.prepare('SELECT * FROM checkins WHERE event_id = ?').bind(c.req.param('eventId')).all()
  return c.json(checkins.results.map(mapCheckin))
}))

app.post('/api/events/:eventId/checkins', requireAuth(async (c) => {
  const { guest_id, location } = await c.req.json()
  const existing = await c.env.DB.prepare('SELECT * FROM checkins WHERE guest_id = ? AND location = ?').bind(guest_id, location).first()

  if (existing) {
    const newVal = existing.checked_in === 1 ? 0 : 1
    await c.env.DB.prepare('UPDATE checkins SET checked_in = ?, checked_in_at = ? WHERE guest_id = ? AND location = ?')
      .bind(newVal, newVal === 1 ? new Date().toISOString() : null, guest_id, location).run()
  } else {
    await c.env.DB.prepare('INSERT INTO checkins (id, guest_id, location, checked_in, checked_in_at, event_id) VALUES (?, ?, ?, 1, ?, ?)')
      .bind(crypto.randomUUID(), guest_id, location, new Date().toISOString(), c.req.param('eventId')).run()
  }

  const checkin = await c.env.DB.prepare('SELECT * FROM checkins WHERE guest_id = ? AND location = ?').bind(guest_id, location).first()
  return c.json(mapCheckin(checkin as Record<string, unknown>))
}))

// ─── Tasks ─────────────────────────────────────────────────────────────────────

app.get('/api/events/:eventId/tasks', requireAuth(async (c) => {
  const tasks = await c.env.DB.prepare('SELECT * FROM tasks WHERE event_id = ? ORDER BY stage, created_at').bind(c.req.param('eventId')).all()
  return c.json(tasks.results)
}))

app.post('/api/events/:eventId/tasks', requireAuth(async (c) => {
  const body = await c.req.json()
  await c.env.DB.prepare('INSERT INTO tasks (id, title, status, owner, stage, due_date, notes, event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(body.id, body.title, body.status ?? 'pending', body.owner ?? '', body.stage ?? 'pre_event', body.due_date ?? '', body.notes ?? '', c.req.param('eventId')).run()
  const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(body.id).first()
  return c.json(task)
}))

app.put('/api/events/:eventId/tasks/:id', requireAuth(async (c) => {
  const body = await c.req.json()
  await c.env.DB.prepare('UPDATE tasks SET title=?, status=?, owner=?, stage=?, due_date=?, notes=?, updated_at=datetime("now") WHERE id=? AND event_id=?')
    .bind(body.title, body.status, body.owner ?? '', body.stage, body.due_date ?? '', body.notes ?? '', c.req.param('id'), c.req.param('eventId')).run()
  const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(c.req.param('id')).first()
  return c.json(task)
}))

app.delete('/api/events/:eventId/tasks/:id', requireAuth(async (c) => {
  await c.env.DB.prepare('DELETE FROM tasks WHERE id = ? AND event_id = ?').bind(c.req.param('id'), c.req.param('eventId')).run()
  return c.json({ success: true })
}))

// ─── Schedule ──────────────────────────────────────────────────────────────────

app.get('/api/events/:eventId/schedule', requireAuth(async (c) => {
  const items = await c.env.DB.prepare('SELECT * FROM schedule_items WHERE event_id = ? ORDER BY sort_order, start_time').bind(c.req.param('eventId')).all()
  return c.json(items.results)
}))

app.post('/api/events/:eventId/schedule', requireAuth(async (c) => {
  const body = await c.req.json()
  await c.env.DB.prepare('INSERT INTO schedule_items (id, title, activity_type, start_time, end_time, location, owner, notes, sort_order, event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(body.id, body.title, body.activity_type ?? '', body.start_time ?? '', body.end_time ?? '', body.location ?? '', body.owner ?? '', body.notes ?? '', body.sort_order ?? 0, c.req.param('eventId')).run()
  const item = await c.env.DB.prepare('SELECT * FROM schedule_items WHERE id = ?').bind(body.id).first()
  return c.json(item)
}))

app.put('/api/events/:eventId/schedule/:id', requireAuth(async (c) => {
  const body = await c.req.json()
  await c.env.DB.prepare('UPDATE schedule_items SET title=?, activity_type=?, start_time=?, end_time=?, location=?, owner=?, notes=?, sort_order=? WHERE id=? AND event_id=?')
    .bind(body.title, body.activity_type ?? '', body.start_time ?? '', body.end_time ?? '', body.location ?? '', body.owner ?? '', body.notes ?? '', body.sort_order ?? 0, c.req.param('id'), c.req.param('eventId')).run()
  const item = await c.env.DB.prepare('SELECT * FROM schedule_items WHERE id = ?').bind(c.req.param('id')).first()
  return c.json(item)
}))

app.delete('/api/events/:eventId/schedule/:id', requireAuth(async (c) => {
  await c.env.DB.prepare('DELETE FROM schedule_items WHERE id = ? AND event_id = ?').bind(c.req.param('id'), c.req.param('eventId')).run()
  return c.json({ success: true })
}))

// ─── Finance ───────────────────────────────────────────────────────────────────

app.get('/api/events/:eventId/finance', requireAuth(async (c) => {
  const transactions = await c.env.DB.prepare('SELECT * FROM transactions WHERE event_id = ? ORDER BY created_at DESC').bind(c.req.param('eventId')).all()
  return c.json(transactions.results)
}))

app.post('/api/events/:eventId/finance', requireAuth(async (c) => {
  const body = await c.req.json()
  await c.env.DB.prepare('INSERT INTO transactions (id, description, category, budget_amount, actual_amount, transaction_date, paid_by, notes, transaction_type, event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(body.id, body.description, body.category ?? 'other', body.budget_amount ?? null, body.actual_amount ?? null, body.transaction_date ?? '', body.paid_by ?? '', body.notes ?? '', body.transaction_type ?? 'expense', c.req.param('eventId')).run()
  const tx = await c.env.DB.prepare('SELECT * FROM transactions WHERE id = ?').bind(body.id).first()
  return c.json(tx)
}))

app.put('/api/events/:eventId/finance/:id', requireAuth(async (c) => {
  const body = await c.req.json()
  await c.env.DB.prepare('UPDATE transactions SET description=?, category=?, budget_amount=?, actual_amount=?, transaction_date=?, paid_by=?, notes=?, transaction_type=? WHERE id=? AND event_id=?')
    .bind(body.description, body.category, body.budget_amount ?? null, body.actual_amount ?? null, body.transaction_date ?? '', body.paid_by ?? '', body.notes ?? '', body.transaction_type, c.req.param('id'), c.req.param('eventId')).run()
  const tx = await c.env.DB.prepare('SELECT * FROM transactions WHERE id = ?').bind(c.req.param('id')).first()
  return c.json(tx)
}))

app.delete('/api/events/:eventId/finance/:id', requireAuth(async (c) => {
  await c.env.DB.prepare('DELETE FROM transactions WHERE id = ? AND event_id = ?').bind(c.req.param('id'), c.req.param('eventId')).run()
  return c.json({ success: true })
}))

// ─── Locations ─────────────────────────────────────────────────────────────────

app.get('/api/events/:eventId/locations', requireAuth(async (c) => {
  const locs = await c.env.DB.prepare('SELECT * FROM locations WHERE event_id = ? ORDER BY status, name').bind(c.req.param('eventId')).all()
  return c.json(locs.results.map(mapLocation))
}))

app.post('/api/events/:eventId/locations', requireAuth(async (c) => {
  const body = await c.req.json()
  await c.env.DB.prepare('INSERT INTO locations (id, name, address, map_url, status, pros, cons, capacity, parking, accessibility, walk_time_from_meeting, fire_permission, fireworks_permission, notes, event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(body.id, body.name, body.address ?? '', body.map_url ?? '', body.status ?? 'considering', JSON.stringify(body.pros ?? []), JSON.stringify(body.cons ?? []), body.capacity ?? null, body.parking ?? null, body.accessibility ?? '', body.walk_time_from_meeting ?? null, body.fire_permission ? 1 : 0, body.fireworks_permission ? 1 : 0, body.notes ?? '', c.req.param('eventId')).run()
  const loc = await c.env.DB.prepare('SELECT * FROM locations WHERE id = ?').bind(body.id).first()
  return c.json(mapLocation(loc as Record<string, unknown>))
}))

app.put('/api/events/:eventId/locations/:id', requireAuth(async (c) => {
  const body = await c.req.json()
  await c.env.DB.prepare('UPDATE locations SET name=?, address=?, map_url=?, status=?, pros=?, cons=?, capacity=?, parking=?, accessibility=?, walk_time_from_meeting=?, fire_permission=?, fireworks_permission=?, notes=? WHERE id=? AND event_id=?')
    .bind(body.name, body.address ?? '', body.map_url ?? '', body.status, JSON.stringify(body.pros ?? []), JSON.stringify(body.cons ?? []), body.capacity ?? null, body.parking ?? null, body.accessibility ?? '', body.walk_time_from_meeting ?? null, body.fire_permission ? 1 : 0, body.fireworks_permission ? 1 : 0, body.notes ?? '', c.req.param('id'), c.req.param('eventId')).run()
  const loc = await c.env.DB.prepare('SELECT * FROM locations WHERE id = ?').bind(c.req.param('id')).first()
  return c.json(mapLocation(loc as Record<string, unknown>))
}))

app.delete('/api/events/:eventId/locations/:id', requireAuth(async (c) => {
  await c.env.DB.prepare('DELETE FROM locations WHERE id = ? AND event_id = ?').bind(c.req.param('id'), c.req.param('eventId')).run()
  return c.json({ success: true })
}))

// ─── Conflict schedule ─────────────────────────────────────────────────────────

app.get('/api/events/:eventId/conflict-schedule', requireAuth(async (c) => {
  const items = await c.env.DB.prepare('SELECT * FROM conflict_schedule WHERE event_id = ? ORDER BY sort_order, start_time').bind(c.req.param('eventId')).all()
  return c.json(items.results)
}))

app.post('/api/events/:eventId/conflict-schedule', requireAuth(async (c) => {
  const body = await c.req.json()
  await c.env.DB.prepare('INSERT INTO conflict_schedule (id, title, start_time, end_time, location, transport, notes, sort_order, event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(body.id, body.title, body.start_time ?? '', body.end_time ?? '', body.location ?? '', body.transport ?? '', body.notes ?? '', body.sort_order ?? 0, c.req.param('eventId')).run()
  const item = await c.env.DB.prepare('SELECT * FROM conflict_schedule WHERE id = ?').bind(body.id).first()
  return c.json(item)
}))

app.put('/api/events/:eventId/conflict-schedule/:id', requireAuth(async (c) => {
  const body = await c.req.json()
  await c.env.DB.prepare('UPDATE conflict_schedule SET title=?, start_time=?, end_time=?, location=?, transport=?, notes=?, sort_order=? WHERE id=? AND event_id=?')
    .bind(body.title, body.start_time ?? '', body.end_time ?? '', body.location ?? '', body.transport ?? '', body.notes ?? '', body.sort_order ?? 0, c.req.param('id'), c.req.param('eventId')).run()
  const item = await c.env.DB.prepare('SELECT * FROM conflict_schedule WHERE id = ?').bind(c.req.param('id')).first()
  return c.json(item)
}))

app.delete('/api/events/:eventId/conflict-schedule/:id', requireAuth(async (c) => {
  await c.env.DB.prepare('DELETE FROM conflict_schedule WHERE id = ? AND event_id = ?').bind(c.req.param('id'), c.req.param('eventId')).run()
  return c.json({ success: true })
}))

// ─── Organisers ────────────────────────────────────────────────────────────────

app.get('/api/events/:eventId/organisers', requireAuth(async (c) => {
  const orgs = await c.env.DB.prepare('SELECT id, name, color, is_owner, permissions, event_id, created_at FROM organisers WHERE event_id = ?').bind(c.req.param('eventId')).all()
  return c.json(orgs.results.map(mapOrganiser))
}))

app.post('/api/events/:eventId/organisers', requireAuth(async (c, org) => {
  if (!org.is_owner && !org.permissions.tasks_and_settings) return c.json({ error: 'Forbidden' }, 403)
  const body = await c.req.json()
  if (!body.pin) return c.json({ error: 'PIN required' }, 400)
  const hash = await hashPin(body.pin)
  await c.env.DB.prepare('INSERT INTO organisers (id, name, pin_hash, color, is_owner, permissions, event_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(body.id, body.name, hash, body.color ?? '#e85f00', body.is_owner ? 1 : 0, JSON.stringify(body.permissions ?? {}), c.req.param('eventId')).run()
  const o = await c.env.DB.prepare('SELECT id, name, color, is_owner, permissions, event_id, created_at FROM organisers WHERE id = ?').bind(body.id).first()
  return c.json(mapOrganiser(o as Record<string, unknown>))
}))

app.put('/api/events/:eventId/organisers/:id', requireAuth(async (c, org) => {
  if (!org.is_owner && !org.permissions.tasks_and_settings) return c.json({ error: 'Forbidden' }, 403)
  const body = await c.req.json()
  if (body.pin) {
    const hash = await hashPin(body.pin)
    await c.env.DB.prepare('UPDATE organisers SET name=?, pin_hash=?, color=?, is_owner=?, permissions=? WHERE id=? AND event_id=?')
      .bind(body.name, hash, body.color, body.is_owner ? 1 : 0, JSON.stringify(body.permissions ?? {}), c.req.param('id'), c.req.param('eventId')).run()
  } else {
    await c.env.DB.prepare('UPDATE organisers SET name=?, color=?, is_owner=?, permissions=? WHERE id=? AND event_id=?')
      .bind(body.name, body.color, body.is_owner ? 1 : 0, JSON.stringify(body.permissions ?? {}), c.req.param('id'), c.req.param('eventId')).run()
  }
  const o = await c.env.DB.prepare('SELECT id, name, color, is_owner, permissions, event_id, created_at FROM organisers WHERE id = ?').bind(c.req.param('id')).first()
  return c.json(mapOrganiser(o as Record<string, unknown>))
}))

app.delete('/api/events/:eventId/organisers/:id', requireAuth(async (c, org) => {
  if (!org.is_owner) return c.json({ error: 'Forbidden' }, 403)
  await c.env.DB.prepare('DELETE FROM organisers WHERE id = ? AND event_id = ?').bind(c.req.param('id'), c.req.param('eventId')).run()
  return c.json({ success: true })
}))

// ─── Weather proxy (keeps API keys server-side) ────────────────────────────────

const MO_CODES: Record<number, string> = {
  0:'Clear night',1:'Sunny',2:'Partly cloudy',3:'Partly cloudy',5:'Mist',6:'Fog',
  7:'Cloudy',8:'Overcast',9:'Light shower',10:'Light shower',11:'Drizzle',12:'Light rain',
  13:'Heavy shower',14:'Heavy shower',15:'Heavy rain',16:'Sleet shower',17:'Sleet shower',
  18:'Sleet',19:'Hail shower',20:'Hail shower',21:'Hail',22:'Light snow',23:'Light snow',
  24:'Light snow',25:'Heavy snow',26:'Heavy snow',27:'Heavy snow',28:'Thunderstorm',
  29:'Thunderstorm',30:'Thunderstorm'
}

const WMO_CODES: Record<number, string> = {
  0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Icy fog',
  51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',
  65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',80:'Light showers',
  81:'Showers',82:'Heavy showers',95:'Thunderstorm',99:'Thunderstorm with hail'
}

app.get('/api/weather/forecast', async (c) => {
  const lat = parseFloat(c.req.query('lat') ?? '51.822')
  const lon = parseFloat(c.req.query('lon') ?? '-3.016')
  const targetDate = c.req.query('date') ?? new Date().toISOString().split('T')[0]

  const daysUntil = Math.ceil((new Date(targetDate).getTime() - Date.now()) / 86400000)

  interface ForecastEntry {
    date: string
    temp_max: number
    temp_min: number
    temp_avg: number
    precipitation_probability: number
    wind_speed: number
    weather_description: string
    weight: number
  }

  const entries: ForecastEntry[] = []

  // Open-Meteo (free, always)
  if (daysUntil <= 16 && daysUntil >= 0) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,weathercode&timezone=Europe%2FLondon&forecast_days=16`
      const res = await fetch(url)
      if (res.ok) {
        const data: Record<string, Record<string, unknown>[]> = await res.json() as Record<string, Record<string, unknown>[]>
        const idx = (data.daily.time as string[]).indexOf(targetDate)
        if (idx !== -1) {
          const tmax = data.daily.temperature_2m_max[idx] as number
          const tmin = data.daily.temperature_2m_min[idx] as number
          entries.push({
            date: targetDate,
            temp_max: tmax,
            temp_min: tmin,
            temp_avg: (tmax + tmin) / 2,
            precipitation_probability: data.daily.precipitation_probability_max[idx] as number ?? 0,
            wind_speed: data.daily.windspeed_10m_max[idx] as number ?? 0,
            weather_description: WMO_CODES[data.daily.weathercode[idx] as number] ?? 'Unknown',
            weight: 0.35
          })
        }
      }
    } catch { /* Open-Meteo unavailable */ }
  }

  // Met Office DataPoint (if API key is configured)
  const moKey = c.env.MET_OFFICE_API_KEY
  if (moKey && daysUntil <= 7 && daysUntil >= 0) {
    try {
      const url = `https://data.hub.api.metoffice.gov.uk/sitespecific/v0/point/daily?latitude=${lat}&longitude=${lon}&includeLocationName=false`
      const res = await fetch(url, { headers: { apikey: moKey, Accept: 'application/json' } })
      if (res.ok) {
        const data = await res.json() as { features?: Array<{ properties?: { timeSeries?: Array<Record<string,unknown>> } }> }
        const series = data.features?.[0]?.properties?.timeSeries ?? []
        const entry = series.find(p => typeof p.time === 'string' && p.time.startsWith(targetDate))
        if (entry) {
          const tmax = entry.dayMaxScreenTemperature as number ?? 10
          const tmin = entry.nightMinScreenTemperature as number ?? 5
          entries.push({
            date: targetDate,
            temp_max: tmax,
            temp_min: tmin,
            temp_avg: (tmax + tmin) / 2,
            precipitation_probability: Math.max(
              entry.dayProbabilityOfPrecipitation as number ?? 0,
              entry.nightProbabilityOfPrecipitation as number ?? 0
            ),
            wind_speed: entry.midday10MWindSpeed as number ?? 0,
            weather_description: MO_CODES[entry.daySignificantWeatherCode as number ?? 0] ?? 'Unknown',
            weight: 0.65
          })
        }
      }
    } catch { /* Met Office unavailable */ }
  }

  if (entries.length === 0) {
    // Return November 5th historical average for UK
    return c.json({
      date: targetDate,
      temp_max: 10, temp_min: 5, temp_avg: 7.5,
      precipitation_probability: 55,
      wind_speed: 20,
      weather_description: 'Typically cloudy with some rain likely',
      confidence: 0.3,
      is_estimate: true,
      sources: ['Historical average']
    })
  }

  const totalWeight = entries.reduce((s, e) => s + e.weight, 0)
  const w = (e: ForecastEntry) => e.weight / totalWeight

  return c.json({
    date: targetDate,
    temp_max: Math.round(entries.reduce((s, e) => s + e.temp_max * w(e), 0) * 10) / 10,
    temp_min: Math.round(entries.reduce((s, e) => s + e.temp_min * w(e), 0) * 10) / 10,
    temp_avg: Math.round(entries.reduce((s, e) => s + e.temp_avg * w(e), 0) * 10) / 10,
    precipitation_probability: Math.round(Math.max(...entries.map(e => e.precipitation_probability))),
    wind_speed: Math.round(entries.reduce((s, e) => s + e.wind_speed * w(e), 0)),
    weather_description: entries.sort((a, b) => b.weight - a.weight)[0].weather_description,
    confidence: Math.min(totalWeight, 1),
    is_estimate: false,
    sources: entries.map(e => e.weight > 0.4 ? 'Met Office' : 'Open-Meteo')
  })
})

export const onRequest = handle(app)
