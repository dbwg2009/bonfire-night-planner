import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import SunCalc from 'suncalc'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { PageHeader, PageContent } from '../../components/Layout'
import { useEventStore } from '../../store/event'
import { api } from '../../lib/api'
import { generateId, cn } from '../../lib/utils'
import { toast } from '../../components/ui/toast'
import type { ScheduleItem, Event, Location } from '../../lib/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LAT = 51.822
const DEFAULT_LON = -3.016

const PRESET_EVENTS = [
  { title: 'Leaving meeting location', activity_type: 'Transportation' },
  { title: 'Arriving at venue',        activity_type: 'Transportation' },
  { title: 'Finishing setup',          activity_type: 'Setup'          },
  { title: 'Lighting bonfire',         activity_type: 'Activity'       },
  { title: 'Lighting fireworks',       activity_type: 'Fireworks'      },
] as const

// ─── Time helpers ───────────────────────────────────────────────────────────────

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(mins: number): string {
  const v = Math.max(0, Math.min(1439, Math.round(mins)))
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`
}

function getSunAltDeg(minutes: number, date: Date, lat: number, lon: number): number {
  const d = new Date(date)
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return (SunCalc.getPosition(d, lat, lon).altitude * 180) / Math.PI
}

// ─── Light / colour helpers ─────────────────────────────────────────────────────

// Perceptual brightness 0–100 from sun altitude. Anchored so that below the
// horizon reads low: sunset(0°)≈60, civil dusk(−6°)≈25, nautical(−12°)≈6, astro(−18°)=0.
function lightPctFromAlt(altDeg: number): number {
  const stops: [number, number][] = [[6, 100], [0, 60], [-6, 25], [-12, 6], [-18, 0]]
  if (altDeg >= stops[0][0]) return 100
  if (altDeg <= stops[stops.length - 1][0]) return 0
  for (let i = 0; i < stops.length - 1; i++) {
    const [a1, p1] = stops[i]
    const [a2, p2] = stops[i + 1]
    if (altDeg <= a1 && altDeg >= a2) {
      const t = (altDeg - a2) / (a1 - a2)
      return Math.round(p2 + t * (p1 - p2))
    }
  }
  return 0
}


function sunEmberColor(altDeg: number): string {
  // Fireball at altitude → cooling ember below the horizon
  if (altDeg > 30)  return '#ffd84d'
  if (altDeg > 15)  return '#ffae33'
  if (altDeg > 4)   return '#ff7a1a'
  if (altDeg > 0)   return '#ff5500'
  if (altDeg > -6)  return '#e23a00'
  if (altDeg > -12) return '#a82400'
  return '#5e1500'
}

function sunRadius(altDeg: number): number {
  if (altDeg > 10) return 12
  if (altDeg > 0)  return 10.5
  if (altDeg > -8) return 9
  return 7.5
}

function phaseEmoji(altDeg: number): string {
  const pct = lightPctFromAlt(altDeg)
  if (pct >= 60) return '☀️'
  if (pct >= 30) return '🌤'
  if (pct >= 12) return '🌇'
  if (pct > 0)   return '🌆'
  return '🌑'
}

// Sky panel: bright amber in daylight, cooling through twilight to dark ember at night
function skyPanelStyle(altDeg: number): React.CSSProperties {
  const pct = lightPctFromAlt(altDeg)
  if (pct >= 80) return { background: 'linear-gradient(180deg, #c97c18 0%, #7a3e08 100%)' }
  if (pct >= 50) return { background: 'linear-gradient(180deg, #8a4a10 0%, #4e2208 100%)' }
  if (pct >= 20) return { background: 'linear-gradient(180deg, #5a2a0e 0%, #2e1208 100%)' }
  if (pct >= 5)  return { background: 'linear-gradient(180deg, #3e1c10 0%, #200e0a 100%)' }
  return { background: 'linear-gradient(180deg, #2c1610 0%, #160c0a 100%)' }
}

// Returns a badge based on which smart-timing zone the given minute falls in
function timingZoneBadge(
  mins: number,
  timing: SmartTiming
): { label: string; cls: string } | null {
  const departMins  = dateToMinutes(timing.departBy)
  const bonStartMins = dateToMinutes(timing.bonfireStart)
  const bonEndMins   = dateToMinutes(timing.bonfireEnd)
  const fwMins       = dateToMinutes(timing.fireworksAfter)

  if (fwMins != null && mins >= fwMins)
    return { label: '🎆 light fireworks', cls: 'bg-purple-500/25 text-purple-100 border-purple-400/30' }
  if (bonStartMins != null && bonEndMins != null && mins >= bonStartMins && mins < bonEndMins)
    return { label: '🔥 light bonfire', cls: 'bg-orange-500/25 text-orange-100 border-orange-400/30' }
  if (departMins != null && bonStartMins != null && mins >= departMins && mins < bonStartMins)
    return { label: '⏳ setup window', cls: 'bg-yellow-500/20 text-yellow-100 border-yellow-400/25' }
  if (departMins != null && mins < departMins && mins >= departMins - 60)
    return { label: `🚶 leave by ${fmtDate(timing.departBy)}`, cls: 'bg-fire-500/20 text-fire-100 border-fire-400/25' }
  return null
}

// ─── Arc geometry ────────────────────────────────────────────────────────────────

interface ArcData {
  abovePath: string
  belowPath: string
  W: number
  H: number
  horizonY: number
  altToY: (alt: number) => number
}

function buildArc(date: Date, lat: number, lon: number): ArcData {
  const W = 360, H = 150, horizonY = 66
  const steps = 96

  // Day's max altitude (solar noon) drives the vertical scale so the hump always
  // fills the space nicely — even in winter when the noon sun is low.
  const noon = SunCalc.getTimes(date, lat, lon).solarNoon
  const noonAlt = noon instanceof Date && !isNaN(noon.getTime())
    ? getSunAltDeg(noon.getHours() * 60 + noon.getMinutes(), date, lat, lon)
    : 30
  const maxAlt = Math.max(noonAlt, 8)
  const BELOW_REF = 18 // map −18° (astronomical dark) to near the bottom
  const scaleAbove = (horizonY - 12) / maxAlt
  const scaleBelow = (H - horizonY - 12) / BELOW_REF

  const altToY = (alt: number): number => {
    const y = alt >= 0
      ? horizonY - alt * scaleAbove
      : horizonY + Math.min(BELOW_REF, -alt) * scaleBelow
    return Math.max(6, Math.min(H - 6, y))
  }

  let aboveD = '', belowD = ''
  for (let i = 0; i <= steps; i++) {
    const mins = (i / steps) * 1440
    const alt = getSunAltDeg(mins, date, lat, lon)
    const x = (i / steps) * W
    const y = altToY(alt)
    if (alt >= 0) aboveD += `${aboveD ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `
    else          belowD += `${belowD ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `
  }

  return { abovePath: aboveD.trim(), belowPath: belowD.trim(), W, H, horizonY, altToY }
}

// ─── Smart timing ─────────────────────────────────────────────────────────────

interface SmartTiming {
  departBy: Date | null
  bonfireStart: Date | null
  bonfireEnd: Date | null
  fireworksAfter: Date | null
}

function computeSmartTiming(
  eventDate: Date, lat: number, lon: number, walkMins: number, setupMins: number
): SmartTiming {
  const times = SunCalc.getTimes(eventDate, lat, lon)
  const valid = (d: unknown): d is Date => d instanceof Date && !isNaN((d as Date).getTime())

  const civilDusk    = valid(times.dusk)         ? times.dusk         : null
  const nauticalDusk = valid(times.nauticalDusk) ? times.nauticalDusk : null
  const astDusk      = valid(times.night)        ? times.night        : null  // sun 18° below

  // Setup must finish halfway into nautical twilight (between civil & nautical dusk)
  const setupDeadline = civilDusk && nauticalDusk
    ? new Date((civilDusk.getTime() + nauticalDusk.getTime()) / 2)
    : null
  const departBy = setupDeadline
    ? new Date(setupDeadline.getTime() - (walkMins + setupMins) * 60_000)
    : null

  return { departBy, bonfireStart: nauticalDusk, bonfireEnd: astDusk, fireworksAfter: astDusk }
}

function fmtDate(d: Date | null): string {
  if (!d) return '—'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function dateToMinutes(d: Date | null): number | null {
  return d ? d.getHours() * 60 + d.getMinutes() : null
}

// ─── Slider track gradient ────────────────────────────────────────────────────

function buildTrackStyle(
  sliderMin: number, sliderMax: number, date: Date, lat: number, lon: number
): React.CSSProperties {
  const range = Math.max(1, sliderMax - sliderMin)
  const PHASES: [number, string][] = [
    [100, '#2563a5'], [45, '#9a5a00'], [25, '#7a2410'], [10, '#3a1458'], [3, '#1a0a25'], [0, '#080410'],
  ]
  const stops: string[] = []
  for (let i = 0; i <= 40; i++) {
    const mins = sliderMin + (i / 40) * range
    const lp = lightPctFromAlt(getSunAltDeg(mins, date, lat, lon))
    const phase = PHASES.find(p => lp >= p[0]) ?? PHASES[PHASES.length - 1]
    stops.push(`${phase[1]} ${((i / 40) * 100).toFixed(1)}%`)
  }
  return { background: `linear-gradient(90deg, ${stops.join(', ')})` }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LightLevels() {
  const event = useEventStore(s => s.currentEvent) as Event | null
  const qc = useQueryClient()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragTime, setDragTime] = useState<number | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addTitle, setAddTitle] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const lat = event?.lat ?? DEFAULT_LAT
  const lon = event?.lon ?? DEFAULT_LON
  const eventDate = event ? parseLocalDate(event.date) : new Date()

  const sliderMin = event?.slider_time_start ? timeToMinutes(event.slider_time_start) : 0
  const sliderMax = event?.slider_time_end   ? timeToMinutes(event.slider_time_end)   : 1439
  const sliderRange = Math.max(1, sliderMax - sliderMin)
  const setupMins = event?.setup_duration_mins ?? 30

  const sunTimes = useMemo(() => SunCalc.getTimes(eventDate, lat, lon), [eventDate, lat, lon])
  const sunsetMinutes = useMemo(() => {
    const s = sunTimes.sunset
    return s instanceof Date && !isNaN(s.getTime()) ? s.getHours() * 60 + s.getMinutes() : null
  }, [sunTimes])
  const defaultMinutes = sunsetMinutes ?? 18 * 60

  const { data: items = [], isLoading } = useQuery<ScheduleItem[]>({
    queryKey: ['schedule', event?.id],
    queryFn: () => api.getSchedule(event!.id) as Promise<ScheduleItem[]>,
    enabled: !!event?.id,
  })

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['locations', event?.id],
    queryFn: () => api.getLocations(event!.id) as Promise<Location[]>,
    enabled: !!event?.id,
  })

  const walkMins = useMemo(() => {
    const chosen = locations.find(l => l.status === 'chosen')
    return chosen?.walk_time_from_meeting ?? 20
  }, [locations])

  const smartTiming = useMemo(
    () => computeSmartTiming(eventDate, lat, lon, walkMins, setupMins),
    [eventDate, lat, lon, walkMins, setupMins]
  )

  const sorted = useMemo(() =>
    [...items].sort((a, b) => {
      if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time)
      if (a.start_time) return -1
      if (b.start_time) return 1
      return a.sort_order - b.sort_order
    }), [items])

  const unseeded = PRESET_EVENTS.filter(
    p => !items.some(i => i.title.toLowerCase() === p.title.toLowerCase())
  )

  const selectedItem = items.find(i => i.id === selectedId) ?? null

  // When nothing is selected, show where the sun is right now (today), not the event date
  const displayDate = useMemo(() => selectedItem ? eventDate : new Date(), [selectedItem, eventDate])

  const arc = useMemo(() => buildArc(displayDate, lat, lon), [displayDate, lat, lon])
  const trackStyle = useMemo(
    () => buildTrackStyle(sliderMin, sliderMax, eventDate, lat, lon),
    [sliderMin, sliderMax, eventDate, lat, lon]
  )

  const displayMinutes: number = useMemo(() => {
    if (selectedItem) {
      return dragTime ?? (selectedItem.start_time ? timeToMinutes(selectedItem.start_time) : defaultMinutes)
    }
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  }, [selectedItem, dragTime, defaultMinutes])

  const displayAlt = getSunAltDeg(displayMinutes, displayDate, lat, lon)
  const displayLight = lightPctFromAlt(displayAlt)

  // The panel background ranges from bright amber (day) to dark ember (night),
  // so text + arc colours flip to stay readable against it.
  const panelIsLight = displayLight >= 45
  const panelText = {
    strong: panelIsLight ? 'text-stone-900' : 'text-white',
    body:   panelIsLight ? 'text-stone-800' : 'text-smoke-400',
    muted:  panelIsLight ? 'text-stone-700/80' : 'text-smoke-500',
    faint:  panelIsLight ? 'text-stone-600/70' : 'text-smoke-600',
  }
  const arcAboveStroke = panelIsLight ? 'rgba(80,30,0,0.45)' : 'rgba(255,150,60,0.35)'
  const arcBelowStroke = panelIsLight ? 'rgba(60,30,0,0.22)' : 'rgba(255,255,255,0.06)'
  const horizonStroke  = panelIsLight ? 'rgba(60,30,0,0.25)' : 'rgba(255,255,255,0.13)'

  const sunX = (displayMinutes / 1440) * arc.W
  const sunY = arc.altToY(displayAlt)

  const minsToSliderPct = (m: number) => Math.max(0, Math.min(100, ((m - sliderMin) / sliderRange) * 100))

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const updateTime = useMutation({
    mutationFn: ({ item, minutes }: { item: ScheduleItem; minutes: number }) =>
      api.updateScheduleItem(event!.id, item.id, { ...item, start_time: minutesToTime(minutes) }),
    onMutate: async ({ item, minutes }) => {
      await qc.cancelQueries({ queryKey: ['schedule', event?.id] })
      const prev = qc.getQueryData<ScheduleItem[]>(['schedule', event?.id])
      qc.setQueryData<ScheduleItem[]>(['schedule', event?.id], old =>
        (old ?? []).map(i => i.id === item.id ? { ...i, start_time: minutesToTime(minutes) } : i)
      )
      setDragTime(null) // cache holds the new value now — clearing drag won't snap back
      return { prev }
    },
    onError: (_, __, ctx) => {
      if (ctx?.prev) qc.setQueryData(['schedule', event?.id], ctx.prev)
      toast('Failed to save', 'error')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['schedule', event?.id] }),
  })

  const renameItem = useMutation({
    mutationFn: ({ item, title }: { item: ScheduleItem; title: string }) =>
      api.updateScheduleItem(event!.id, item.id, { ...item, title }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedule', event?.id] }); setEditOpen(false); toast('Renamed') },
  })

  const deleteItem = useMutation({
    mutationFn: (id: string) => api.deleteScheduleItem(event!.id, id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['schedule', event?.id] })
      const prev = qc.getQueryData<ScheduleItem[]>(['schedule', event?.id])
      qc.setQueryData<ScheduleItem[]>(['schedule', event?.id], old => (old ?? []).filter(i => i.id !== id))
      if (selectedId === id) setSelectedId(null)
      return { prev }
    },
    onError: (_, __, ctx) => { if (ctx?.prev) qc.setQueryData(['schedule', event?.id], ctx.prev) },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['schedule', event?.id] }); toast('Removed') },
  })

  const createItem = useMutation({
    mutationFn: ({ title, activityType }: { title: string; activityType?: string }) =>
      api.createScheduleItem(event!.id, {
        id: generateId(), event_id: event!.id, title,
        activity_type: activityType ?? '', sort_order: items.length,
        start_time: minutesToTime(defaultMinutes),
      }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['schedule', event?.id] })
      setAddOpen(false); setAddTitle('')
      const c = created as ScheduleItem
      if (c?.id) setSelectedId(c.id)
      toast('Event added')
    },
  })

  // ─── Slider handlers (flicker-free) ─────────────────────────────────────────

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDragTime(Number(e.target.value))
  }, [])
  const handleSliderCommit = useCallback(() => {
    if (!selectedItem || dragTime === null) return
    updateTime.mutate({ item: selectedItem, minutes: dragTime })
  }, [selectedItem, dragTime, updateTime])

  // ─── Marker positions (slider track only — never on the arc) ─────────────────

  const bonStart = dateToMinutes(smartTiming.bonfireStart)
  const bonEnd   = dateToMinutes(smartTiming.bonfireEnd)
  const fwAfter  = dateToMinutes(smartTiming.fireworksAfter)

  const sunsetPct       = sunsetMinutes != null ? minsToSliderPct(sunsetMinutes) : null
  const bonfireStartPct = bonStart != null ? minsToSliderPct(bonStart) : null
  const bonfireEndPct   = bonEnd   != null ? minsToSliderPct(bonEnd)   : null
  const fireworksPct    = fwAfter  != null ? minsToSliderPct(fwAfter)  : null

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Light Levels"
        subtitle="Time events to the sun"
        action={<Button size="icon" onClick={() => { setAddTitle(''); setAddOpen(true) }}><Plus size={18} /></Button>}
      />

      <PageContent>
        {/* Centred column so nothing stretches on desktop */}
        <div className="mx-auto w-full max-w-lg space-y-3">

          {/* ── Sky panel ─────────────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden border border-white/5" style={skyPanelStyle(displayAlt)}>
            {/* Selected event chip */}
            <div className="px-3 pt-3 flex items-center gap-2 min-h-[30px]">
              {selectedItem ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-fire-400 shadow-[0_0_6px_rgba(232,95,0,0.8)]" />
                  <span className={cn('text-xs font-semibold truncate', panelText.strong)}>{selectedItem.title}</span>
                  <button onClick={() => setSelectedId(null)} className={cn('ml-auto tap-highlight-none text-sm leading-none', panelText.muted)}>✕</button>
                </>
              ) : (
                <span className={cn('text-xs italic', panelText.muted)}>Showing now — tap an event below to set its time</span>
              )}
            </div>

            {/* Arc */}
            <svg viewBox={`0 0 ${arc.W} ${arc.H}`} className="w-full block" style={{ aspectRatio: `${arc.W} / ${arc.H}` }}>
              <defs>
                <radialGradient id="emberGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"  stopColor={sunEmberColor(displayAlt)} stopOpacity="0.55" />
                  <stop offset="55%" stopColor={sunEmberColor(displayAlt)} stopOpacity="0.12" />
                  <stop offset="100%" stopColor={sunEmberColor(displayAlt)} stopOpacity="0" />
                </radialGradient>
                <radialGradient id="emberCore" cx="50%" cy="45%" r="55%">
                  <stop offset="0%"  stopColor={displayAlt > 4 ? '#fff4cf' : sunEmberColor(displayAlt)} />
                  <stop offset="55%" stopColor={sunEmberColor(displayAlt)} />
                  <stop offset="100%" stopColor={displayAlt > 0 ? sunEmberColor(displayAlt) : '#1c0600'} />
                </radialGradient>
              </defs>

              {/* Horizon */}
              <line x1={0} y1={arc.horizonY} x2={arc.W} y2={arc.horizonY} stroke={horizonStroke} strokeWidth={0.6} />

              {/* Sun path (clean — no overlays here) */}
              {arc.abovePath && <path d={arc.abovePath} fill="none" stroke={arcAboveStroke} strokeWidth={1.4} strokeDasharray="5 5" strokeLinecap="round" />}
              {arc.belowPath && <path d={arc.belowPath} fill="none" stroke={arcBelowStroke} strokeWidth={1} strokeDasharray="3 7" strokeLinecap="round" />}

              {/* Sunset tick on the horizon */}
              {sunsetMinutes != null && (
                <line
                  x1={(sunsetMinutes / 1440) * arc.W} y1={arc.horizonY - 6}
                  x2={(sunsetMinutes / 1440) * arc.W} y2={arc.horizonY + 6}
                  stroke="rgba(255,170,60,0.6)" strokeWidth={1.2}
                />
              )}

              {/* Ember (glow follows the sun, so no muddy fixed smear) */}
              <circle cx={sunX} cy={sunY} r={sunRadius(displayAlt) * 3} fill="url(#emberGlow)" />
              <circle cx={sunX} cy={sunY} r={sunRadius(displayAlt)} fill="url(#emberCore)" />
            </svg>

            {/* Time readout — the big time IS the editable field */}
            <div className="text-center px-4 pt-1 pb-2">
              {selectedItem ? (
                <input
                  type="time"
                  step={300}
                  value={minutesToTime(displayMinutes)}
                  onChange={e => {
                    if (!e.target.value) return
                    setDragTime(Math.max(sliderMin, Math.min(sliderMax, timeToMinutes(e.target.value))))
                  }}
                  onBlur={handleSliderCommit}
                  className={cn(
                    'bg-transparent text-center text-4xl font-bold tabular-nums tracking-wide',
                    'focus:outline-none mx-auto block w-auto',
                    panelIsLight ? '[color-scheme:light]' : '[color-scheme:dark]',
                    panelText.strong,
                    '[&::-webkit-calendar-picker-indicator]:hidden',
                    '[&::-webkit-calendar-picker-indicator]:appearance-none'
                  )}
                />
              ) : (
                <div className={cn('text-4xl font-bold tabular-nums tracking-wide', panelText.strong)}>{minutesToTime(displayMinutes)}</div>
              )}
              <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
                <span className="text-sm">{phaseEmoji(displayAlt)}</span>
                <span className={cn('text-xs', panelText.body)}>{displayLight}% light</span>
                <span className={cn('text-xs', panelText.faint)}>·</span>
                <span className={cn('text-xs', panelText.muted)}>{Math.abs(displayAlt).toFixed(1)}° {displayAlt >= 0 ? 'above' : 'below'}</span>
                {(() => {
                  const b = timingZoneBadge(displayMinutes, smartTiming)
                  return b && (
                    <span className={cn('text-[10px] border px-2 py-0.5 rounded-full', b.cls)}>{b.label}</span>
                  )
                })()}
              </div>
            </div>

            {/* Slider (only when an event is selected) */}
            {selectedItem && (
              <div className="px-4 pb-4 pt-1">
                <div className="relative" style={{ height: '24px' }}>
                  {/* Phase-coloured track */}
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full" style={trackStyle} />

                  {/* Bonfire window */}
                  {bonfireStartPct != null && bonfireEndPct != null && bonfireEndPct > bonfireStartPct && (
                    <div className="absolute top-1/2 -translate-y-1/2 h-2"
                      style={{ left: `${bonfireStartPct}%`, width: `${bonfireEndPct - bonfireStartPct}%`, background: 'rgba(232,120,20,0.7)' }} />
                  )}
                  {/* Fireworks window */}
                  {fireworksPct != null && (
                    <div className="absolute top-1/2 -translate-y-1/2 h-2 rounded-r-full"
                      style={{ left: `${fireworksPct}%`, right: 0, background: 'rgba(150,70,200,0.6)' }} />
                  )}
                  {/* Sunset tick */}
                  {sunsetPct != null && (
                    <div className="absolute top-0 bottom-0 w-0.5 rounded-full" style={{ left: `${sunsetPct}%`, background: 'rgba(255,180,70,0.85)' }} />
                  )}

                  <input
                    type="range" min={sliderMin} max={sliderMax} step={5}
                    value={displayMinutes}
                    onChange={handleSliderChange}
                    onMouseUp={handleSliderCommit}
                    onTouchEnd={handleSliderCommit}
                    onBlur={handleSliderCommit}
                    className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full appearance-none bg-transparent cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                      [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_rgba(232,95,0,0.6),0_2px_6px_rgba(0,0,0,0.6)]
                      [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing
                      [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab"
                    style={{ height: '24px' }}
                  />
                </div>

                {/* Slider scale labels */}
                <div className="relative h-3 mt-1">
                  <span className={cn('absolute left-0 text-[9px] uppercase tracking-wider', panelText.faint)}>{minutesToTime(sliderMin)}</span>
                  {sunsetPct != null && sunsetPct > 12 && sunsetPct < 88 && (
                    <span className={cn('absolute -translate-x-1/2 text-[9px] uppercase tracking-wider', panelIsLight ? 'text-amber-900/80' : 'text-amber-500/80')}
                      style={{ left: `${sunsetPct}%` }}>sunset</span>
                  )}
                  <span className={cn('absolute right-0 text-[9px] uppercase tracking-wider', panelText.faint)}>{minutesToTime(sliderMax)}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Smart timing summary ───────────────────────────────────────── */}
          {(smartTiming.departBy || smartTiming.bonfireStart || smartTiming.fireworksAfter) && (
            <div className="grid grid-cols-3 gap-2">
              <div className="glass-card p-3">
                <p className="text-[9px] text-fire-400 uppercase tracking-wider font-semibold mb-1">🚶 Depart by</p>
                <p className="text-base font-bold text-smoke-100 tabular-nums">{fmtDate(smartTiming.departBy)}</p>
                <p className="text-[10px] text-smoke-500 mt-0.5">{walkMins}m walk · {setupMins}m setup</p>
              </div>
              <div className="glass-card p-3">
                <p className="text-[9px] text-orange-400 uppercase tracking-wider font-semibold mb-1">🔥 Bonfire</p>
                <p className="text-base font-bold text-smoke-100 tabular-nums">{fmtDate(smartTiming.bonfireStart)}</p>
                <p className="text-[10px] text-smoke-500 mt-0.5">to {fmtDate(smartTiming.bonfireEnd)}</p>
              </div>
              <div className="glass-card p-3">
                <p className="text-[9px] text-purple-400 uppercase tracking-wider font-semibold mb-1">🎆 Fireworks</p>
                <p className="text-base font-bold text-smoke-100 tabular-nums">{fmtDate(smartTiming.fireworksAfter)}</p>
                <p className="text-[10px] text-smoke-500 mt-0.5">full dark</p>
              </div>
            </div>
          )}

          {/* ── Suggested presets ──────────────────────────────────────────── */}
          {unseeded.length > 0 && (
            <div>
              <p className="text-[10px] text-smoke-500 uppercase tracking-wider font-semibold mb-2 px-1">Suggested events</p>
              <div className="space-y-1.5">
                {unseeded.map(p => (
                  <button key={p.title} onClick={() => createItem.mutate({ title: p.title, activityType: p.activity_type })}
                    disabled={createItem.isPending}
                    className="w-full text-left glass border border-white/8 rounded-xl px-3 py-2.5 flex items-center justify-between
                      group hover:border-fire-400/25 active:scale-[0.99] transition-all tap-highlight-none">
                    <span className="text-sm text-smoke-500 group-hover:text-smoke-300 transition-colors">{p.title}</span>
                    <span className="text-[11px] text-fire-400/60 group-hover:text-fire-400 transition-colors">+ Add</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Events grid ────────────────────────────────────────────────── */}
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-28 rounded-2xl shimmer" />)}</div>
          ) : sorted.length > 0 && (
            <div>
              <p className="text-[10px] text-smoke-500 uppercase tracking-wider font-semibold mb-2 px-1">Events</p>
              <div className="grid grid-cols-2 gap-3">
                {sorted.map(item => {
                  const isSelected = item.id === selectedId
                  const mins = item.start_time ? timeToMinutes(item.start_time) : null
                  const alt  = mins != null ? getSunAltDeg(mins, eventDate, lat, lon) : null
                  const lp   = alt != null ? lightPctFromAlt(alt) : null
                  const badge = mins != null ? timingZoneBadge(mins, smartTiming) : null

                  return (
                    <div key={item.id}
                      onClick={() => setSelectedId(isSelected ? null : item.id)}
                      className={cn(
                        'glass-card p-3 cursor-pointer active:scale-[0.98] transition-all tap-highlight-none',
                        isSelected && 'border-fire-400/40 bg-fire-500/10 shadow-[0_0_14px_rgba(232,95,0,0.12)]'
                      )}>
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xl leading-none">{alt != null ? phaseEmoji(alt) : '⏱'}</span>
                        <div className="flex gap-0.5">
                          <button onClick={e => { e.stopPropagation(); setEditingItem(item); setEditTitle(item.title); setEditOpen(true) }}
                            className="p-1 text-smoke-600 hover:text-smoke-300 tap-highlight-none transition-colors"><Pencil size={11} /></button>
                          <button onClick={e => { e.stopPropagation(); if (confirm(`Remove "${item.title}"?`)) deleteItem.mutate(item.id) }}
                            className="p-1 text-smoke-600 hover:text-red-400 tap-highlight-none transition-colors"><Trash2 size={11} /></button>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-smoke-200 leading-tight line-clamp-2 mb-2">{item.title}</p>
                      <div>
                        {item.start_time
                          ? <p className="text-sm font-bold text-smoke-100 tabular-nums">{item.start_time}</p>
                          : <p className="text-xs text-smoke-600 italic">tap to set time</p>}
                        {lp != null && <p className="text-[10px] text-smoke-500">{lp}% light</p>}
                        {badge && (
                          <span className={cn('text-[9px] border px-1.5 py-0.5 rounded-full mt-1 inline-block', badge.cls)}>{badge.label}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!isLoading && sorted.length === 0 && unseeded.length === 0 && (
            <div className="text-center py-10 text-smoke-600 text-sm">No events yet — add one above</div>
          )}
        </div>
      </PageContent>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Event</DialogTitle></DialogHeader>
          <Input value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="Event name"
            onKeyDown={e => e.key === 'Enter' && addTitle.trim() && createItem.mutate({ title: addTitle })} autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => createItem.mutate({ title: addTitle })} disabled={!addTitle.trim() || createItem.isPending}>
              {createItem.isPending ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename Event</DialogTitle></DialogHeader>
          <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Event name"
            onKeyDown={e => e.key === 'Enter' && editTitle.trim() && editingItem && renameItem.mutate({ item: editingItem, title: editTitle })} autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => editingItem && renameItem.mutate({ item: editingItem, title: editTitle })}
              disabled={!editTitle.trim() || renameItem.isPending}>
              {renameItem.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
