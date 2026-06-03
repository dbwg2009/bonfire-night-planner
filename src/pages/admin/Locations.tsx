import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, MapPin, Check, X, ChevronDown, ChevronUp, Pencil, Trash2, ExternalLink } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input, Textarea } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Badge } from '../../components/ui/badge'
import { Switch } from '../../components/ui/switch'
import { PageHeader, PageContent } from '../../components/Layout'
import { useEventStore } from '../../store/event'
import { api } from '../../lib/api'
import { generateId, LOCATION_STATUS_COLORS, LOCATION_STATUS_LABELS } from '../../lib/utils'
import { toast } from '../../components/ui/toast'
import { cn } from '../../lib/utils'
import type { Location } from '../../lib/types'

const EMPTY: Omit<Location, 'id' | 'event_id' | 'created_at'> = {
  name: '', address: '', map_url: '', status: 'considering',
  pros: [], cons: [], capacity: undefined, parking: undefined,
  accessibility: '', walk_time_from_meeting: undefined,
  fire_permission: false, fireworks_permission: false, notes: ''
}

export default function Locations() {
  const event = useEventStore(s => s.currentEvent)
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Location | null>(null)
  const [form, setForm] = useState<typeof EMPTY>(EMPTY)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [newPro, setNewPro] = useState('')
  const [newCon, setNewCon] = useState('')

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['locations', event?.id],
    queryFn: () => api.getLocations(event!.id) as Promise<Location[]>,
    enabled: !!event?.id
  })

  const save = useMutation({
    mutationFn: async (data: typeof form) => {
      if (editing) return api.updateLocation(event!.id, editing.id, data)
      return api.createLocation(event!.id, { ...data, id: generateId(), event_id: event!.id })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['locations'] }); setOpen(false); toast('Location saved') }
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteLocation(event!.id, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['locations'] }); toast('Location removed') }
  })

  function openEdit(loc: Location) {
    setEditing(loc)
    setForm({ name: loc.name, address: loc.address ?? '', map_url: loc.map_url ?? '', status: loc.status, pros: loc.pros, cons: loc.cons, capacity: loc.capacity, parking: loc.parking, accessibility: loc.accessibility ?? '', walk_time_from_meeting: loc.walk_time_from_meeting, fire_permission: loc.fire_permission, fireworks_permission: loc.fireworks_permission, notes: loc.notes ?? '' })
    setOpen(true)
  }

  const chosen = locations.filter(l => l.status === 'chosen')
  const considering = locations.filter(l => l.status === 'considering')
  const rejected = locations.filter(l => l.status === 'rejected')
  const ordered = [...chosen, ...considering, ...rejected]

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Locations"
        subtitle="Venue planning"
        action={<Button size="icon" onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true) }}><Plus size={18} /></Button>}
      />

      <PageContent>
        {ordered.length === 0 ? (
          <Card className="text-center py-8 text-smoke-500">
            <MapPin size={24} className="mx-auto mb-2 opacity-40" />
            No locations yet — add potential venues above
          </Card>
        ) : (
          <div className="space-y-2">
            {ordered.map(loc => (
              <Card key={loc.id} className={cn('p-0 overflow-hidden', loc.status === 'chosen' && 'border-emerald-400/30')}>
                <button
                  onClick={() => setExpanded(expanded === loc.id ? null : loc.id)}
                  className="w-full p-3.5 flex items-center gap-3 text-left tap-highlight-none"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-smoke-100 truncate">{loc.name}</p>
                      <span className={cn('text-[10px] border px-1.5 py-0.5 rounded-full shrink-0', LOCATION_STATUS_COLORS[loc.status])}>
                        {LOCATION_STATUS_LABELS[loc.status]}
                      </span>
                    </div>
                    {loc.address && <p className="text-[11px] text-smoke-500 mt-0.5">{loc.address}</p>}
                    <div className="flex gap-3 mt-1">
                      {loc.fire_permission && <span className="text-[10px] text-amber-400">🔥 Fire ✓</span>}
                      {loc.fireworks_permission && <span className="text-[10px] text-purple-400">🎆 Fireworks ✓</span>}
                      {loc.capacity && <span className="text-[10px] text-smoke-500">Cap: {loc.capacity}</span>}
                    </div>
                  </div>
                  {expanded === loc.id ? <ChevronUp size={16} className="text-smoke-500 shrink-0" /> : <ChevronDown size={16} className="text-smoke-500 shrink-0" />}
                </button>

                {expanded === loc.id && (
                  <div className="border-t border-white/5 px-3.5 pb-3.5 pt-2 space-y-3 animate-fade-in">
                    {/* Map link */}
                    {loc.map_url && (
                      <a href={loc.map_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-fire-400 hover:text-fire-300">
                        <ExternalLink size={12} /> Open in Maps
                      </a>
                    )}

                    {/* Pros & cons */}
                    {(loc.pros.length > 0 || loc.cons.length > 0) && (
                      <div className="grid grid-cols-2 gap-2">
                        {loc.pros.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">Pros</p>
                            {loc.pros.map((p, i) => (
                              <div key={i} className="flex items-start gap-1 text-xs text-smoke-300">
                                <Check size={10} className="text-emerald-400 mt-0.5 shrink-0" />{p}
                              </div>
                            ))}
                          </div>
                        )}
                        {loc.cons.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1">Cons</p>
                            {loc.cons.map((c, i) => (
                              <div key={i} className="flex items-start gap-1 text-xs text-smoke-300">
                                <X size={10} className="text-red-400 mt-0.5 shrink-0" />{c}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Logistics */}
                    <div className="flex flex-wrap gap-2">
                      {loc.parking && <Badge variant="ghost">🅿️ Parking: {loc.parking}</Badge>}
                      {loc.walk_time_from_meeting && <Badge variant="ghost">🚶 {loc.walk_time_from_meeting} min walk</Badge>}
                      {loc.accessibility && <Badge variant="ghost">♿ {loc.accessibility}</Badge>}
                    </div>

                    {loc.notes && <p className="text-xs text-smoke-400">{loc.notes}</p>}

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(loc)}>
                        <Pencil size={13} /> Edit
                      </Button>
                      <Button variant="destructive" size="sm" className="flex-1" onClick={() => { if (confirm('Remove?')) remove.mutate(loc.id) }}>
                        <Trash2 size={13} /> Remove
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </PageContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Location' : 'Add Location'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Venue name" />
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Address" />
            <Input value={form.map_url} onChange={e => setForm(f => ({ ...f, map_url: e.target.value }))} placeholder="Google Maps URL" type="url" />

            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as Location['status'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="considering">Considering</SelectItem>
                  <SelectItem value="chosen">Chosen ✓</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-smoke-400 mb-1 block">Capacity</label>
                <Input type="number" value={form.capacity ?? ''} onChange={e => setForm(f => ({ ...f, capacity: e.target.value ? parseInt(e.target.value) : undefined }))} placeholder="Max people" />
              </div>
              <div>
                <label className="text-xs text-smoke-400 mb-1 block">Walk time (mins)</label>
                <Input type="number" value={form.walk_time_from_meeting ?? ''} onChange={e => setForm(f => ({ ...f, walk_time_from_meeting: e.target.value ? parseInt(e.target.value) : undefined }))} placeholder="e.g. 40" />
              </div>
            </div>

            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Parking</label>
              <Select value={form.parking ?? ''} onValueChange={v => setForm(f => ({ ...f, parking: v as Location['parking'] }))}>
                <SelectTrigger><SelectValue placeholder="Select parking" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="limited">Limited</SelectItem>
                  <SelectItem value="ample">Ample</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Input value={form.accessibility} onChange={e => setForm(f => ({ ...f, accessibility: e.target.value }))} placeholder="Accessibility notes" />

            <div className="flex items-center justify-between py-1">
              <p className="text-sm text-smoke-200">🔥 Fire permission</p>
              <Switch checked={form.fire_permission} onCheckedChange={v => setForm(f => ({ ...f, fire_permission: v }))} />
            </div>
            <div className="flex items-center justify-between py-1">
              <p className="text-sm text-smoke-200">🎆 Fireworks permission</p>
              <Switch checked={form.fireworks_permission} onCheckedChange={v => setForm(f => ({ ...f, fireworks_permission: v }))} />
            </div>

            {/* Pros */}
            <div>
              <label className="text-xs text-emerald-400 mb-1 block font-medium">Pros</label>
              {form.pros.map((p, i) => (
                <div key={i} className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-smoke-300 flex-1">{p}</span>
                  <button onClick={() => setForm(f => ({ ...f, pros: f.pros.filter((_, j) => j !== i) }))} className="text-smoke-500 hover:text-red-400 tap-highlight-none"><X size={13} /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={newPro} onChange={e => setNewPro(e.target.value)} placeholder="Add a pro…" className="flex-1" onKeyDown={e => { if (e.key === 'Enter' && newPro.trim()) { setForm(f => ({ ...f, pros: [...f.pros, newPro.trim()] })); setNewPro('') } }} />
                <Button size="icon-sm" variant="ghost" onClick={() => { if (newPro.trim()) { setForm(f => ({ ...f, pros: [...f.pros, newPro.trim()] })); setNewPro('') } }}><Plus size={14} /></Button>
              </div>
            </div>

            {/* Cons */}
            <div>
              <label className="text-xs text-red-400 mb-1 block font-medium">Cons</label>
              {form.cons.map((c, i) => (
                <div key={i} className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-smoke-300 flex-1">{c}</span>
                  <button onClick={() => setForm(f => ({ ...f, cons: f.cons.filter((_, j) => j !== i) }))} className="text-smoke-500 hover:text-red-400 tap-highlight-none"><X size={13} /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={newCon} onChange={e => setNewCon(e.target.value)} placeholder="Add a con…" className="flex-1" onKeyDown={e => { if (e.key === 'Enter' && newCon.trim()) { setForm(f => ({ ...f, cons: [...f.cons, newCon.trim()] })); setNewCon('') } }} />
                <Button size="icon-sm" variant="ghost" onClick={() => { if (newCon.trim()) { setForm(f => ({ ...f, cons: [...f.cons, newCon.trim()] })); setNewCon('') } }}><Plus size={14} /></Button>
              </div>
            </div>

            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes…" className="min-h-[60px]" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate(form)} disabled={!form.name.trim() || save.isPending}>
              {save.isPending ? 'Saving…' : editing ? 'Save' : 'Add Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
