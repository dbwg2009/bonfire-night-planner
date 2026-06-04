import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Shield } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog'
import { Switch } from '../../components/ui/switch'
import { PageHeader, PageContent } from '../../components/Layout'
import { useEventStore } from '../../store/event'
import { useAuthStore } from '../../store/auth'
import { api } from '../../lib/api'
import { generateId } from '../../lib/utils'
import { toast } from '../../components/ui/toast'
import { cn } from '../../lib/utils'
import type { Organiser, OrgPermissions, Event } from '../../lib/types'

const DEFAULT_PERMS: OrgPermissions = { guest_management: false, finance: false, check_in: false, tasks_and_settings: false }

export default function Settings() {
  const event = useEventStore(s => s.currentEvent)
  const setCurrentEvent = useEventStore(s => s.setCurrentEvent)
  const organiser = useAuthStore(s => s.organiser)
  const qc = useQueryClient()

  const [eventForm, setEventForm] = useState({
    name: event?.name ?? '',
    date: event?.date ?? '',
    meeting_location: event?.meeting_location ?? '',
    event_location: event?.event_location ?? '',
    conflict_event_enabled: event?.conflict_event_enabled ?? false,
    conflict_event_name: event?.conflict_event_name ?? '',
    food_split_ratio: event?.food_split_ratio ?? 0.6,
    food_buffer_factor: event?.food_buffer_factor ?? 1.1,
    light_walk_by: event?.light_walk_by ?? '',
    light_fireworks_after: event?.light_fireworks_after ?? '',
    light_notes: event?.light_notes ?? '',
    lat: event?.lat ?? '',
    lon: event?.lon ?? '',
    contribution_link: event?.contribution_link ?? '',
    contribution_match_ratio: event?.contribution_match_ratio ?? 0
  })

  const [orgOpen, setOrgOpen] = useState(false)
  const [editingOrg, setEditingOrg] = useState<Organiser | null>(null)
  const [orgForm, setOrgForm] = useState({ name: '', pin: '', color: '#e85f00', is_owner: false, permissions: DEFAULT_PERMS })

  const { data: organisers = [] } = useQuery<Organiser[]>({
    queryKey: ['organisers', event?.id],
    queryFn: () => api.getOrganisers(event!.id) as Promise<Organiser[]>,
    enabled: !!event?.id
  })

  const saveEvent = useMutation({
    mutationFn: (data: typeof eventForm) => api.updateEvent(event!.id, data),
    onSuccess: (updated) => {
      setCurrentEvent(updated as Event)
      qc.invalidateQueries({ queryKey: ['events'] })
      toast('Event settings saved')
    },
    onError: () => toast('Failed to save', 'error')
  })

  const saveOrg = useMutation({
    mutationFn: async (data: typeof orgForm) => {
      if (editingOrg) return api.updateOrganiser(event!.id, editingOrg.id, data)
      return api.createOrganiser(event!.id, { ...data, id: generateId(), event_id: event!.id })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['organisers'] }); setOrgOpen(false); toast('Organiser saved') }
  })

  const removeOrg = useMutation({
    mutationFn: (id: string) => api.deleteOrganiser(event!.id, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['organisers'] }); toast('Organiser removed') }
  })

  const canEditSettings = organiser?.is_owner || organiser?.permissions.tasks_and_settings

  const PERM_LABELS: { key: keyof OrgPermissions; label: string; desc: string }[] = [
    { key: 'guest_management', label: 'Guest management', desc: 'Add, edit, delete guests and RSVPs' },
    { key: 'finance', label: 'Finance', desc: 'View and edit costs and contributions' },
    { key: 'check_in', label: 'Check-in & register', desc: 'Use the live check-in system' },
    { key: 'tasks_and_settings', label: 'Tasks & settings', desc: 'Manage tasks, schedule and event settings' }
  ]

  const COLORS = ['#e85f00', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1']

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" subtitle="Event & organiser management" />

      <PageContent>
        {/* Event settings */}
        <Card>
          <h2 className="text-sm font-semibold text-smoke-300 mb-3">Event Details</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Event name</label>
              <Input value={eventForm.name} onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))} placeholder="Bonfire Night 2026" />
            </div>
            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Date</label>
              <Input type="date" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Meeting location</label>
              <Input value={eventForm.meeting_location} onChange={e => setEventForm(f => ({ ...f, meeting_location: e.target.value }))} placeholder="21 Agincourt Square" />
            </div>
            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Event location (destination)</label>
              <Input value={eventForm.event_location} onChange={e => setEventForm(f => ({ ...f, event_location: e.target.value }))} placeholder="Newton Court Farm" />
            </div>
          </div>
        </Card>

        {/* Food settings */}
        <Card>
          <h2 className="text-sm font-semibold text-smoke-300 mb-3">Food Algorithm</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-smoke-400 mb-1 block">
                "Both" guest split ratio: <span className="text-fire-400">{Math.round(eventForm.food_split_ratio * 100)}%</span> per item
              </label>
              <input
                type="range" min="0.3" max="1" step="0.05"
                value={eventForm.food_split_ratio}
                onChange={e => setEventForm(f => ({ ...f, food_split_ratio: parseFloat(e.target.value) }))}
                className="w-full accent-fire-500"
              />
              <p className="text-[11px] text-smoke-500">What fraction of "both" guests actually eat each item</p>
            </div>
            <div>
              <label className="text-xs text-smoke-400 mb-1 block">
                Buffer factor: <span className="text-fire-400">{Math.round((eventForm.food_buffer_factor - 1) * 100)}%</span> extra
              </label>
              <input
                type="range" min="1" max="1.3" step="0.05"
                value={eventForm.food_buffer_factor}
                onChange={e => setEventForm(f => ({ ...f, food_buffer_factor: parseFloat(e.target.value) }))}
                className="w-full accent-fire-500"
              />
            </div>
          </div>
        </Card>

        {/* Conflict event toggle */}
        {/* Light levels */}
        <Card>
          <h2 className="text-sm font-semibold text-smoke-300 mb-1">Light Levels & Timing</h2>
          <p className="text-xs text-smoke-500 mb-3">Override the auto-calculated sun times for planning notes. Leave blank to use astronomical calculation.</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-smoke-400 mb-1 block">📍 Location latitude</label>
                <Input type="number" step="0.001" value={eventForm.lat} onChange={e => setEventForm(f => ({ ...f, lat: e.target.value }))} placeholder="51.822" />
              </div>
              <div>
                <label className="text-xs text-smoke-400 mb-1 block">📍 Longitude</label>
                <Input type="number" step="0.001" value={eventForm.lon} onChange={e => setEventForm(f => ({ ...f, lon: e.target.value }))} placeholder="-3.016" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-smoke-400 mb-1 block">🚶 Start walk by</label>
                <Input type="time" value={eventForm.light_walk_by} onChange={e => setEventForm(f => ({ ...f, light_walk_by: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-smoke-400 mb-1 block">🎆 Fireworks after</label>
                <Input type="time" value={eventForm.light_fireworks_after} onChange={e => setEventForm(f => ({ ...f, light_fireworks_after: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Notes</label>
              <Input value={eventForm.light_notes} onChange={e => setEventForm(f => ({ ...f, light_notes: e.target.value }))} placeholder="e.g. Sunset around 16:30 — arrive before dark" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-smoke-300">Conflicting Event</h2>
            <Switch
              checked={eventForm.conflict_event_enabled}
              onCheckedChange={v => setEventForm(f => ({ ...f, conflict_event_enabled: v }))}
            />
          </div>
          {eventForm.conflict_event_enabled && (
            <div className="space-y-2 animate-slide-up">
              <Input
                value={eventForm.conflict_event_name}
                onChange={e => setEventForm(f => ({ ...f, conflict_event_name: e.target.value }))}
                placeholder="Event name (e.g. Legally Blonde Rehearsal)"
              />
              <p className="text-[11px] text-smoke-500">When enabled, a dedicated page appears for planning guests who are also doing this event</p>
            </div>
          )}
        </Card>

        {/* Contributions */}
        <Card>
          <h2 className="text-sm font-semibold text-smoke-300 mb-1">Contributions</h2>
          <p className="text-xs text-smoke-500 mb-3">Add a payment link and guests will see a contribution prompt on the event page and after RSVPing.</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Payment link</label>
              <Input
                value={eventForm.contribution_link}
                onChange={e => setEventForm(f => ({ ...f, contribution_link: e.target.value }))}
                placeholder="https://monzo.me/yourname"
                type="url"
                inputMode="url"
              />
              <p className="text-[11px] text-smoke-500 mt-1">Any payment URL — Monzo.me, PayPal.me, etc. Leave blank to hide the contribution prompt.</p>
            </div>
            <div>
              <label className="text-xs text-smoke-400 mb-1 block">
                Match funding ratio: <span className="text-fire-400">{Math.round(eventForm.contribution_match_ratio * 100)}%</span>
                {eventForm.contribution_match_ratio === 0 && <span className="text-smoke-500"> (disabled)</span>}
              </label>
              <input
                type="range" min="0" max="1" step="0.05"
                value={eventForm.contribution_match_ratio}
                onChange={e => setEventForm(f => ({ ...f, contribution_match_ratio: parseFloat(e.target.value) }))}
                className="w-full accent-fire-500"
              />
              <p className="text-[11px] text-smoke-500">
                {eventForm.contribution_match_ratio > 0
                  ? `Guests will see: "Contributions are match-funded at ${Math.round(eventForm.contribution_match_ratio * 100)}% — so if guests raise £100, we'll put in £${Math.round(100 * eventForm.contribution_match_ratio)} too."`
                  : 'Set above 0% to show a match funding note to guests.'}
              </p>
            </div>
          </div>
        </Card>

        <Button
          onClick={() => saveEvent.mutate(eventForm)}
          disabled={saveEvent.isPending}
          className="w-full"
        >
          {saveEvent.isPending ? 'Saving…' : 'Save Event Settings'}
        </Button>

        {/* Organisers */}
        <div className="flex items-center justify-between pt-2">
          <h2 className="text-sm font-semibold text-smoke-300">Organisers</h2>
          {canEditSettings && (
            <Button size="sm" variant="outline" onClick={() => { setEditingOrg(null); setOrgForm({ name: '', pin: '', color: '#e85f00', is_owner: false, permissions: DEFAULT_PERMS }); setOrgOpen(true) }}>
              <Plus size={14} /> Add
            </Button>
          )}
        </div>

        {organisers.map(org => (
          <Card key={org.id} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: org.color }}>
              {org.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-smoke-100">{org.name}</p>
                {org.is_owner && <Shield size={12} className="text-fire-400" />}
              </div>
              <p className="text-[11px] text-smoke-500">
                {org.is_owner ? 'Owner — full access' : Object.entries(org.permissions).filter(([,v]) => v).map(([k]) => k.replace(/_/g, ' ')).join(', ') || 'No permissions'}
              </p>
            </div>
            {canEditSettings && !org.is_owner && (
              <div className="flex gap-1 shrink-0">
                <button onClick={() => { setEditingOrg(org); setOrgForm({ name: org.name, pin: '', color: org.color, is_owner: org.is_owner, permissions: org.permissions }); setOrgOpen(true) }} className="p-1.5 text-smoke-500 hover:text-smoke-200 tap-highlight-none"><Pencil size={13} /></button>
                <button onClick={() => { if (confirm(`Remove ${org.name}?`)) removeOrg.mutate(org.id) }} className="p-1.5 text-smoke-500 hover:text-red-400 tap-highlight-none"><Trash2 size={13} /></button>
              </div>
            )}
          </Card>
        ))}

      </PageContent>

      {/* Organiser dialog */}
      <Dialog open={orgOpen} onOpenChange={setOrgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOrg ? 'Edit Organiser' : 'Add Organiser'}</DialogTitle>
            <DialogDescription>Set a PIN and permissions for this organiser.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={orgForm.name} onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" />
            <div>
              <label className="text-xs text-smoke-400 mb-1 block">
                PIN {editingOrg && '(leave blank to keep current)'}
              </label>
              <Input
                type="password" inputMode="numeric" maxLength={6}
                value={orgForm.pin}
                onChange={e => setOrgForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
                placeholder="4-6 digit PIN"
              />
            </div>

            <div>
              <label className="text-xs text-smoke-400 mb-1 block">Colour</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setOrgForm(f => ({ ...f, color: c }))}
                    className={cn('w-7 h-7 rounded-full transition-all tap-highlight-none', orgForm.color === c && 'ring-2 ring-white/50 scale-110')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold text-smoke-400 uppercase tracking-wider">Permissions</p>
              {PERM_LABELS.map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm text-smoke-200">{label}</p>
                    <p className="text-[11px] text-smoke-500">{desc}</p>
                  </div>
                  <Switch
                    checked={orgForm.permissions[key]}
                    onCheckedChange={v => setOrgForm(f => ({ ...f, permissions: { ...f.permissions, [key]: v } }))}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOrgOpen(false)}>Cancel</Button>
            <Button onClick={() => saveOrg.mutate(orgForm)} disabled={!orgForm.name.trim() || saveOrg.isPending}>
              {saveOrg.isPending ? 'Saving…' : editingOrg ? 'Save' : 'Add Organiser'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
