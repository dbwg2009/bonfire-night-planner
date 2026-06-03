import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle, Users, MapPin } from 'lucide-react'
import { useState } from 'react'
import { Card } from '../../components/ui/card'
import { PageHeader, PageContent } from '../../components/Layout'
import { useEventStore } from '../../store/event'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'
import { toast } from '../../components/ui/toast'
import type { Guest, CheckIn } from '../../lib/types'

type Location = 'meeting' | 'destination'

export default function CheckInPage() {
  const event = useEventStore(s => s.currentEvent)
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<Location>('meeting')

  const { data: guests = [] } = useQuery<Guest[]>({
    queryKey: ['guests', event?.id],
    queryFn: () => api.getGuests(event!.id) as Promise<Guest[]>,
    enabled: !!event?.id
  })

  const { data: checkins = [] } = useQuery<CheckIn[]>({
    queryKey: ['checkins', event?.id],
    queryFn: () => api.getCheckins(event!.id) as Promise<CheckIn[]>,
    enabled: !!event?.id
  })

  const toggle = useMutation({
    mutationFn: ({ guestId, location }: { guestId: string; location: string }) =>
      api.toggleCheckin(event!.id, guestId, location),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkins'] }),
    onError: () => toast('Check-in failed', 'error')
  })

  const accepted = guests.filter(g => g.rsvp_status === 'accepted')

  function isCheckedIn(guestId: string, loc: Location) {
    return checkins.some(c => c.guest_id === guestId && c.location === loc && c.checked_in)
  }

  function getCheckinTime(guestId: string, loc: Location) {
    return checkins.find(c => c.guest_id === guestId && c.location === loc && c.checked_in)?.checked_in_at
  }

  const meetingChecked = accepted.filter(g => isCheckedIn(g.id, 'meeting')).length
  const destChecked = accepted.filter(g => isCheckedIn(g.id, 'destination')).length

  const locationLabel = activeTab === 'meeting'
    ? (event?.meeting_location || 'Meeting point')
    : (event?.event_location || 'Destination')

  const currentChecked = activeTab === 'meeting' ? meetingChecked : destChecked
  const allAccountedFor = currentChecked === accepted.length

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Check-In Register"
        subtitle={`${accepted.length} expected tonight`}
      />

      <PageContent>
        {/* Tab selector */}
        <div className="grid grid-cols-2 gap-2">
          {(['meeting', 'destination'] as const).map(loc => {
            const count = loc === 'meeting' ? meetingChecked : destChecked
            const label = loc === 'meeting'
              ? (event?.meeting_location || 'Meeting Point')
              : (event?.event_location || 'Destination')
            return (
              <button
                key={loc}
                onClick={() => setActiveTab(loc)}
                className={cn(
                  'glass-card p-3 text-left transition-all tap-highlight-none',
                  activeTab === loc && 'border-fire-400/30 bg-fire-400/8 glow-fire-sm'
                )}
              >
                <MapPin size={14} className={activeTab === loc ? 'text-fire-400' : 'text-smoke-500'} />
                <p className={cn('text-xs font-medium mt-1 truncate', activeTab === loc ? 'text-fire-300' : 'text-smoke-300')}>
                  {label}
                </p>
                <p className={cn('text-lg font-bold mt-0.5', activeTab === loc ? 'text-fire-400' : 'text-smoke-400')}>
                  {count}/{accepted.length}
                </p>
              </button>
            )
          })}
        </div>

        {/* Status bar */}
        <Card className={cn('py-3', allAccountedFor && 'border-emerald-400/30 bg-emerald-500/5')}>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white/5 rounded-full h-2.5 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  allAccountedFor ? 'bg-emerald-500' : 'bg-gradient-to-r from-fire-500 to-fire-400'
                )}
                style={{ width: `${accepted.length > 0 ? (currentChecked / accepted.length) * 100 : 0}%` }}
              />
            </div>
            <div className="text-right shrink-0">
              <p className={cn('text-lg font-bold', allAccountedFor ? 'text-emerald-400' : 'text-fire-400')}>
                {currentChecked}/{accepted.length}
              </p>
              <p className="text-[10px] text-smoke-500">at {locationLabel}</p>
            </div>
          </div>
          {allAccountedFor && (
            <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1.5">
              <CheckCircle2 size={12} /> Everyone accounted for at this location!
            </p>
          )}
        </Card>

        {/* Guest list */}
        <div className="space-y-2">
          {accepted.map(g => {
            const checked = isCheckedIn(g.id, activeTab)
            const time = getCheckinTime(g.id, activeTab)
            return (
              <button
                key={g.id}
                onClick={() => toggle.mutate({ guestId: g.id, location: activeTab })}
                className={cn(
                  'w-full glass-card p-4 flex items-center gap-3 text-left transition-all tap-highlight-none active:scale-[0.98]',
                  checked && 'border-emerald-400/25 bg-emerald-500/5'
                )}
              >
                {checked
                  ? <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
                  : <Circle size={22} className="text-smoke-600 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium truncate', checked ? 'text-smoke-300' : 'text-smoke-100')}>
                    {g.name}
                  </p>
                  {checked && time && (
                    <p className="text-[11px] text-emerald-500/70">
                      Checked in {new Date(time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                {g.dietary.length > 0 && (
                  <span className="text-sm shrink-0">{g.dietary.map(d => d === 'burger' ? '🍔' : '🌭').join('')}</span>
                )}
              </button>
            )
          })}
        </div>

        {accepted.length === 0 && (
          <Card className="text-center py-8 text-smoke-500">
            <Users size={24} className="mx-auto mb-2 opacity-40" />
            No accepted guests yet
          </Card>
        )}
      </PageContent>
    </div>
  )
}
