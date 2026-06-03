import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Clock, MapPin, Bus } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input, Textarea } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { Badge } from '../../components/ui/badge'
import { PageHeader, PageContent } from '../../components/Layout'
import { useEventStore } from '../../store/event'
import { api } from '../../lib/api'
import { generateId, formatTime } from '../../lib/utils'
import { toast } from '../../components/ui/toast'
import type { Guest, ConflictScheduleItem } from '../../lib/types'

const EMPTY_ITEM = { title: '', start_time: '', end_time: '', location: '', transport: '', notes: '', sort_order: 0 }

export default function ConflictEvent() {
  const event = useEventStore(s => s.currentEvent)
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ConflictScheduleItem | null>(null)
  const [form, setForm] = useState(EMPTY_ITEM)

  const { data: guests = [] } = useQuery<Guest[]>({
    queryKey: ['guests', event?.id],
    queryFn: () => api.getGuests(event!.id) as Promise<Guest[]>,
    enabled: !!event?.id
  })

  const { data: schedule = [] } = useQuery<ConflictScheduleItem[]>({
    queryKey: ['conflict-schedule', event?.id],
    queryFn: () => api.getConflictSchedule(event!.id) as Promise<ConflictScheduleItem[]>,
    enabled: !!event?.id
  })

  const save = useMutation({
    mutationFn: async (data: typeof form) => {
      if (editing) return api.updateConflictItem(event!.id, editing.id, data)
      return api.createConflictItem(event!.id, { ...data, id: generateId(), event_id: event!.id })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conflict-schedule'] }); setOpen(false); toast('Schedule updated') }
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteConflictItem(event!.id, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conflict-schedule'] }); toast('Removed') }
  })

  const conflictGuests = guests.filter(g => g.conflict_event && g.rsvp_status === 'accepted')
  const sorted = [...schedule].sort((a, b) => a.sort_order - b.sort_order || (a.start_time ?? '').localeCompare(b.start_time ?? ''))

  const conflictName = event?.conflict_event_name || 'Conflict Event'

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={conflictName}
        subtitle={`${conflictGuests.length} guests attending`}
        action={<Button size="icon" onClick={() => { setEditing(null); setForm(EMPTY_ITEM); setOpen(true) }}><Plus size={18} /></Button>}
      />

      <PageContent>
        {/* Guest list for conflict event */}
        <Card>
          <h2 className="text-sm font-semibold text-smoke-300 mb-2">Guests attending</h2>
          {conflictGuests.length === 0 ? (
            <p className="text-sm text-smoke-500">No guests marked for {conflictName} yet</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {conflictGuests.map(g => (
                <Badge key={g.id} variant="default" className="bg-purple-500/15 text-purple-300 border-purple-400/25">{g.name}</Badge>
              ))}
            </div>
          )}
          <p className="text-[11px] text-smoke-500 mt-2">Mark guests in the Guests page</p>
        </Card>

        {/* Transport & schedule */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-smoke-300">Transport & Schedule</h2>
        </div>

        {sorted.length === 0 ? (
          <Card className="text-center py-6 text-smoke-500">
            No schedule items yet — add transport and timing details above
          </Card>
        ) : (
          <div className="relative">
            <div className="absolute left-[22px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500/50 via-purple-500/20 to-transparent" />
            <div className="space-y-2 pl-2">
              {sorted.map((item) => (
                <div key={item.id} className="relative flex gap-3">
                  <div className="shrink-0 w-10 flex items-start justify-center pt-3.5">
                    <div className="w-3 h-3 rounded-full bg-purple-500 border-2 border-fire-900 ring-2 ring-purple-500/20" />
                  </div>
                  <Card className="flex-1 p-3 border-purple-500/15">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        {item.start_time && (
                          <div className="flex items-center gap-1 text-xs text-purple-400 mb-1">
                            <Clock size={11} />{formatTime(item.start_time)}{item.end_time && ` — ${formatTime(item.end_time)}`}
                          </div>
                        )}
                        <p className="text-sm font-medium text-smoke-100">{item.title}</p>
                        {item.location && (
                          <div className="flex items-center gap-1 text-[11px] text-smoke-500 mt-0.5"><MapPin size={10} />{item.location}</div>
                        )}
                        {item.transport && (
                          <div className="flex items-center gap-1 text-[11px] text-smoke-500 mt-0.5"><Bus size={10} />{item.transport}</div>
                        )}
                        {item.notes && <p className="text-[11px] text-smoke-500 mt-1">{item.notes}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditing(item); setForm({ title: item.title, start_time: item.start_time ?? '', end_time: item.end_time ?? '', location: item.location ?? '', transport: item.transport ?? '', notes: item.notes ?? '', sort_order: item.sort_order }); setOpen(true) }} className="p-1.5 text-smoke-500 hover:text-smoke-200 tap-highlight-none">
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
            <DialogTitle>{editing ? 'Edit' : 'Add'} Schedule Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Activity or transport step" />
            <div className="grid grid-cols-2 gap-2">
              <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
              <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
            </div>
            <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Location" />
            <Input value={form.transport} onChange={e => setForm(f => ({ ...f, transport: e.target.value }))} placeholder="Transport (e.g. Walk, Car, Bus)" />
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
