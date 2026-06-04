import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import SunCalc from 'suncalc'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { PageHeader, PageContent } from '../../components/Layout'
import { useEventStore } from '../../store/event'
import { api } from '../../lib/api'
import { generateId } from '../../lib/utils'
import { toast } from '../../components/ui/toast'
import type { ScheduleItem, Event } from '../../lib/types'

const DEFAULT_LAT = 51.822
const DEFAULT_LON = -3.016
const FIREWORKS_THRESHOLD = 10

const PRESET_EVENTS = [
  { title: 'Leaving meeting location', activity_type: 'Transportation' },
  { title: 'Arriving at venue', activity_type: 'Transportation' },
  { title: 'Finishing setup', activity_type: 'Setup' },
  { title: 'Lighting bonfire', activity_type: 'Activity' },
  { title: 'Lighting fireworks', activity_type: 'Fireworks' },
] as const

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function getSunAltDeg(minutes: number, date: Date, lat: number, lon: number): number {
  const d = new Date(date)
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return (SunCalc.getPosition(d, lat, lon).altitude * 180) / Math.PI
}

function getLightPct(altDeg: number): number {
  return Math.round(Math.max(0, Math.min(100, ((altDeg + 18) / 24) * 100)))
}

function skyGradientStyle(lightPct: number): React.CSSProperties {
  if (lightPct >= 70) return { background: 'linear-gradient(to bottom, #0ea5e9 0%, #1d4ed8 100%)' }
  if (lightPct >= 45) return { background: 'linear-gradient(to bottom, #fb923c 0%, #9a3412 100%)' }
  if (lightPct >= 20) return { background: 'linear-gradient(to bottom, #9d174d 0%, #4c1d95 55%, #1e1b4b 100%)' }
  if (lightPct >= 8) return { background: 'linear-gradient(to bottom, #312e81 0%, #1e1b4b 60%, #0f172a 100%)' }
  return { background: 'linear-gradient(to bottom, #0f172a 0%, #000000 100%)' }
}

function sunDotColor(altDeg: number): string {
  if (altDeg > 10) return '#fcd34d'
  if (altDeg > 0) return '#fb923c'
  if (altDeg > -6) return '#f87171'
  return '#a78bfa'
}

interface SunArcProps {
  currentMinutes: number
  arcPath: string
  sunriseMinutes: number
  nightMinutes: number
  date: Date
  lat: number
  lon: number
  lightPct: number
}

function SunArc({ currentMinutes, arcPath, sunriseMinutes, nightMinutes, date, lat, lon, lightPct }: SunArcProps) {
  const W = 300
  const horizonY = 60
  const maxAlt = 40

  const altDeg = getSunAltDeg(currentMinutes, date, lat, lon)
  const t = Math.max(0, Math.min(1, (currentMinutes - sunriseMinutes) / Math.max(1, nightMinutes - sunriseMinutes)))
  const sunX = 10 + t * (W - 20)
  const sunY = horizonY - Math.max(-20, Math.min(maxAlt, altDeg)) * (horizonY / maxAlt) * 0.9
  const isBelowHorizon = altDeg < 0
  const starOpacity = Math.max(0, (15 - lightPct) / 15)

  return (
    <svg viewBox={`0 0 ${W} 80`} className="w-full" preserveAspectRatio="none" height={80}>
      {starOpacity > 0 && (
        [[40, 12], [110, 6], [180, 18], [245, 8], [165, 4], [75, 22], [220, 30]].map(([sx, sy], i) => (
          <circle key={i} cx={sx} cy={sy} r={0.9} fill="white" opacity={starOpacity * 0.9} />
        ))
      )}
      <path d={arcPath} fill="none" stroke="white" strokeOpacity={0.18} strokeWidth={1} strokeDasharray="4 4" />
      <line x1={0} y1={horizonY} x2={W} y2={horizonY} stroke="white" strokeOpacity={0.25} strokeWidth={0.8} />
      {!isBelowHorizon && (
        <circle cx={sunX} cy={sunY} r={14} fill={sunDotColor(altDeg)} opacity={0.18} />
      )}
      <circle
        cx={sunX}
        cy={isBelowHorizon ? Math.min(horizonY + 12, sunY) : sunY}
        r={isBelowHorizon ? 4 : 7}
        fill={sunDotColor(altDeg)}
        opacity={isBelowHorizon ? 0.55 : 1}
      />
    </svg>
  )
}

export default function LightLevels() {
  const event = useEventStore(s => s.currentEvent) as Event | null
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [localTimes, setLocalTimes] = useState<Record<string, number>>({})

  const lat = event?.lat ?? DEFAULT_LAT
  const lon = event?.lon ?? DEFAULT_LON
  const eventDate = event ? parseLocalDate(event.date) : new Date()

  const { sunriseMinutes, nightMinutes } = useMemo(() => {
    const times = SunCalc.getTimes(eventDate, lat, lon)
    const toMin = (d: Date) => (d instanceof Date && !isNaN(d.getTime())) ? d.getHours() * 60 + d.getMinutes() : null
    const sunrise = toMin(times.sunrise) ?? 6 * 60
    const night = toMin(times.night) ?? toMin(times.nauticalDusk) ?? 21 * 60
    return { sunriseMinutes: sunrise, nightMinutes: Math.max(sunrise + 120, night) }
  }, [eventDate, lat, lon])

  const arcPath = useMemo(() => {
    const W = 300
    const horizonY = 60
    const maxAlt = 40
    const steps = 40
    return Array.from({ length: steps + 1 }, (_, i) => {
      const mins = sunriseMinutes + (i / steps) * (nightMinutes - sunriseMinutes)
      const alt = getSunAltDeg(mins, eventDate, lat, lon)
      const x = 10 + (i / steps) * (W - 20)
      const y = horizonY - Math.max(-20, Math.min(maxAlt, alt)) * (horizonY / maxAlt) * 0.9
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }, [sunriseMinutes, nightMinutes, eventDate, lat, lon])

  const defaultMinutes = Math.round((sunriseMinutes + nightMinutes) / 2)

  const { data: items = [], isLoading } = useQuery<ScheduleItem[]>({
    queryKey: ['schedule', event?.id],
    queryFn: () => api.getSchedule(event!.id) as Promise<ScheduleItem[]>,
    enabled: !!event?.id
  })

  const sorted = useMemo(() =>
    [...items].sort((a, b) =>
      (a.start_time ?? '').localeCompare(b.start_time ?? '') || a.sort_order - b.sort_order
    ), [items])

  const unseededPresets = PRESET_EVENTS.filter(p =>
    !items.some(item => item.title.toLowerCase() === p.title.toLowerCase())
  )

  function getMinutes(item: ScheduleItem): number {
    return localTimes[item.id] ?? (item.start_time ? timeToMinutes(item.start_time) : defaultMinutes)
  }

  const updateTime = useMutation({
    mutationFn: ({ item, minutes }: { item: ScheduleItem; minutes: number }) =>
      api.updateScheduleItem(event!.id, item.id, { ...item, start_time: minutesToTime(minutes) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] })
  })

  const createItem = useMutation({
    mutationFn: ({ title, activityType }: { title: string; activityType?: string }) =>
      api.createScheduleItem(event!.id, {
        id: generateId(),
        event_id: event!.id,
        title,
        activity_type: activityType ?? '',
        sort_order: items.length,
        start_time: minutesToTime(defaultMinutes),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      setAddOpen(false)
      setNewTitle('')
      toast('Event added')
    }
  })

  function commitTime(item: ScheduleItem) {
    const minutes = localTimes[item.id]
    if (minutes === undefined) return
    updateTime.mutate({ item, minutes })
    setLocalTimes(prev => { const n = { ...prev }; delete n[item.id]; return n })
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Light Levels"
        subtitle="Time events to the sun"
        action={<Button size="icon" onClick={() => setAddOpen(true)}><Plus size={18} /></Button>}
      />

      <PageContent>
        {/* Suggested presets */}
        {unseededPresets.length > 0 && (
          <div>
            <p className="text-xs font-medium text-smoke-400 uppercase tracking-wider mb-2 px-1">Suggested events</p>
            <div className="space-y-1.5">
              {unseededPresets.map(preset => (
                <button
                  key={preset.title}
                  onClick={() => createItem.mutate({ title: preset.title, activityType: preset.activity_type })}
                  disabled={createItem.isPending}
                  className="w-full text-left glass border border-white/10 rounded-xl px-3 py-2.5 flex items-center justify-between group hover:border-fire-400/30 transition-colors tap-highlight-none"
                >
                  <span className="text-sm text-smoke-400 group-hover:text-smoke-200 transition-colors">{preset.title}</span>
                  <span className="text-[11px] text-fire-400 opacity-0 group-hover:opacity-100 transition-opacity">+ Add</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Schedule items with sun slider */}
        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-44 rounded-2xl shimmer" />)}</div>
        ) : sorted.length > 0 ? (
          <div className="space-y-3">
            {sorted.map(item => {
              const minutes = getMinutes(item)
              const altDeg = getSunAltDeg(minutes, eventDate, lat, lon)
              const lightPct = getLightPct(altDeg)
              const isIdeal = lightPct < FIREWORKS_THRESHOLD

              return (
                <div key={item.id} className="rounded-2xl overflow-hidden" style={skyGradientStyle(lightPct)}>
                  <div className="px-2 pt-2 pb-0">
                    <SunArc
                      currentMinutes={minutes}
                      arcPath={arcPath}
                      sunriseMinutes={sunriseMinutes}
                      nightMinutes={nightMinutes}
                      date={eventDate}
                      lat={lat}
                      lon={lon}
                      lightPct={lightPct}
                    />
                  </div>

                  <div className="px-4 pb-2">
                    <input
                      type="range"
                      min={sunriseMinutes}
                      max={nightMinutes}
                      step={5}
                      value={minutes}
                      onChange={e => setLocalTimes(prev => ({ ...prev, [item.id]: Number(e.target.value) }))}
                      onMouseUp={() => commitTime(item)}
                      onTouchEnd={() => commitTime(item)}
                      className="w-full h-1 rounded-full cursor-pointer appearance-none bg-white/20
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                        [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
                        [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
                        [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white
                        [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
                    />
                  </div>

                  <div className="bg-black/35 px-3 py-2.5">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-white/70 font-mono tabular-nums">{minutesToTime(minutes)}</span>
                      <span className="text-white/30 text-xs">·</span>
                      <span className="text-xs text-white/60">{lightPct}% light</span>
                      {isIdeal && (
                        <span className="text-[10px] bg-purple-500/30 text-purple-200 border border-purple-400/30 px-1.5 py-0.5 rounded-full">
                          🎆 ideal for fireworks
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : !unseededPresets.length ? (
          <div className="text-center py-8 text-smoke-500 text-sm">No events yet — add one above</div>
        ) : null}

        <p className="text-[11px] text-smoke-600 text-center">
          Drag the slider to set event time · synced to Schedule page
        </p>
      </PageContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Event</DialogTitle>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Event name"
            onKeyDown={e => e.key === 'Enter' && newTitle.trim() && createItem.mutate({ title: newTitle })}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createItem.mutate({ title: newTitle })}
              disabled={!newTitle.trim() || createItem.isPending}
            >
              {createItem.isPending ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
