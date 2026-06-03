import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { cors } from 'hono/cors'
import { jwt } from 'hono/jwt'
import { sign, verify } from 'hono/jwt'

interface Env {
  DB: D1Database
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }))

// JWT secret fallback
const getSecret = (env: Env) => env.JWT_SECRET ?? 'bonfire-night-dev-secret-change-in-production'

// ─── Auth helpers ──────────────────────────────────────────────────────────────

async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(pin + 'bonfire-salt-v1')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function getOrganiserFromToken(c: any): Promise<{ id: string; event_id: string; is_owner: boolean; permissions: Record<string, boolean> } | null> {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const payload = await verify(auth.slice(7), getSecret(c.env)) as Record<string, unknown>
    return payload as any
  } catch {
    return null
  }
}

function requireAuth(handler: (c: any, organiser: any) => Promise<Response>) {
  return async (c: any) => {
    const organiser = await getOrganiserFromToken(c)
    if (!organiser) return c.json({ error: 'Unauthorised' }, 401)
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
  return { ...row, dietary: parseJson(row.dietary as string, []), on_whatsapp: row.on_whatsapp === 1, conflict_event: row.conflict_event === 1 }
}

function mapCheckin(row: Record<string, unknown>) {
  return { ...row, checked_in: row.checked_in === 1 }
}

function mapLocation(row: Record<string, unknown>) {
  return { ...row, pros: parseJson(row.pros as string, []), cons: parseJson(row.cons as string, []), fire_permission: row.fire_permission === 1, fireworks_permission: row.fireworks_permission === 1 }
}

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

  const token = await sign(payload, getSecret(c.env))
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

app.post('/api/events', requireAuth(async (c, org) => {
  if (!org.is_owner) return c.json({ error: 'Forbidden' }, 403)
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
    'INSERT INTO guests (id, name, rsvp_status, dietary, pickup_time, emergency_contact, on_whatsapp, notes, conflict_event, event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(body.id, body.name, body.rsvp_status ?? 'pending', JSON.stringify(body.dietary ?? []), body.pickup_time ?? '', body.emergency_contact ?? '', body.on_whatsapp ? 1 : 0, body.notes ?? '', body.conflict_event ? 1 : 0, c.req.param('eventId')).run()
  const guest = await c.env.DB.prepare('SELECT * FROM guests WHERE id = ?').bind(body.id).first()
  return c.json(mapGuest(guest as Record<string, unknown>))
}))

app.put('/api/events/:eventId/guests/:id', requireAuth(async (c) => {
  const body = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE guests SET name=?, rsvp_status=?, dietary=?, pickup_time=?, emergency_contact=?, on_whatsapp=?, notes=?, conflict_event=?, updated_at=datetime("now") WHERE id=? AND event_id=?'
  ).bind(body.name, body.rsvp_status, JSON.stringify(body.dietary ?? []), body.pickup_time ?? '', body.emergency_contact ?? '', body.on_whatsapp ? 1 : 0, body.notes ?? '', body.conflict_event ? 1 : 0, c.req.param('id'), c.req.param('eventId')).run()
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
    'INSERT INTO guests (id, name, rsvp_status, dietary, pickup_time, emergency_contact, event_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, body.name, body.rsvp_status ?? 'pending', JSON.stringify(body.dietary ?? []), body.pickup_time ?? '', body.emergency_contact ?? '', c.req.param('eventId')).run()
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

export const onRequest = handle(app)
