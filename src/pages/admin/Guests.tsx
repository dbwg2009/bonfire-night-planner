import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, ChevronDown, ChevronUp, Phone, MessageCircle, Pencil, Trash2 } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Switch } from '../../components/ui/switch'
import { WhatsAppCopyButton } from '../../components/WhatsAppCopyButton'
import { PageHeader, PageContent } from '../../components/Layout'
import { useEventStore } from '../../store/event'
import { api } from '../../lib/api'
import { RSVP_COLORS, RSVP_LABELS, generateId, cn } from '../../lib/utils'
import { buildRsvpSummaryMessage } from '../../lib/whatsapp'
import { buildPickupMessage } from '../../lib/whatsapp'
import { toast } from '../../components/ui/toast'
import type { Guest, Event } from '../../lib/types'

const COMMON_RESTRICTIONS = [
  { label: '🥜 Nut allergy', value: 'nut_allergy' },
  { label: '🥛 Dairy-free', value: 'dairy_free' },
  { label: '🌾 Gluten-free', value: 'gluten_free' },
  { label: '🐷 No pork / Halal', value: 'no_pork' },
  { label: '🥬 Vegetarian', value: 'vegetarian' },
  { label: '🌱 Vegan', value: 'vegan' },
]

const EMPTY_GUEST: Omit<Guest, 'id' | 'event_id' | 'created_at' | 'updated_at'> = {
  name: '',
  rsvp_status: 'pending',
  dietary: [],
  dietary_restrictions: [],
  dietary_notes: '',
  pickup_time: '',
  emergency_contact: '',
  on_whatsapp: false,
  notes: '',
  conflict_event: false
}

export default function Guests() {
  const event = useEventStore(s => s.currentEvent)
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'accepted' | 'declined' | 'pending'>('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Guest | null>(null)
  const [form, setForm] = useState(EMPTY_GUEST)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: guests = [], isLoading } = useQuery<Guest[]>({
    queryKey: ['guests', event?.id],
    queryFn: () => api.getGuests(event!.id) as Promise<Guest[]>,
    enabled: !!event?.id
  })

  const save = useMutation({
    mutationFn: async (data: typeof form) => {
      if (editing) {
        return api.updateGuest(event!.id, editing.id, data)
      }
      return api.createGuest(event!.id, { ...data, id: generateId(), event_id: event!.id })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] })
      setOpen(false)
      toast(editing ? 'Guest updated' : 'Guest added', 'success')
    },
    onError: () => toast('Failed to save guest', 'error')
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteGuest(event!.id, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] })
      toast('Guest removed', 'success')
    }
  })

  function openEdit(guest: Guest) {
    setEditing(guest)
    setForm({
      name: guest.name,
      rsvp_status: guest.rsvp_status,
      dietary: guest.dietary,
      dietary_restrictions: guest.dietary_restrictions ?? [],
      dietary_notes: guest.dietary_notes ?? '',
      pickup_time: guest.pickup_time ?? '',
      emergency_contact: guest.emergency_contact ?? '',
      on_whatsapp: guest.on_whatsapp,
      notes: guest.notes ?? '',
      conflict_event: guest.conflict_event
    })
    setOpen(true)
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY_GUEST)
    setOpen(true)
  }

  const filtered = guests
    .filter(g => filter === 'all' || g.rsvp_status === filter)
    .filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()))

  const toggleDietary = (item: 'burger' | 'sausage') => {
    setForm(f => ({
      ...f,
      dietary: f.dietary.includes(item)
        ? f.dietary.filter(d => d !== item)
        : [...f.dietary, item]
    }))
  }

  const toggleRestriction = (value: string) => {
    setForm(f => ({
      ...f,
      dietary_restrictions: f.dietary_restrictions.includes(value)
        ? f.dietary_restrictions.filter(r => r !== value)
        : [...f.dietary_restrictions, value]
    }))
  }

  const counts = {
    all: guests.length,
    accepted: guests.filter(g => g.rsvp_status === 'accepted').length,
    declined: guests.filter(g => g.rsvp_status === 'declined').length,
    pending: guests.filter(g => g.rsvp_status === 'pending').length
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Guests"
        subtitle={`${counts.accepted} attending · ${guests.length} total`}
        action={
          <div className="flex gap-2">
            <WhatsAppCopyButton
              label="RSVP"
              generate={() => buildRsvpSummaryMessage(guests, event as Event)}
            />
            <Button size="icon" onClick={openNew}><Plus size={18} /></Button>
          </div>
        }
      />

      <PageContent>
        {/* Search + filter */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-smoke-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search guests…"
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {(['all', 'accepted', 'pending', 'declined'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all tap-highlight-none border ${
                filter === f
                  ? 'bg-fire-400/15 text-fire-300 border-fire-400/30'
                  : 'glass border-white/10 text-smoke-400'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
            </button>
          ))}
        </div>

        {/* Guest list */}
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <Card key={i} className="h-16 shimmer" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="text-center py-8 text-smoke-500">
            {search ? 'No guests match your search' : 'No guests yet — add one above'}
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(g => (
              <GuestCard
                key={g.id}
                guest={g}
                expanded={expanded === g.id}
                onToggle={() => setExpanded(expanded === g.id ? null : g.id)}
                onEdit={() => openEdit(g)}
                onDelete={() => {
                  if (confirm(`Remove ${g.name}?`)) remove.mutate(g.id)
                }}
                conflictEventEnabled={event?.conflict_event_enabled ?? false}
                conflictEventName={event?.conflict_event_name}
              />
            ))}
          </div>
        )}

        <WhatsAppCopyButton
          label="Copy pickup schedule"
          generate={() => buildPickupMessage(guests.filter(g => g.rsvp_status === 'accepted'), event as Event)}
          size="default"
          className="w-full"
        />
      </PageContent>

      {/* Edit/Add dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Guest' : 'Add Guest'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Name</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            </div>

            <div>
              <label className="text-xs text-smoke-400 mb-1 block">RSVP Status</label>
              <Select value={form.rsvp_status} onValueChange={v => setForm(f => ({ ...f, rsvp_status: v as Guest['rsvp_status'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-smoke-400 mb-2 block">Dietary Preferences</label>
              <div className="flex gap-2">
                {(['burger', 'sausage'] as const).map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleDietary(item)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all tap-highlight-none ${
                      form.dietary.includes(item)
                        ? 'bg-fire-400/15 text-fire-300 border-fire-400/30'
                        : 'glass border-white/10 text-smoke-400'
                    }`}
                  >
                    {item === 'burger' ? '🍔 Burger' : '🌭 Sausage'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-smoke-400 mb-2 block">Allergies & dietary restrictions</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_RESTRICTIONS.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleRestriction(value)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs border tap-highlight-none transition-all ${
                      form.dietary_restrictions.includes(value)
                        ? 'bg-red-500/15 text-red-300 border-red-400/30'
                        : 'glass border-white/10 text-smoke-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Input
                value={form.dietary_notes}
                onChange={e => setForm(f => ({ ...f, dietary_notes: e.target.value }))}
                placeholder="Extra detail, e.g. 'severe nut allergy — carries epipen'"
              />
            </div>

            <div>
              <label className="text-xs text-smoke-400 mb-1 block">End-of-night pick-up time</label>
              <Input
                type="time"
                value={form.pickup_time}
                onChange={e => setForm(f => ({ ...f, pickup_time: e.target.value }))}
              />
              <p className="text-[11px] text-smoke-500 mt-1">Subject to change — preference only</p>
            </div>

            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Emergency Contact</label>
              <Input
                value={form.emergency_contact}
                onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))}
                placeholder="+44 7700 000000"
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm text-smoke-200">On WhatsApp Group</p>
              </div>
              <Switch
                checked={form.on_whatsapp}
                onCheckedChange={v => setForm(f => ({ ...f, on_whatsapp: v }))}
              />
            </div>

            {event?.conflict_event_enabled && (
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm text-smoke-200">Doing {event.conflict_event_name || 'Conflict event'}</p>
                </div>
                <Switch
                  checked={form.conflict_event}
                  onCheckedChange={v => setForm(f => ({ ...f, conflict_event: v }))}
                />
              </div>
            )}

            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Notes</label>
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => save.mutate(form)}
              disabled={!form.name.trim() || save.isPending}
            >
              {save.isPending ? 'Saving…' : editing ? 'Save Changes' : 'Add Guest'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function GuestCard({ guest, expanded, onToggle, onEdit, onDelete, conflictEventEnabled, conflictEventName }: {
  guest: Guest
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  conflictEventEnabled: boolean
  conflictEventName?: string
}) {
  const dietaryLabel = guest.dietary.length === 0
    ? 'Nothing'
    : guest.dietary.map(d => d === 'burger' ? '🍔' : '🌭').join(' ')

  const hasRestrictions = (guest.dietary_restrictions?.length ?? 0) > 0 || !!guest.dietary_notes

  return (
    <Card className={cn('p-0 overflow-hidden', hasRestrictions && 'border-red-400/20')}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3.5 text-left tap-highlight-none"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-smoke-100 truncate">{guest.name}</p>
            {hasRestrictions && (
              <span className="text-[10px] bg-red-500/15 text-red-400 border border-red-400/20 rounded-full px-1.5 py-0.5 shrink-0">
                ⚠️ Restrictions
              </span>
            )}
            {conflictEventEnabled && guest.conflict_event && (
              <span className="text-[10px] bg-purple-500/15 text-purple-400 border border-purple-400/20 rounded-full px-1.5 py-0.5 shrink-0">
                {conflictEventName || 'Conflict'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${RSVP_COLORS[guest.rsvp_status]}`}>
              {RSVP_LABELS[guest.rsvp_status]}
            </span>
            <span className="text-[11px] text-smoke-500">{dietaryLabel}</span>
            {guest.pickup_time && (
              <span className="text-[11px] text-smoke-500">🚗 {guest.pickup_time}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {guest.on_whatsapp && <MessageCircle size={14} className="text-green-400" />}
          {expanded ? <ChevronUp size={16} className="text-smoke-500" /> : <ChevronDown size={16} className="text-smoke-500" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-3.5 pb-3.5 pt-2 space-y-2 animate-fade-in">
          {/* Restrictions — shown prominently */}
          {hasRestrictions && (
            <div className="bg-red-500/8 border border-red-400/20 rounded-xl p-2.5">
              <p className="text-xs font-semibold text-red-400 mb-1">⚠️ Dietary restrictions</p>
              {(guest.dietary_restrictions?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {(guest.dietary_restrictions ?? []).map(r => (
                    <span key={r} className="text-[11px] bg-red-500/15 text-red-300 border border-red-400/20 rounded-full px-1.5 py-0.5">
                      {COMMON_RESTRICTIONS.find(c => c.value === r)?.label ?? r}
                    </span>
                  ))}
                </div>
              )}
              {guest.dietary_notes && <p className="text-xs text-red-300/80">{guest.dietary_notes}</p>}
            </div>
          )}
          {guest.emergency_contact && (
            <div className="flex items-center gap-2 text-xs text-smoke-400">
              <Phone size={12} />
              <span>Emergency: {guest.emergency_contact}</span>
            </div>
          )}
          {guest.notes && (
            <p className="text-xs text-smoke-400">{guest.notes}</p>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
              <Pencil size={13} /> Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete} className="flex-1">
              <Trash2 size={13} /> Remove
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
