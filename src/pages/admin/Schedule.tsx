import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Clock, MapPin } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input, Textarea } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { WhatsAppCopyButton } from '../../components/WhatsAppCopyButton'
import { PageHeader, PageContent } from '../../components/Layout'
import { useEventStore } from '../../store/event'
import { api } from '../../lib/api'
import { generateId, formatTime } from '../../lib/utils'
import { buildScheduleMessage } from '../../lib/whatsapp'
import { toast } from '../../components/ui/toast'
import type { ScheduleItem, Event } from '../../lib/types'

const EMPTY_ITEM = { title: '', activity_type: '', start_time: '', end_time: '', location: '', owner: '', notes: '', sort_order: 0 }

export default function Schedule() {
  const event = useEventStore(s => s.currentEvent)
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduleItem | null>(null)
  const [form, setForm] = useState(EMPTY_ITEM)

  const { data: items = [], isLoading } = useQuery<ScheduleItem[]>({
    queryKey: ['schedule', event?.id],
    queryFn: () => api.getSchedule(event!.id) as Promise<ScheduleItem[]>,
    enabled: !!event?.id
  })

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order || (a.start_time ?? '').localeCompare(b.start_time ?? ''))

  const save = useMutation({
    mutationFn: async (data: typeof form) => {
      if (editing) return api.updateScheduleItem(event!.id, editing.id, data)
      return api.createScheduleItem(event!.id, { ...data, id: generateId(), event_id: event!.id, sort_order: items.length })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedule'] }); setOpen(false); toast('Schedule updated') }
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteScheduleItem(event!.id, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedule'] }); toast('Item removed') }
  })

  function openEdit(item: ScheduleItem) {
    setEditing(item)
    setForm({ title: item.title, activity_type: item.activity_type ?? '', start_time: item.start_time ?? '', end_time: item.end_time ?? '', location: item.location ?? '', owner: item.owner ?? '', notes: item.notes ?? '', sort_order: item.sort_order })
    setOpen(true)
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY_ITEM)
    setOpen(true)
  }

  const ACTIVITY_TYPES = ['Transportation', 'Setup', 'Activity', 'Food', 'Fireworks', 'Social', 'Other']

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Schedule"
        subtitle="Evening timeline"
        action={
          <div className="flex gap-2">
            <WhatsAppCopyButton
              label="Schedule"
              generate={() => buildScheduleMessage(items, event as Event)}
            />
            <Button size="icon" onClick={openNew}><Plus size={18} /></Button>
          </div>
        }
      />

      <PageContent>
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Card key={i} className="h-16 shimmer" />)}</div>
        ) : sorted.length === 0 ? (
          <Card className="text-center py-8 text-smoke-500">No schedule items yet — add one above</Card>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[22px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-fire-500/50 via-fire-500/20 to-transparent" />
            <div className="space-y-2 pl-2">
              {sorted.map((item, i) => (
                <div key={item.id} className="relative flex gap-3 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                  {/* Timeline dot */}
                  <div className="shrink-0 w-10 flex items-start justify-center pt-3.5">
                    <div className="w-3 h-3 rounded-full bg-fire-500 border-2 border-fire-900 ring-2 ring-fire-500/20" />
                  </div>

                  <Card className="flex-1 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {item.start_time && (
                          <div className="flex items-center gap-1 text-xs text-fire-400 mb-1">
                            <Clock size={11} />
                            <span>
                              {formatTime(item.start_time)}
                              {item.end_time && ` — ${formatTime(item.end_time)}`}
                            </span>
                          </div>
                        )}
                        <p className="text-sm font-medium text-smoke-100">{item.title}</p>
                        {item.location && (
                          <div className="flex items-center gap-1 text-[11px] text-smoke-500 mt-1">
                            <MapPin size={10} />
                            {item.location}
                          </div>
                        )}
                        {item.notes && (
                          <p className="text-[11px] text-smoke-500 mt-1">{item.notes}</p>
                        )}
                        {item.owner && (
                          <p className="text-[11px] text-smoke-600 mt-0.5">Owner: {item.owner}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEdit(item)} className="p-1.5 text-smoke-500 hover:text-smoke-200 tap-highlight-none">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => { if (confirm('Remove?')) remove.mutate(item.id) }} className="p-1.5 text-smoke-500 hover:text-red-400 tap-highlight-none">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        )}
      </PageContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Schedule Item' : 'Add Schedule Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Activity name" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-smoke-400 mb-1 block">Start time</label>
                <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-smoke-400 mb-1 block">End time</label>
                <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
              </div>
            </div>
            <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Location" />
            <Input value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="Owner" />
            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Activity type</label>
              <div className="flex flex-wrap gap-1.5">
                {ACTIVITY_TYPES.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, activity_type: t }))}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition-all tap-highlight-none ${
                      form.activity_type === t
                        ? 'bg-fire-400/15 text-fire-300 border-fire-400/30'
                        : 'glass border-white/10 text-smoke-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes…" className="min-h-[60px]" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate(form)} disabled={!form.title.trim() || save.isPending}>
              {save.isPending ? 'Saving…' : editing ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
