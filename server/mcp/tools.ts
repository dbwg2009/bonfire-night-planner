import { calculateFood, generateShoppingListWhatsApp } from '../../src/lib/food-algorithm'
import { DEFAULT_LAT, DEFAULT_LON, computeSmartTiming, lightPctFromAlt, sunAltDegAt } from '../../src/lib/lightLevels'
import type { Guest } from '../../src/lib/types'
import SunCalc from 'suncalc'
import { s, type JsonSchema } from './schema'
import {
  ToolError, need, fmtUkTime, ukDateTime, middayUtc, todayUk, TIME_ZONE,
  type McpContext, type ToolDef
} from './context'

type Row = Record<string, unknown>

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const CREATE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
const UPDATE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const DELETE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }

const defined = (args: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined))

// ─── Generic CRUD factory ──────────────────────────────────────────────────────
//
// The REST PUT routes replace every column, so `update_*` tools read the current
// record, merge in only the fields Claude supplied, then PUT the merged record.

interface CrudSpec {
  path: string                        // REST path segment under /events/:eventId/
  singular: string                    // tool-name noun, e.g. "guest"
  plural: string                      // list tool-name noun, e.g. "guests"
  label: string                       // human label, e.g. "guest"
  about: string                       // extra description for the list tool
  fields: Record<string, JsonSchema>
  createRequired: string[]
  createOnly?: Record<string, JsonSchema>   // accepted on create (and optionally update) but not echoed
  filters?: Record<string, JsonSchema>      // exact-match list filters on same-named fields
  searchField?: string                // enables a case-insensitive `search` filter
  extractRows?: (data: unknown) => Row[]
  present?: (row: Row) => Row         // shape rows for Claude (e.g. strip base64 images)
  summarise?: (rows: Row[]) => Row    // extra totals returned alongside the list
  toBody?: (merged: Row, args: Row) => Row
  deleteNote?: string
}

function crud(spec: CrudSpec): ToolDef[] {
  const listPath = (ctx: McpContext) => `/events/${ctx.eventId}/${spec.path}`
  const extract = spec.extractRows ?? ((d: unknown) => d as Row[])
  const present = spec.present ?? ((r: Row) => r)
  const toBody = spec.toBody ?? ((merged: Row) => merged)
  const idArg = { id: s.str(`The ${spec.label}'s id (from list_${spec.plural}).`) }

  async function findRaw(ctx: McpContext, id: string): Promise<Row> {
    const rows = extract(await need(ctx.call('GET', listPath(ctx))))
    const row = rows.find(r => r.id === id)
    if (!row) throw new ToolError(`No ${spec.label} with id "${id}". Call list_${spec.plural} to find the right id.`)
    return row
  }

  const listProps: Record<string, JsonSchema> = { ...(spec.filters ?? {}) }
  if (spec.searchField) listProps.search = s.str(`Case-insensitive substring match on ${spec.searchField}.`)

  return [
    {
      name: `list_${spec.plural}`,
      title: `List ${spec.plural.replace(/_/g, ' ')}`,
      description: `List all ${spec.plural.replace(/_/g, ' ')} for the event. ${spec.about}`,
      inputSchema: s.obj(listProps),
      annotations: READ,
      async run(args, ctx) {
        let rows = extract(await need(ctx.call('GET', listPath(ctx))))
        for (const key of Object.keys(spec.filters ?? {})) {
          if (args[key] !== undefined) rows = rows.filter(r => r[key] === args[key])
        }
        if (spec.searchField && typeof args.search === 'string') {
          const q = args.search.toLowerCase()
          rows = rows.filter(r => String(r[spec.searchField!] ?? '').toLowerCase().includes(q))
        }
        return { count: rows.length, ...(spec.summarise ? spec.summarise(rows) : {}), [spec.plural]: rows.map(present) }
      }
    },
    {
      name: `add_${spec.singular}`,
      title: `Add ${spec.label}`,
      description: `Create a new ${spec.label}. Returns the created record including its id.`,
      inputSchema: s.obj({ ...spec.fields, ...(spec.createOnly ?? {}) }, spec.createRequired),
      annotations: CREATE,
      async run(args, ctx) {
        const body = toBody({ id: crypto.randomUUID(), ...defined(args) }, args)
        return present(await need(ctx.call('POST', listPath(ctx), body)))
      }
    },
    {
      name: `update_${spec.singular}`,
      title: `Update ${spec.label}`,
      description: `Update an existing ${spec.label}. Only the fields you pass are changed; everything else is kept.`,
      inputSchema: s.obj({ ...idArg, ...spec.fields, ...(spec.createOnly ?? {}) }, ['id']),
      annotations: UPDATE,
      async run(args, ctx) {
        const { id, ...changes } = args as { id: string } & Row
        const current = await findRaw(ctx, id)
        const body = toBody({ ...current, ...defined(changes) }, changes)
        return present(await need(ctx.call('PUT', `${listPath(ctx)}/${encodeURIComponent(id)}`, body)))
      }
    },
    {
      name: `delete_${spec.singular}`,
      title: `Delete ${spec.label}`,
      description: `Permanently delete a ${spec.label}. ${spec.deleteNote ?? ''}`.trim(),
      inputSchema: s.obj(idArg, ['id']),
      annotations: DELETE,
      async run(args, ctx) {
        const id = args.id as string
        const row = await findRaw(ctx, id)
        await need(ctx.call('DELETE', `${listPath(ctx)}/${encodeURIComponent(id)}`))
        return { deleted: true, id, [spec.label]: present(row) }
      }
    }
  ]
}

// ─── Resource definitions ──────────────────────────────────────────────────────

const RSVP_STATUSES = ['in_consideration', 'invited', 'accepted', 'declined'] as const
const TASK_STATUSES = ['pending', 'in_progress', 'completed'] as const
const TASK_STAGES = ['pre_event', 'day_of', 'post_event'] as const
const TX_CATEGORIES = ['contribution', 'venue', 'food', 'equipment', 'other'] as const
const TX_TYPES = ['expense', 'contribution'] as const
const LOCATION_STATUSES = ['considering', 'rejected', 'chosen'] as const

const guestFields: Record<string, JsonSchema> = {
  name: s.str('Guest name.', { minLength: 1 }),
  rsvp_status: s.enum(RSVP_STATUSES, 'in_consideration = not yet invited; invited = waiting for a reply; accepted; declined.'),
  dietary: s.arr(s.enum(['burger', 'sausage'], 'Food choice'), 'What they will eat from the BBQ (drives food quantities). Empty = nothing.'),
  dietary_restrictions: s.arr(s.str('Allergen or restriction'), 'Allergens / things they cannot eat, e.g. ["gluten", "nuts"].'),
  dietary_notes: s.str('Free-text dietary notes, e.g. "severe nut allergy — carries an EpiPen".'),
  pickup_time: s.str('Pickup slot label (see list_pickup_slots).'),
  emergency_contact: s.str('Emergency contact name/number.'),
  on_whatsapp: s.bool('Whether the guest is in the WhatsApp group.'),
  notes: s.str('Organiser notes.'),
  conflict_event: s.bool('Whether the guest is also attending the conflicting event.')
}

const taskFields: Record<string, JsonSchema> = {
  title: s.str('Task title.', { minLength: 1 }),
  status: s.enum(TASK_STATUSES, 'Task status.'),
  owner: s.str('Who is responsible (free text, usually an organiser name).'),
  stage: s.enum(TASK_STAGES, 'When the task happens.'),
  due_date: s.str('Due date, YYYY-MM-DD (or empty).'),
  notes: s.str('Notes.')
}

const scheduleFields: Record<string, JsonSchema> = {
  title: s.str('Schedule item title.', { minLength: 1 }),
  activity_type: s.str('Category, e.g. Transportation, Setup, Activity, Fireworks, Food.'),
  start_time: s.str('Start time HH:MM (24h, UK time) or empty.'),
  end_time: s.str('End time HH:MM (24h, UK time) or empty.'),
  location: s.str('Where it happens.'),
  owner: s.str('Who runs it.'),
  notes: s.str('Notes.'),
  sort_order: s.int('Manual ordering tie-breaker.'),
  light_level_target: s.nullable(s.int('Desired light level 0–100 (null = automatic).', { minimum: 0, maximum: 100 }))
}

const transactionFields: Record<string, JsonSchema> = {
  description: s.str('What the money is for / from.', { minLength: 1 }),
  category: s.enum(TX_CATEGORIES, 'Category.'),
  transaction_type: s.enum(TX_TYPES, 'expense = money going out; contribution = money coming in from guests.'),
  budget_amount: s.nullable(s.num('Budgeted amount in pounds (GBP), e.g. 25.50.')),
  actual_amount: s.nullable(s.num('Actual amount in pounds (GBP).')),
  transaction_date: s.str('Date, YYYY-MM-DD (or empty).'),
  paid_by: s.str('Who paid / contributed.'),
  notes: s.str('Notes.')
}

const milestoneFields: Record<string, JsonSchema> = {
  name: s.str('Milestone name, e.g. "Rockets".', { minLength: 1 }),
  description: s.str('What this milestone unlocks.'),
  amount: s.int('Cumulative contributions target in PENCE (e.g. 5000 = £50).', { minimum: 1 }),
  emoji: s.str('Emoji shown with the milestone.'),
  important: s.bool('Highlight as an important milestone.')
}

const locationFields: Record<string, JsonSchema> = {
  name: s.str('Venue name.', { minLength: 1 }),
  address: s.str('Address.'),
  map_url: s.str('Map link.'),
  status: s.enum(LOCATION_STATUSES, 'Shortlist status. The "chosen" venue drives walk-time for smart timing.'),
  pros: s.arr(s.str('Pro'), 'List of pros.'),
  cons: s.arr(s.str('Con'), 'List of cons.'),
  capacity: s.nullable(s.int('Capacity (people).', { minimum: 0 })),
  parking: { type: ['string', 'null'], enum: ['none', 'limited', 'ample', null], description: 'Parking availability.' },
  accessibility: s.str('Accessibility notes.'),
  walk_time_from_meeting: s.nullable(s.int('Walking minutes from the meeting point.', { minimum: 0 })),
  fire_permission: s.bool('Bonfire permitted.'),
  fireworks_permission: s.bool('Fireworks permitted.'),
  notes: s.str('Notes.')
}

const conflictFields: Record<string, JsonSchema> = {
  title: s.str('Item title.', { minLength: 1 }),
  start_time: s.str('Start time HH:MM or empty.'),
  end_time: s.str('End time HH:MM or empty.'),
  location: s.str('Location.'),
  transport: s.str('How people get there / back.'),
  notes: s.str('Notes.'),
  sort_order: s.int('Ordering.')
}

const pickupFields: Record<string, JsonSchema> = {
  label: s.str('Slot label shown to guests, e.g. "21:30 at the car park".', { minLength: 1 }),
  sort_order: s.int('Ordering.')
}

const permissionsSchema = s.obj({
  guest_management: s.bool('Add, edit, delete guests and RSVPs'),
  finance: s.bool('View and edit costs and contributions'),
  check_in: s.bool('Use the live check-in system'),
  tasks_and_settings: s.bool('Manage tasks, schedule and event settings')
})

const NO_PERMISSIONS = { guest_management: false, finance: false, check_in: false, tasks_and_settings: false }

const organiserFields: Record<string, JsonSchema> = {
  name: s.str('Organiser name.', { minLength: 1 }),
  color: s.str('Avatar colour hex, e.g. "#e85f00".', { pattern: '^#[0-9a-fA-F]{6}$' }),
  is_owner: s.bool('Owner = full access. Only owners can grant this.'),
  permissions: { ...permissionsSchema, description: 'Permission flags. Partial objects are merged with current values on update.' }
}

const sumBy = (rows: Row[], pred: (r: Row) => boolean, key: string) =>
  Math.round(rows.filter(pred).reduce((t, r) => t + (Number(r[key]) || 0), 0) * 100) / 100

const RESOURCES: CrudSpec[] = [
  {
    path: 'guests', singular: 'guest', plural: 'guests', label: 'guest',
    about: 'Includes RSVP status, food choices, allergies, pickup slot and emergency contact.',
    fields: guestFields, createRequired: ['name'],
    filters: { rsvp_status: guestFields.rsvp_status },
    searchField: 'name',
    deleteNote: 'Also removes their check-ins.'
  },
  {
    path: 'tasks', singular: 'task', plural: 'tasks', label: 'task',
    about: 'Planning to-dos grouped by stage (pre_event, day_of, post_event).',
    fields: taskFields, createRequired: ['title'],
    filters: { status: taskFields.status, stage: taskFields.stage },
    searchField: 'title'
  },
  {
    path: 'schedule', singular: 'schedule_item', plural: 'schedule', label: 'schedule item',
    about: 'The night-of run sheet, ordered by start time. Use get_sun_and_light_timing to see how dark it will be at each item.',
    fields: scheduleFields, createRequired: ['title']
  },
  {
    path: 'finance', singular: 'transaction', plural: 'transactions', label: 'transaction',
    about: 'Expenses and guest contributions, amounts in GBP. Also returns totals.',
    fields: transactionFields, createRequired: ['description'],
    filters: { transaction_type: transactionFields.transaction_type, category: transactionFields.category },
    searchField: 'description',
    summarise: rows => ({
      totals_gbp: {
        expenses_budgeted: sumBy(rows, r => r.transaction_type === 'expense', 'budget_amount'),
        expenses_actual: sumBy(rows, r => r.transaction_type === 'expense', 'actual_amount'),
        contributions: sumBy(rows, r => r.transaction_type === 'contribution', 'actual_amount')
      }
    })
  },
  {
    path: 'milestones', singular: 'milestone', plural: 'milestones', label: 'milestone',
    about: 'Contribution milestones guests unlock (amounts in pence). Also returns total_raised_pence. Requires owner or tasks_and_settings permission to change.',
    fields: milestoneFields, createRequired: ['name', 'amount'],
    extractRows: d => (d as { milestones: Row[] }).milestones,
    // icon_image is a base64 blob — useless to Claude and bloats context
    present: ({ icon_image, ...r }) => ({ ...r, has_custom_icon: !!icon_image })
  },
  {
    path: 'locations', singular: 'location', plural: 'locations', label: 'location',
    about: 'Candidate venues with pros/cons and permissions.',
    fields: locationFields, createRequired: ['name'],
    filters: { status: locationFields.status },
    searchField: 'name'
  },
  {
    path: 'conflict-schedule', singular: 'conflict_schedule_item', plural: 'conflict_schedule', label: 'conflict schedule item',
    about: 'Timings for the clashing event some guests also attend (see event conflict_event_name).',
    fields: conflictFields, createRequired: ['title']
  },
  {
    path: 'pickup-slots', singular: 'pickup_slot', plural: 'pickup_slots', label: 'pickup slot',
    about: 'Pickup time options guests pick from on the RSVP form.',
    fields: pickupFields, createRequired: ['label']
  },
  {
    path: 'organisers', singular: 'organiser', plural: 'organisers', label: 'organiser',
    about: 'People who can log in to the planner, with their permissions.',
    fields: organiserFields, createRequired: ['name', 'pin'],
    createOnly: { pin: s.str('Login PIN, 4–6 digits. Required when adding; on update, only pass to reset it.', { pattern: '^\\d{4,6}$' }) },
    toBody: (merged, args) => {
      const { pin, ...rest } = merged
      const perms = { ...NO_PERMISSIONS, ...(merged.permissions as Row ?? {}), ...(args.permissions as Row ?? {}) }
      return { ...rest, permissions: perms, ...(args.pin ? { pin } : {}) }
    },
    deleteNote: 'Owner only. Their Claude tokens stop working.'
  }
]

// ─── Event-level tools ─────────────────────────────────────────────────────────

const eventFields: Record<string, JsonSchema> = {
  name: s.str('Event name.', { minLength: 1, maxLength: 200 }),
  date: s.date('Event date YYYY-MM-DD.'),
  meeting_location: s.str('Where guests meet before walking to the venue.'),
  event_location: s.str('The bonfire venue.'),
  lat: s.nullable(s.num('Venue latitude (used for weather + sunset maths).', { minimum: -90, maximum: 90 })),
  lon: s.nullable(s.num('Venue longitude.', { minimum: -180, maximum: 180 })),
  rsvp_enabled: s.bool('Whether this event is the one shown on the public RSVP page.'),
  conflict_event_enabled: s.bool('Whether there is a clashing event some guests attend.'),
  conflict_event_name: s.str('Name of the clashing event.'),
  food_split_ratio: s.num('Portion each "both burger and sausage" guest counts for, 0.3–1.0 (default 0.6).', { minimum: 0.3, maximum: 1 }),
  food_buffer_factor: s.num('Food buffer multiplier, 1.0–1.3 (default 1.1 = +10%).', { minimum: 1, maximum: 1.3 }),
  contribution_link: s.nullable(s.str('Payment link shown to guests (e.g. monzo.me).')),
  contribution_match_ratio: s.num('Match-funding ratio 0–1 (0.5 = organisers add 50%).', { minimum: 0, maximum: 1 }),
  light_walk_by: s.str('Manual override "start walking by" time HH:MM, or "" for automatic.'),
  light_fireworks_after: s.str('Manual override "fireworks after" time HH:MM, or "" for automatic.'),
  light_notes: s.str('Free-text light/timing notes.'),
  setup_duration_mins: s.int('Minutes needed to set up at the venue (0–180).', { minimum: 0, maximum: 180 }),
  slider_time_start: s.time('Light Levels page slider start HH:MM.'),
  slider_time_end: s.time('Light Levels page slider end HH:MM.')
}

async function getEvent(ctx: McpContext): Promise<Row> {
  return need(ctx.call('GET', `/events/${ctx.eventId}`))
}

async function getAll(ctx: McpContext) {
  const base = `/events/${ctx.eventId}`
  // Optional sections degrade to empty when this organiser can't read them.
  const soft = async <T>(path: string, fallback: T): Promise<T> => {
    const r = await ctx.call('GET', path)
    return r.ok ? r.data as T : fallback
  }
  const [event, guests, checkins, tasks, schedule, finance, milestones, locations, notifications] = await Promise.all([
    getEvent(ctx),
    soft<Row[]>(`${base}/guests`, []),
    soft<Row[]>(`${base}/checkins`, []),
    soft<Row[]>(`${base}/tasks`, []),
    soft<Row[]>(`${base}/schedule`, []),
    soft<Row[]>(`${base}/finance`, []),
    soft<{ milestones: Row[]; total_raised: number }>(`${base}/milestones`, { milestones: [], total_raised: 0 }),
    soft<Row[]>(`${base}/locations`, []),
    soft<Row[]>(`${base}/notifications`, [])
  ])
  return { event, guests, checkins, tasks, schedule, finance, milestones, locations, notifications }
}

function countBy(rows: Row[], key: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) { const k = String(r[key] ?? ''); out[k] = (out[k] ?? 0) + 1 }
  return out
}

function daysUntil(date: string): number {
  return Math.round((middayUtc(date).getTime() - middayUtc(todayUk()).getTime()) / 86_400_000)
}

export async function buildOverview(ctx: McpContext) {
  const { event, guests, checkins, tasks, schedule, finance, milestones, notifications } = await getAll(ctx)
  const accepted = guests.filter(g => g.rsvp_status === 'accepted')
  const checkedIn = (loc: string) => checkins.filter(c => c.location === loc && c.checked_in).length
  const openTasks = tasks.filter(t => t.status !== 'completed')
  const raisedPence = milestones.total_raised
  const nextMilestone = milestones.milestones.find(m => Number(m.amount) > raisedPence)
  return {
    event: {
      id: event.id, name: event.name, date: event.date, status: event.status,
      days_until: daysUntil(String(event.date)),
      meeting_location: event.meeting_location, event_location: event.event_location,
      rsvp_page_enabled: event.rsvp_enabled,
      rsvp_link: `${ctx.origin}/rsvp/${event.id}`
    },
    you_are: ctx.organiser,
    guests: {
      total: guests.length,
      by_rsvp_status: countBy(guests, 'rsvp_status'),
      accepted_with_allergies: accepted
        .filter(g => (g.dietary_restrictions as string[])?.length || g.dietary_notes)
        .map(g => ({ name: g.name, restrictions: g.dietary_restrictions, notes: g.dietary_notes || undefined }))
    },
    check_in: {
      expected: accepted.length,
      at_meeting_point: checkedIn('meeting'),
      at_destination: checkedIn('destination')
    },
    tasks: {
      open: openTasks.length,
      completed: tasks.length - openTasks.length,
      open_by_stage: countBy(openTasks, 'stage'),
      next_up: openTasks.slice(0, 10).map(t => ({ id: t.id, title: t.title, stage: t.stage, owner: t.owner || undefined, due_date: t.due_date || undefined, status: t.status }))
    },
    schedule: schedule.map(i => ({ start_time: i.start_time || undefined, title: i.title, location: i.location || undefined })),
    money_gbp: {
      expenses_budgeted: sumBy(finance, r => r.transaction_type === 'expense', 'budget_amount'),
      expenses_actual: sumBy(finance, r => r.transaction_type === 'expense', 'actual_amount'),
      contributions: sumBy(finance, r => r.transaction_type === 'contribution', 'actual_amount'),
      next_milestone: nextMilestone
        ? { name: nextMilestone.name, target_gbp: Number(nextMilestone.amount) / 100, remaining_gbp: (Number(nextMilestone.amount) - raisedPence) / 100 }
        : null
    },
    unread_notifications: notifications.filter(n => !n.read).length
  }
}

export async function buildFood(ctx: McpContext, splitRatio?: number, bufferFactor?: number) {
  const [event, guests] = await Promise.all([
    getEvent(ctx),
    need(ctx.call('GET', `/events/${ctx.eventId}/guests`)) as Promise<Guest[]>
  ])
  const calc = calculateFood(
    guests,
    splitRatio ?? Number(event.food_split_ratio ?? 0.6),
    bufferFactor ?? Number(event.food_buffer_factor ?? 1.1)
  )
  const allergies = guests
    .filter(g => g.rsvp_status === 'accepted' && (g.dietary_restrictions?.length || g.dietary_notes))
    .map(g => ({ name: g.name, restrictions: g.dietary_restrictions, notes: g.dietary_notes || undefined }))
  return {
    calculation: calc,
    accepted_guests_with_dietary_needs: allergies,
    whatsapp_shopping_list: generateShoppingListWhatsApp(calc, String(event.name))
  }
}

export async function buildSunTiming(ctx: McpContext, date?: string, times?: string[]) {
  const [event, locations, schedule] = await Promise.all([
    getEvent(ctx),
    ctx.call('GET', `/events/${ctx.eventId}/locations`).then(r => (r.ok ? r.data : []) as Row[]),
    ctx.call('GET', `/events/${ctx.eventId}/schedule`).then(r => (r.ok ? r.data : []) as Row[])
  ])
  const day = date ?? String(event.date)
  const hasCoords = event.lat != null && event.lon != null
  const lat = hasCoords ? Number(event.lat) : DEFAULT_LAT
  const lon = hasCoords ? Number(event.lon) : DEFAULT_LON
  const walkMins = Number(locations.find(l => l.status === 'chosen')?.walk_time_from_meeting ?? 20)
  const setupMins = Number(event.setup_duration_mins ?? 30)

  const sun = SunCalc.getTimes(middayUtc(day), lat, lon)
  const timing = computeSmartTiming(middayUtc(day), lat, lon, walkMins, setupMins)
  const lightAt = (hhmm: string) => {
    const alt = sunAltDegAt(ukDateTime(day, hhmm), lat, lon)
    return { time: hhmm, sun_altitude_deg: Math.round(alt * 10) / 10, light_pct: lightPctFromAlt(alt) }
  }
  const isTime = (t: unknown): t is string => typeof t === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t)

  return {
    date: day,
    time_zone: TIME_ZONE,
    location: { lat, lon, source: hasCoords ? 'event settings' : 'default (event has no lat/lon set)' },
    light_scale: '0–100: sunset ≈ 60, civil dusk ≈ 25, nautical dusk ≈ 6, full dark (astronomical) = 0',
    sun: {
      sunrise: fmtUkTime(sun.sunrise),
      golden_hour_starts: fmtUkTime(sun.goldenHour),
      sunset: fmtUkTime(sun.sunset),
      civil_dusk: fmtUkTime(sun.dusk),
      nautical_dusk: fmtUkTime(sun.nauticalDusk),
      astronomical_dusk: fmtUkTime(sun.night)
    },
    smart_timing: {
      depart_meeting_point_by: fmtUkTime(timing.departBy),
      bonfire_window: { from: fmtUkTime(timing.bonfireStart), to: fmtUkTime(timing.bonfireEnd) },
      fireworks_after: fmtUkTime(timing.fireworksAfter),
      assumptions: { walk_mins: walkMins, setup_mins: setupMins, rule: 'setup finishes halfway between civil and nautical dusk' }
    },
    organiser_overrides: {
      walk_by: event.light_walk_by || null,
      fireworks_after: event.light_fireworks_after || null,
      notes: event.light_notes || null
    },
    light_at_requested_times: (times ?? []).filter(isTime).map(lightAt),
    schedule: schedule.map(i => ({
      title: i.title,
      start_time: i.start_time || null,
      light_level_target: i.light_level_target ?? null,
      ...(isTime(i.start_time) ? { light_pct: lightAt(i.start_time).light_pct } : {})
    }))
  }
}

export async function buildWeather(ctx: McpContext, date?: string) {
  const event = await getEvent(ctx)
  const lat = event.lat ?? DEFAULT_LAT
  const lon = event.lon ?? DEFAULT_LON
  const day = date ?? String(event.date)
  const forecast = await need(ctx.call('GET', `/weather/forecast?lat=${lat}&lon=${lon}&date=${day}`))
  return {
    ...forecast,
    note: forecast.is_estimate
      ? 'No live forecast yet (Open-Meteo covers 16 days ahead, Met Office 7) — this is a typical 5 November UK estimate.'
      : undefined
  }
}

const eventTools: ToolDef[] = [
  {
    name: 'get_event_overview',
    title: 'Event overview',
    description: 'One-call snapshot of the event: date and days to go, RSVP counts, allergy alerts, check-in progress, open tasks, schedule, money totals and next milestone. Start here.',
    inputSchema: s.obj({}),
    annotations: READ,
    run: (_args, ctx) => buildOverview(ctx)
  },
  {
    name: 'get_event',
    title: 'Get event settings',
    description: 'Full settings for the event this connector is linked to.',
    inputSchema: s.obj({}),
    annotations: READ,
    run: (_args, ctx) => getEvent(ctx)
  },
  {
    name: 'update_event',
    title: 'Update event settings',
    description: 'Change event settings. Only the fields you pass change. Requires owner or tasks_and_settings permission.',
    inputSchema: s.obj(eventFields),
    annotations: UPDATE,
    async run(args, ctx) {
      const current = await getEvent(ctx)
      return need(ctx.call('PUT', `/events/${ctx.eventId}`, { ...current, ...defined(args) }))
    }
  },
  {
    name: 'list_events',
    title: 'List all events',
    description: 'All years\' events (most recent first). Events more than 2 days in the past are auto-archived, as in the app. Other tools always act on the event this connector is linked to.',
    inputSchema: s.obj({}),
    annotations: READ,
    run: (_args, ctx) => need(ctx.call('GET', '/events'))
  },
  {
    name: 'create_event',
    title: 'Create a new event',
    description: 'Create a new year\'s event (as the app\'s setup screen does). Note: this connector stays linked to its current event; manage the new one in the app.',
    inputSchema: s.obj({
      name: s.str('Event name, e.g. "Bonfire Night 2027".', { minLength: 1 }),
      date: s.date('Event date YYYY-MM-DD.'),
      meeting_location: s.str('Meeting point.'),
      event_location: s.str('Venue.')
    }, ['name', 'date']),
    annotations: CREATE,
    run: (args, ctx) => need(ctx.call('POST', '/events', {
      id: crypto.randomUUID(),
      year: Number(String(args.date).slice(0, 4)),
      status: 'planning',
      conflict_event_enabled: false,
      food_split_ratio: 0.6,
      food_buffer_factor: 1.1,
      ...defined(args)
    }))
  },
  {
    name: 'delete_event',
    title: 'Delete the whole event',
    description: 'PERMANENTLY delete this event and ALL its data (guests, tasks, schedule, finances, organisers…). Owner only. Cannot be undone — confirm with the user first.',
    inputSchema: s.obj({ confirm_name: s.str('Must exactly match the event name, as a safety check.') }, ['confirm_name']),
    annotations: DELETE,
    async run(args, ctx) {
      const event = await getEvent(ctx)
      if (String(args.confirm_name).trim().toLowerCase() !== String(event.name).trim().toLowerCase()) {
        throw new ToolError(`confirm_name does not match the event name "${event.name}". Nothing was deleted.`)
      }
      await need(ctx.call('DELETE', `/events/${ctx.eventId}`))
      return { deleted: true, event: event.name }
    }
  }
]

// ─── Check-ins, notifications, RSVPs ───────────────────────────────────────────

const LOCATIONS = ['meeting', 'destination'] as const

const liveTools: ToolDef[] = [
  {
    name: 'list_checkins',
    title: 'Check-in register',
    description: 'Who has been checked in at the meeting point and at the destination, for every accepted guest (plus anyone checked in who is not marked accepted).',
    inputSchema: s.obj({ only_missing_at: s.enum(LOCATIONS, 'Only list guests NOT yet checked in at this location.') }),
    annotations: READ,
    async run(args, ctx) {
      const [guests, checkins] = await Promise.all([
        need(ctx.call('GET', `/events/${ctx.eventId}/guests`)) as Promise<Row[]>,
        need(ctx.call('GET', `/events/${ctx.eventId}/checkins`)) as Promise<Row[]>
      ])
      const state = (gid: unknown, loc: string) => {
        const c = checkins.find(x => x.guest_id === gid && x.location === loc)
        return c?.checked_in ? { checked_in: true, at: fmtUkTime(new Date(String(c.checked_in_at))) } : { checked_in: false }
      }
      let rows = guests
        .filter(g => g.rsvp_status === 'accepted' || checkins.some(c => c.guest_id === g.id && c.checked_in))
        .map(g => ({ guest_id: g.id, name: g.name, rsvp_status: g.rsvp_status, pickup_time: g.pickup_time || undefined, meeting: state(g.id, 'meeting'), destination: state(g.id, 'destination') }))
      const totals = {
        expected: rows.length,
        at_meeting: rows.filter(r => r.meeting.checked_in).length,
        at_destination: rows.filter(r => r.destination.checked_in).length
      }
      if (args.only_missing_at) rows = rows.filter(r => !r[args.only_missing_at as 'meeting' | 'destination'].checked_in)
      return { totals, guests: rows }
    }
  },
  {
    name: 'set_checkin',
    title: 'Check a guest in or out',
    description: 'Mark a guest as checked in (or not) at the meeting point or destination. Idempotent — safe to repeat.',
    inputSchema: s.obj({
      guest_id: s.str('Guest id (from list_guests or list_checkins).'),
      location: s.enum(LOCATIONS, 'Which register.'),
      checked_in: s.bool('true = checked in (default), false = undo.')
    }, ['guest_id', 'location']),
    annotations: UPDATE,
    async run(args, ctx) {
      const want = args.checked_in !== false
      const checkins = await need(ctx.call('GET', `/events/${ctx.eventId}/checkins`)) as Row[]
      const current = checkins.find(c => c.guest_id === args.guest_id && c.location === args.location)
      if (!!current?.checked_in === want) return { unchanged: true, ...current }
      // The REST endpoint toggles, so only call it when the state needs to flip.
      return need(ctx.call('POST', `/events/${ctx.eventId}/checkins`, { guest_id: args.guest_id, location: args.location }))
    }
  },
  {
    name: 'list_notifications',
    title: 'Notifications',
    description: 'Recent RSVP notifications (latest 50).',
    inputSchema: s.obj({ unread_only: s.bool('Only unread notifications.') }),
    annotations: READ,
    async run(args, ctx) {
      const rows = await need(ctx.call('GET', `/events/${ctx.eventId}/notifications`)) as Row[]
      return args.unread_only ? rows.filter(n => !n.read) : rows
    }
  },
  {
    name: 'mark_notifications_read',
    title: 'Mark notifications read',
    description: 'Mark all notifications as read.',
    inputSchema: s.obj({}),
    annotations: UPDATE,
    run: (_args, ctx) => need(ctx.call('POST', `/events/${ctx.eventId}/notifications/read-all`))
  },
  {
    name: 'submit_guest_rsvp',
    title: 'Submit an RSVP for a guest',
    description: 'Record an RSVP on behalf of an INVITED guest, exactly as if they filled in the public RSVP form (creates a notification). For other changes use update_guest.',
    inputSchema: s.obj({
      guest_id: s.str('Guest id — must currently have rsvp_status "invited".'),
      response: s.enum(['accepted', 'declined'], 'Their answer.'),
      dietary: guestFields.dietary,
      dietary_restrictions: guestFields.dietary_restrictions,
      dietary_notes: guestFields.dietary_notes,
      pickup_time: guestFields.pickup_time,
      emergency_contact: guestFields.emergency_contact
    }, ['guest_id', 'response']),
    annotations: CREATE,
    async run(args, ctx) {
      const { response, ...rest } = args
      await need(ctx.call('POST', `/events/${ctx.eventId}/rsvp`, { ...rest, rsvp_status: response }))
      return { success: true, guest_id: args.guest_id, rsvp_status: response }
    }
  },
  {
    name: 'cancel_guest_rsvp',
    title: 'Cancel a guest\'s RSVP',
    description: 'Cancel an ACCEPTED guest\'s RSVP (marks them declined and notifies organisers), as the public "can\'t make it" button does.',
    inputSchema: s.obj({ guest_id: s.str('Guest id — must currently be "accepted".') }, ['guest_id']),
    annotations: UPDATE,
    async run(args, ctx) {
      await need(ctx.call('POST', `/events/${ctx.eventId}/rsvp/cancel`, { guest_id: args.guest_id }))
      return { success: true, guest_id: args.guest_id, rsvp_status: 'declined' }
    }
  }
]

// ─── Computed helpers ──────────────────────────────────────────────────────────

const helperTools: ToolDef[] = [
  {
    name: 'calculate_food',
    title: 'Food quantities',
    description: 'How many burgers, sausages and buns to buy, using the app\'s food algorithm over accepted guests\' choices, plus allergy notes and a WhatsApp-ready shopping list.',
    inputSchema: s.obj({
      split_ratio: s.num('What-if override for the "both" portion ratio (0.3–1.0). Defaults to the event setting.', { minimum: 0.3, maximum: 1 }),
      buffer_factor: s.num('What-if override for the buffer (1.0–1.3). Defaults to the event setting.', { minimum: 1, maximum: 1.3 })
    }),
    annotations: READ,
    run: (args, ctx) => buildFood(ctx, args.split_ratio as number | undefined, args.buffer_factor as number | undefined)
  },
  {
    name: 'get_sun_and_light_timing',
    title: 'Sunset & light levels',
    description: 'Sunset/twilight times, the app\'s smart timing (leave-by, bonfire window, fireworks-after) and light level 0–100 at each schedule item, for the event date and venue. All times UK local.',
    inputSchema: s.obj({
      date: s.date('Date to calculate for (default: event date).'),
      times: s.arr(s.time('HH:MM'), 'Extra UK times to report the light level for, e.g. ["17:30", "18:15"].')
    }),
    annotations: READ,
    run: (args, ctx) => buildSunTiming(ctx, args.date as string | undefined, args.times as string[] | undefined)
  },
  {
    name: 'get_weather_forecast',
    title: 'Weather forecast',
    description: 'Blended Met Office + Open-Meteo forecast for the venue (falls back to a typical-November estimate when the date is too far ahead).',
    inputSchema: s.obj({ date: s.date('Date to forecast (default: event date).') }),
    annotations: { ...READ, openWorldHint: true },
    run: (args, ctx) => buildWeather(ctx, args.date as string | undefined)
  }
]

// ─── Assembly ──────────────────────────────────────────────────────────────────

const crudTools = RESOURCES.flatMap(crud)

// Milestone list needs the raw response for total_raised, so it replaces the generic list.
const listMilestones = crudTools.find(t => t.name === 'list_milestones')!
listMilestones.run = async (_args, ctx) => {
  const data = await need(ctx.call('GET', `/events/${ctx.eventId}/milestones`)) as { milestones: Row[]; total_raised: number }
  const next = data.milestones.find(m => Number(m.amount) > data.total_raised)
  return {
    count: data.milestones.length,
    total_raised_pence: data.total_raised,
    next_milestone: next ? { id: next.id, name: next.name, remaining_pence: Number(next.amount) - data.total_raised } : null,
    milestones: data.milestones.map(({ icon_image, ...m }) => ({ ...m, has_custom_icon: !!icon_image, unlocked: Number(m.amount) <= data.total_raised }))
  }
}

export const TOOLS: ToolDef[] = [...eventTools, ...liveTools, ...crudTools, ...helperTools]

export const TOOLS_BY_NAME = new Map(TOOLS.map(t => [t.name, t]))
