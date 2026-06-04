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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(mins: number): string {
  const h = Math.floor(Math.max(0, Math.min(1439, mins)) / 60)
  const m = Math.max(0, Math.min(1439, mins)) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function getSunAltDeg(minutes: number, date: Date, lat: number, lon: number): number {
  const d = new Date(date)
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return (SunCalc.getPosition(d, lat, lon).altitude * 180) / Math.PI
}

function lightPctFromAlt(altDeg: number): number {
  return Math.round(Math.max(0, Math.min(100, ((altDeg + 18) / 24) * 100)))
}

function sunEmberColor(altDeg: number): string {
  // Fire/smoke theme: sun is a fireball cooling to embers
  if (altDeg > 30)  return '#ffe060'  // white-hot yellow
  if (altDeg > 15)  return '#ffb030'  // bright amber
  if (altDeg > 3)   return '#ff7010'  // hot orange
  if (altDeg > 0)   return '#ff4800'  // sunset orange-red
  if (altDeg > -6)  return '#cc2800'  // ember red just below horizon
  if (altDeg > -15) return '#882000'  // deep ember
  return '#441000'                    // nearly dead coal
}

function sunRadius(altDeg: number): number {
  if (altDeg > 10) return 13
  if (altDeg > 0)  return 11
  if (altDeg > -8) return 9
  return 7
}

function phaseLabel(altDeg: number): string {
  const pct = lightPctFromAlt(altDeg)
  if (pct >= 60) return '☀️'
  if (pct >= 30) return '🌤'
  if (pct >= 15) return '🌅'
  if (pct > 0)   return '🌙'
  return '🌑'
}

// Smoke-dark background with ember glow based on sun position
function skyPanelStyle(altDeg: number): React.CSSProperties {
  const pct = lightPctFromAlt(altDeg)
  if (pct >= 60) return { background: 'radial-gradient(ellipse at 65% 35%, rgba(140,80,0,0.35) 0%, #0d0d0d 65%)' }
  if (pct >= 35) return { background: 'radial-gradient(ellipse at 68% 40%, rgba(180,70,0,0.45) 0%, #0a0a0a 60%)' }
  if (pct >= 15) return { background: 'radial-gradient(ellipse at 70% 55%, rgba(140,30,0,0.35) 0%, #080808 65%)' }
  if (pct >= 5)  return { background: 'radial-gradient(ellipse at 72% 65%, rgba(90,15,0,0.3) 0%, #060606 60%)' }
  return { background: 'radial-gradient(ellipse at 73% 72%, rgba(50,8,0,0.2) 0%, #040404 55%)' }
}

// ─── Arc ──────────────────────────────────────────────────────────────────────

interface ArcData { path: string; belowPath: string; W: number; H: number; horizonY: number }

function buildArc(date: Date, lat: number, lon: number): ArcData {
  const W = 360; const H = 160; const horizonY = 100
  const MAX_ALT = 35; const steps = 96

  const pts = Array.from({ length: steps + 1 }, (_, i) => {
    const mins = (i / steps) * 1440
    const alt = getSunAltDeg(mins, date, lat, lon)
    const x = (i / steps) * W
    const y = horizonY - Math.max(-30, Math.min(MAX_ALT, alt)) * ((horizonY - 10) / MAX_ALT)
    return { x, y, above: alt >= 0 }
  })

  // Build two paths: above-horizon (brighter) and below-horizon (dimmer)
  let aboveD = '', belowD = ''
  pts.forEach((p, i) => {
    const cmd = i === 0 ? 'M' : 'L'
    if (p.above) aboveD += `${cmd}${p.x.toFixed(1)},${p.y.toFixed(1)} `
    else belowD += `${cmd}${p.x.toFixed(1)},${p.y.toFixed(1)} `
  })

  return { path: aboveD.trim(), belowPath: belowD.trim(), W, H, horizonY }
}

// ─── Smart timing ─────────────────────────────────────────────────────────────

interface SmartTiming {
  departBy: Date | null
  bonfireStart: Date | null
  bonfireEnd: Date | null
  fireworksAfter: Date | null
}

function computeSmartTiming(
  eventDate: Date, lat: number, lon: number,
  walkMins: number, setupMins: number
): SmartTiming {
  const times = SunCalc.getTimes(eventDate, lat, lon)
  const valid = (d: unknown): d is Date => d instanceof Date && !isNaN((d as Date).getTime())

  // Setup deadline = halfway between civil dusk and nautical dusk
  const civilDusk    = valid(times.dusk)        ? times.dusk        : null
  const nauticalDusk = valid(times.nauticalDusk) ? times.nauticalDusk : null
  const astDusk      = valid(times.night)        ? times.night       : null  // 18° below

  const setupDeadline = civilDusk && nauticalDusk
    ? new Date((civilDusk.getTime() + nauticalDusk.getTime()) / 2)
    : null

  const departBy = setupDeadline
    ? new Date(setupDeadline.getTime() - (walkMins + setupMins) * 60_000)
    : null

  return {
    departBy,
    bonfireStart: nauticalDusk,
    bonfireEnd:   astDusk,
    fireworksAfter: astDusk,
  }
}

function fmtDate(d: Date | null): string {
  if (!d) return '—'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ─── Slider track gradient ────────────────────────────────────────────────────

function buildTrackStyle(
  sliderMin: number, sliderMax: number,
  date: Date, lat: number, lon: number
): React.CSSProperties {
  const range = sliderMax - sliderMin
  const stops: string[] = []

  const PHASES = [
    { pct: 100, color: '#1a3a6a' }, // day (blue-smoke)
    { pct: 45,  color: '#7a4800' }, // golden hour
    { pct: 25,  color: '#6a2010' }, // civil twilight
    { pct: 10,  color: '#3a1050' }, // nautical twilight
    { pct: 3,   color: '#1a0825' }, // astronomical
    { pct: 0,   color: '#080410' }, // night
  ]

  // Sample 40 points across the slider range and pick the phase colour
  for (let i = 0; i <= 40; i++) {
    const mins = sliderMin + (i / 40) * range
    const alt = getSunAltDeg(mins, date, lat, lon)
    const lp = lightPctFromAlt(alt)
    // Find phase colour
    const phase = PHASES.find(p => lp >= p.pct) ?? PHASES[PHASES.length - 1]
    stops.push(`${phase.color} ${((i / 40) * 100).toFixed(1)}%`)
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
  const setupMins = event?.setup_duration_mins ?? 30

  // SunCalc times
  const sunTimes = useMemo(() => SunCalc.getTimes(eventDate, lat, lon), [eventDate, lat, lon])
  const sunsetMinutes = useMemo(() => {
    const s = sunTimes.sunset
    return s instanceof Date && !isNaN(s.getTime()) ? s.getHours() * 60 + s.getMinutes() : null
  }, [sunTimes])
  const defaultMinutes = sunsetMinutes ?? 18 * 60

  // Arc (memoised — same for all items)
  const arc = useMemo(() => buildArc(eventDate, lat, lon), [eventDate, lat, lon])

  // Slider track gradient (memoised)
  const trackStyle = useMemo(
    () => buildTrackStyle(sliderMin, sliderMax, eventDate, lat, lon),
    [sliderMin, sliderMax, eventDate, lat, lon]
  )

  // Queries
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

  // Display time for the sky panel (drag overrides item time)
  const displayMinutes: number = useMemo(() => {
    if (selectedItem) {
      return dragTime ?? (selectedItem.start_time ? timeToMinutes(selectedItem.start_time) : defaultMinutes)
    }
    // No selection: show current real time
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  }, [selectedItem, dragTime, defaultMinutes])

  const displayAlt = getSunAltDeg(displayMinutes, eventDate, lat, lon)
  const displayLight = lightPctFromAlt(displayAlt)
  const isIdealFireworks = displayAlt < 0  // sun below horizon

  // Sun position on arc SVG
  const sunX = (displayMinutes / 1440) * arc.W
  const sunY = arc.horizonY - Math.max(-30, Math.min(35, displayAlt)) * ((arc.horizonY - 10) / 35)

  // Slider thumb position as % of range (for sunset/dark markers)
  const sliderRange = Math.max(1, sliderMax - sliderMin)
  function minsToSliderPct(m: number) {
    return Math.max(0, Math.min(100, ((m - sliderMin) / sliderRange) * 100))
  }

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
      setDragTime(null)  // cache now has the new value — safe to clear drag
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
      // Auto-select the new item
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
    // dragTime cleared inside onMutate after cache is updated
  }, [selectedItem, dragTime, updateTime])

  // ─── Smart timing to slider % (for marker positions) ────────────────────────

  const sunsetPct   = sunsetMinutes != null ? minsToSliderPct(sunsetMinutes) : null
  const bonfireStartPct = smartTiming.bonfireStart
    ? minsToSliderPct(smartTiming.bonfireStart.getHours() * 60 + smartTiming.bonfireStart.getMinutes()) : null
  const bonfireEndPct = smartTiming.bonfireEnd
    ? minsToSliderPct(smartTiming.bonfireEnd.getHours() * 60 + smartTiming.bonfireEnd.getMinutes()) : null
  const fireworksPct = smartTiming.fireworksAfter
    ? minsToSliderPct(smartTiming.fireworksAfter.getHours() * 60 + smartTiming.fireworksAfter.getMinutes()) : null

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Light Levels"
        subtitle="Time events to the sun"
        action={<Button size="icon" onClick={() => { setAddTitle(''); setAddOpen(true) }}><Plus size={18} /></Button>}
      />

      <PageContent>
        {/* ── Sky Panel ─────────────────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden" style={skyPanelStyle(displayAlt)}>
          {/* Selected event chip */}
          <div className="px-3 pt-3 pb-1 flex items-center gap-2 min-h-[32px]">
            {selectedItem ? (
              <>
                <div className="w-2 h-2 rounded-full bg-fire-400 shadow-[0_0_6px_rgba(232,95,0,0.8)]" />
                <span className="text-xs font-semibold text-smoke-200">{selectedItem.title}</span>
                <button onClick={() => setSelectedId(null)} className="text-[10px] text-smoke-500 hover:text-smoke-300 ml-auto tap-highlight-none">✕</button>
              </>
            ) : (
              <span className="text-xs text-smoke-600 italic">Tap an event to set its time</span>
            )}
          </div>

          {/* Sun arc SVG */}
          <div className="px-1">
            <svg viewBox={`0 0 ${arc.W} ${arc.H}`} className="w-full" height={arc.H} preserveAspectRatio="none">
              <defs>
                <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={sunEmberColor(displayAlt)} stopOpacity="0.5" />
                  <stop offset="100%" stopColor={sunEmberColor(displayAlt)} stopOpacity="0" />
                </radialGradient>
                <radialGradient id="sunCore" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={displayAlt > 5 ? '#fff8d0' : sunEmberColor(displayAlt)} />
                  <stop offset="60%" stopColor={sunEmberColor(displayAlt)} />
                  <stop offset="100%" stopColor={displayAlt > 0 ? sunEmberColor(displayAlt) : '#220800'} />
                </radialGradient>
              </defs>

              {/* Horizon */}
              <line x1={0} y1={arc.horizonY} x2={arc.W} y2={arc.horizonY}
                stroke="rgba(255,255,255,0.15)" strokeWidth={0.7} />

              {/* Arc above horizon */}
              {arc.path && (
                <path d={arc.path} fill="none" stroke="rgba(232,95,0,0.3)"
                  strokeWidth={1.2} strokeDasharray="4 4" />
              )}
              {/* Arc below horizon */}
              {arc.belowPath && (
                <path d={arc.belowPath} fill="none" stroke="rgba(255,255,255,0.07)"
                  strokeWidth={1} strokeDasharray="3 6" />
              )}

              {/* Smart window highlights on arc */}
              {/* Bonfire window */}
              {bonfireStartPct != null && bonfireEndPct != null && (() => {
                const x1 = (bonfireStartPct / 100) * arc.W
                const x2 = (bonfireEndPct / 100) * arc.W
                const y1 = arc.horizonY - Math.max(-30, Math.min(35, getSunAltDeg(sliderMin + (bonfireStartPct / 100) * sliderRange, eventDate, lat, lon))) * ((arc.horizonY - 10) / 35)
                const y2 = arc.horizonY - Math.max(-30, Math.min(35, getSunAltDeg(sliderMin + (bonfireEndPct / 100) * sliderRange, eventDate, lat, lon))) * ((arc.horizonY - 10) / 35)
                return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(200,100,0,0.55)" strokeWidth={3.5} strokeLinecap="round" />
              })()}
              {/* Fireworks window */}
              {fireworksPct != null && (() => {
                const x1 = (fireworksPct / 100) * arc.W
                const x2 = arc.W
                return <line x1={x1} y1={arc.horizonY + 8} x2={x2} y2={arc.horizonY + 8}
                  stroke="rgba(130,60,180,0.5)" strokeWidth={3} strokeLinecap="round" />
              })()}

              {/* Sunset marker line */}
              {sunsetPct != null && (
                <line x1={(sunsetPct / 100) * arc.W} y1={arc.horizonY - 8}
                  x2={(sunsetPct / 100) * arc.W} y2={arc.horizonY + 8}
                  stroke="rgba(255,170,50,0.7)" strokeWidth={1.5} />
              )}

              {/* Sun glow */}
              <circle cx={sunX} cy={Math.max(10, Math.min(arc.H - 5, sunY))}
                r={sunRadius(displayAlt) * 2.5} fill="url(#sunGlow)" />
              {/* Sun body */}
              <circle cx={sunX} cy={Math.max(10, Math.min(arc.H - 5, sunY))}
                r={sunRadius(displayAlt)} fill="url(#sunCore)" />
            </svg>
          </div>

          {/* Time + light display */}
          <div className="text-center py-2">
            <div className="text-3xl font-bold text-smoke-100 tabular-nums tracking-wide">
              {minutesToTime(displayMinutes)}
            </div>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-sm">{phaseLabel(displayAlt)}</span>
              <span className="text-xs text-smoke-400">{displayLight}% light</span>
              {isIdealFireworks && (
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/25 px-2 py-0.5 rounded-full">
                  🎆 ideal for fireworks
                </span>
              )}
            </div>
          </div>

          {/* Slider */}
          {selectedItem && (
            <div className="px-4 pb-4">
              {/* Track with phase colors + smart windows */}
              <div className="relative mb-1" style={{ height: '28px' }}>
                {/* Colored track */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full"
                  style={trackStyle} />

                {/* Bonfire window overlay */}
                {bonfireStartPct != null && bonfireEndPct != null && (
                  <div className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full"
                    style={{
                      left: `${bonfireStartPct}%`,
                      width: `${bonfireEndPct - bonfireStartPct}%`,
                      background: 'rgba(200,100,0,0.55)',
                    }} />
                )}
                {/* Fireworks window overlay */}
                {fireworksPct != null && (
                  <div className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-r-full"
                    style={{
                      left: `${fireworksPct}%`,
                      right: 0,
                      background: 'rgba(130,60,180,0.5)',
                    }} />
                )}

                {/* Sunset marker tick */}
                {sunsetPct != null && (
                  <div className="absolute top-0 bottom-0 w-px"
                    style={{ left: `${sunsetPct}%`, background: 'rgba(255,170,50,0.7)' }} />
                )}

                {/* Range input (transparent track, styled thumb) */}
                <input
                  type="range"
                  min={sliderMin}
                  max={sliderMax}
                  step={5}
                  value={displayMinutes}
                  onChange={handleSliderChange}
                  onMouseUp={handleSliderCommit}
                  onTouchEnd={handleSliderCommit}
                  className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full appearance-none bg-transparent cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                    [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_rgba(232,95,0,0.5),0_2px_6px_rgba(0,0,0,0.5)]
                    [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing
                    [&::-webkit-slider-track]:h-0 [&::-webkit-slider-track]:bg-transparent
                    [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
                    [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white
                    [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab
                    [&::-moz-range-track]:h-0 [&::-moz-range-track]:bg-transparent"
                  style={{ height: '28px', padding: 0, margin: 0 }}
                />
              </div>

              {/* Phase labels */}
              <div className="flex justify-between mb-2">
                <span className="text-[9px] text-smoke-600 uppercase tracking-wider">{minutesToTime(sliderMin)}</span>
                {sunsetPct != null && (
                  <span className="text-[9px] text-amber-600/70 uppercase tracking-wider absolute"
                    style={{ left: `calc(${sunsetPct}% + 16px + 4px)`, position: 'relative' }}>
                    sunset
                  </span>
                )}
                <span className="text-[9px] text-smoke-600 uppercase tracking-wider">{minutesToTime(sliderMax)}</span>
              </div>

              {/* Time input */}
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={minutesToTime(displayMinutes)}
                  onChange={e => {
                    const m = timeToMinutes(e.target.value)
                    const clamped = Math.max(sliderMin, Math.min(sliderMax, m))
                    setDragTime(clamped)
                  }}
                  onBlur={() => {
                    if (selectedItem && dragTime !== null) {
                      updateTime.mutate({ item: selectedItem, minutes: dragTime })
                    }
                  }}
                  className="bg-white/7 border border-white/10 rounded-xl px-3 py-1.5 text-sm font-semibold
                    text-smoke-100 tabular-nums focus:outline-none focus:border-fire-400/50
                    [color-scheme:dark] w-28"
                />
                <span className="text-xs text-smoke-500">
                  {Math.abs(displayAlt).toFixed(1)}° {displayAlt >= 0 ? 'above' : 'below'} horizon
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Smart timing summary ──────────────────────────────────────────── */}
        {(smartTiming.departBy || smartTiming.bonfireStart || smartTiming.fireworksAfter) && (
          <div className="grid grid-cols-3 gap-2">
            <div className="glass-card p-3">
              <p className="text-[9px] text-fire-400 uppercase tracking-wider font-semibold mb-1">🚶 Depart by</p>
              <p className="text-base font-bold text-smoke-100 tabular-nums">{fmtDate(smartTiming.departBy)}</p>
              <p className="text-[10px] text-smoke-500 mt-0.5">{walkMins} min walk</p>
            </div>
            <div className="glass-card p-3">
              <p className="text-[9px] text-orange-400 uppercase tracking-wider font-semibold mb-1">🔥 Bonfire</p>
              <p className="text-base font-bold text-smoke-100 tabular-nums">{fmtDate(smartTiming.bonfireStart)}</p>
              <p className="text-[10px] text-smoke-500 mt-0.5">to {fmtDate(smartTiming.bonfireEnd)}</p>
            </div>
            <div className="glass-card p-3">
              <p className="text-[9px] text-purple-400 uppercase tracking-wider font-semibold mb-1">🎆 Fireworks</p>
              <p className="text-base font-bold text-smoke-100 tabular-nums">after {fmtDate(smartTiming.fireworksAfter)}</p>
              <p className="text-[10px] text-smoke-500 mt-0.5">sun 18° below</p>
            </div>
          </div>
        )}

        {/* ── Suggested presets ─────────────────────────────────────────────── */}
        {unseeded.length > 0 && (
          <div>
            <p className="text-[10px] text-smoke-500 uppercase tracking-wider font-semibold mb-2 px-1">Suggested events</p>
            <div className="space-y-1.5">
              {unseeded.map(p => (
                <button key={p.title} onClick={() => createItem.mutate({ title: p.title, activityType: p.activity_type })}
                  disabled={createItem.isPending}
                  className="w-full text-left glass border border-white/8 rounded-xl px-3 py-2.5
                    flex items-center justify-between group hover:border-fire-400/25
                    active:scale-[0.99] transition-all tap-highlight-none">
                  <span className="text-sm text-smoke-500 group-hover:text-smoke-300 transition-colors">{p.title}</span>
                  <span className="text-[11px] text-fire-400/60 group-hover:text-fire-400 transition-colors">+ Add</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Events grid ───────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-2xl shimmer" />)}
          </div>
        ) : sorted.length > 0 && (
          <div>
            <p className="text-[10px] text-smoke-500 uppercase tracking-wider font-semibold mb-2 px-1">Events</p>
            <div className="grid grid-cols-2 gap-3">
              {sorted.map(item => {
                const isSelected = item.id === selectedId
                const mins = item.start_time ? timeToMinutes(item.start_time) : null
                const alt  = mins != null ? getSunAltDeg(mins, eventDate, lat, lon) : null
                const lp   = alt != null ? lightPctFromAlt(alt) : null
                const ideal = alt != null && alt < 0

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(isSelected ? null : item.id)}
                    className={cn(
                      'glass-card p-3 cursor-pointer active:scale-[0.98] transition-all tap-highlight-none',
                      isSelected && 'border-fire-400/35 bg-fire-500/6 shadow-[0_0_12px_rgba(232,95,0,0.1)]'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xl leading-none">
                        {alt != null ? phaseLabel(alt) : '⏱'}
                      </span>
                      <div className="flex gap-0.5">
                        <button
                          onClick={e => { e.stopPropagation(); setEditingItem(item); setEditTitle(item.title); setEditOpen(true) }}
                          className="p-1 text-smoke-600 hover:text-smoke-300 tap-highlight-none transition-colors"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); if (confirm(`Remove "${item.title}"?`)) deleteItem.mutate(item.id) }}
                          className="p-1 text-smoke-600 hover:text-red-400 tap-highlight-none transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-smoke-200 leading-tight line-clamp-2 mb-2">
                      {item.title}
                    </p>

                    <div className="mt-auto">
                      {item.start_time ? (
                        <p className="text-sm font-bold text-smoke-100 tabular-nums">{item.start_time}</p>
                      ) : (
                        <p className="text-xs text-smoke-600 italic">tap to set time</p>
                      )}
                      {lp != null && (
                        <p className="text-[10px] text-smoke-500">{lp}% light</p>
                      )}
                      {ideal && (
                        <span className="text-[9px] bg-purple-500/15 text-purple-300 border border-purple-500/20 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                          🎆 fireworks
                        </span>
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
      </PageContent>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Event</DialogTitle></DialogHeader>
          <Input value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="Event name"
            onKeyDown={e => e.key === 'Enter' && addTitle.trim() && createItem.mutate({ title: addTitle })}
            autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => createItem.mutate({ title: addTitle })}
              disabled={!addTitle.trim() || createItem.isPending}>
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
            onKeyDown={e => e.key === 'Enter' && editTitle.trim() && editingItem && renameItem.mutate({ item: editingItem, title: editTitle })}
            autoFocus />
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
