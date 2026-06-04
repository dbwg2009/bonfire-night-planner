import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sun, Moon, Sunset, Clock } from 'lucide-react'
import SunCalc from 'suncalc'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { PageHeader, PageContent } from '../../components/Layout'
import { useEventStore } from '../../store/event'
import { api } from '../../lib/api'
import { formatTime, cn } from '../../lib/utils'
import { toast } from '../../components/ui/toast'
import type { ScheduleItem, Event } from '../../lib/types'

const DEFAULT_LAT = 51.822
const DEFAULT_LON = -3.016
const FIREWORKS_THRESHOLD = 10  // below this % = "ideal for fireworks"

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function getLightPercent(timeStr: string, date: Date, lat: number, lon: number): number {
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  const pos = SunCalc.getPosition(d, lat, lon)
  // altitude in radians: map [-0.314, 0.105] (≈-18° to 6°) → [0, 100]
  const altDeg = (pos.altitude * 180) / Math.PI
  return Math.round(Math.max(0, Math.min(100, ((altDeg + 18) / 24) * 100)))
}

function lightColor(pct: number): string {
  if (pct >= 60) return 'text-amber-400'
  if (pct >= 30) return 'text-orange-400'
  if (pct >= 10) return 'text-indigo-400'
  return 'text-purple-500'
}

function lightIcon(pct: number) {
  if (pct >= 60) return <Sun size={12} className="text-amber-400" />
  if (pct >= 30) return <Sunset size={12} className="text-orange-400" />
  if (pct >= 10) return <Moon size={12} className="text-indigo-400" />
  return <Moon size={12} className="text-purple-500" />
}

function LightBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden w-16">
      <div
        className={cn('h-full rounded-full transition-all', pct >= 10 ? 'bg-amber-400/60' : 'bg-purple-500/60')}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function LightLevels() {
  const event = useEventStore(s => s.currentEvent) as Event | null
  const qc = useQueryClient()
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null)
  const [targetInput, setTargetInput] = useState<string>('')

  const lat = event?.lat ?? DEFAULT_LAT
  const lon = event?.lon ?? DEFAULT_LON
  const eventDate = event ? parseLocalDate(event.date) : new Date()

  const { data: items = [], isLoading } = useQuery<ScheduleItem[]>({
    queryKey: ['schedule', event?.id],
    queryFn: () => api.getSchedule(event!.id) as Promise<ScheduleItem[]>,
    enabled: !!event?.id
  })

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order || (a.start_time ?? '').localeCompare(b.start_time ?? ''))

  const updateTarget = useMutation({
    mutationFn: (item: ScheduleItem) =>
      api.updateScheduleItem(event!.id, item.id, item),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] })
      setEditingItem(null)
      toast('Light target saved')
    }
  })

  function openEdit(item: ScheduleItem) {
    setEditingItem(item)
    setTargetInput(item.light_level_target != null ? String(item.light_level_target) : '')
  }

  function saveTarget() {
    if (!editingItem) return
    const parsed = targetInput === '' ? undefined : Math.max(0, Math.min(100, parseInt(targetInput, 10)))
    updateTarget.mutate({ ...editingItem, light_level_target: parsed })
  }

  // Sun progression timeline rows
  const sunTimes = (() => {
    const times = SunCalc.getTimes(eventDate, lat, lon)
    return [
      { label: 'Sunset', time: times.sunset, icon: <Sunset size={12} className="text-fire-400" /> },
      { label: 'Golden hour', time: times.goldenHour, icon: <Sun size={12} className="text-orange-400" /> },
      { label: 'Civil dusk', time: times.dusk, icon: <Moon size={12} className="text-indigo-400" /> },
      { label: 'Nautical dusk', time: times.nauticalDusk, icon: <Moon size={12} className="text-purple-400" /> },
    ]
  })()

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Light Levels"
        subtitle="Assign brightness to schedule items"
      />

      <PageContent>
        {/* Sun progression card */}
        <Card>
          <p className="text-xs font-medium text-smoke-400 uppercase tracking-wider mb-3">Sun progression</p>
          <div className="space-y-2">
            {sunTimes.map(({ label, time, icon }) => {
              const valid = time instanceof Date && !isNaN(time.getTime())
              const timeStr = valid ? time.toTimeString().slice(0, 5) : null
              const pct = timeStr ? getLightPercent(timeStr, eventDate, lat, lon) : 0
              return (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <span className="shrink-0">{icon}</span>
                  <span className="flex-1 text-smoke-400">{label}</span>
                  <LightBar pct={pct} />
                  <span className={cn('font-mono text-[11px] w-7 text-right', lightColor(pct))}>{pct}%</span>
                  <span className="font-mono text-smoke-300 text-[11px] w-10 text-right">
                    {timeStr ? formatTime(timeStr) : '–'}
                  </span>
                </div>
              )
            })}
          </div>
          {event?.light_notes && (
            <p className="text-xs text-smoke-400 mt-3 border-t border-white/5 pt-2">{event.light_notes}</p>
          )}
        </Card>

        {/* Schedule items with light assignments */}
        <div>
          <p className="text-xs font-medium text-smoke-400 uppercase tracking-wider mb-2 px-1">Schedule items</p>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Card key={i} className="h-14 shimmer" />)}</div>
          ) : sorted.length === 0 ? (
            <Card className="text-center py-8 text-smoke-500 text-sm">No schedule items — add them on the Schedule page</Card>
          ) : (
            <div className="space-y-2">
              {sorted.map(item => {
                const autoLight = item.start_time ? getLightPercent(item.start_time, eventDate, lat, lon) : null
                const displayPct = item.light_level_target ?? autoLight
                const isIdeal = displayPct != null && displayPct < FIREWORKS_THRESHOLD
                return (
                  <Card key={item.id} className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        {displayPct != null ? lightIcon(displayPct) : <Sun size={12} className="text-smoke-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-smoke-100">{item.title}</p>
                          {isIdeal && (
                            <span className="text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/20 px-1.5 py-0.5 rounded-full">
                              🎆 ideal for fireworks
                            </span>
                          )}
                          {item.light_level_target != null && (
                            <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                              manual {item.light_level_target}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          {item.start_time && (
                            <span className="flex items-center gap-1 text-[11px] text-smoke-500">
                              <Clock size={10} />
                              {formatTime(item.start_time)}
                            </span>
                          )}
                          {displayPct != null && (
                            <div className="flex items-center gap-1.5">
                              <LightBar pct={displayPct} />
                              <span className={cn('text-[11px] font-mono', lightColor(displayPct))}>{displayPct}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => openEdit(item)}
                        className="shrink-0 text-xs text-smoke-500 hover:text-smoke-200 transition-colors tap-highlight-none px-2 py-1 rounded-lg glass"
                      >
                        Set %
                      </button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        <p className="text-[11px] text-smoke-600 text-center">
          Auto-calculated from SunCalc · tap "Set %" to override
        </p>
      </PageContent>

      <Dialog open={!!editingItem} onOpenChange={open => { if (!open) setEditingItem(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Light Target — {editingItem?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-smoke-400">
              Override the auto-calculated light level for this item. 0 = pitch dark, 100 = full daylight.
            </p>
            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Light % (0–100, leave blank for auto)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={targetInput}
                onChange={e => setTargetInput(e.target.value)}
                placeholder="auto"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-smoke-100 placeholder:text-smoke-600 focus:outline-none focus:border-fire-400/50"
              />
            </div>
            {targetInput !== '' && !isNaN(parseInt(targetInput)) && parseInt(targetInput) < FIREWORKS_THRESHOLD && (
              <p className="text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2">
                🎆 Below {FIREWORKS_THRESHOLD}% — this will show the "ideal for fireworks" badge
              </p>
            )}
            {targetInput !== '' && (
              <div className="flex items-center gap-2">
                <LightBar pct={Math.max(0, Math.min(100, parseInt(targetInput) || 0))} />
                <span className={cn('text-xs font-mono', lightColor(Math.max(0, Math.min(100, parseInt(targetInput) || 0))))}>
                  {Math.max(0, Math.min(100, parseInt(targetInput) || 0))}%
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingItem(null)}>Cancel</Button>
            <Button onClick={saveTarget} disabled={updateTarget.isPending}>
              {updateTarget.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
