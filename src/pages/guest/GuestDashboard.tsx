import { useQuery } from '@tanstack/react-query'
import { Calendar, MapPin, Clock, AlertCircle } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Countdown } from '../../components/Countdown'
import { WeatherWidget } from '../../components/WeatherWidget'
import { PageContent } from '../../components/Layout'
import { useEventStore } from '../../store/event'
import { api } from '../../lib/api'
import { formatDate, formatTime, getBonfireDate } from '../../lib/utils'
import type { Guest } from '../../lib/types'

export default function GuestDashboard() {
  const event = useEventStore(s => s.currentEvent)
  const year = event?.year ?? new Date().getFullYear()
  const bonfireDate = event ? new Date(event.date) : getBonfireDate(year)

  // Guest lookup by URL param (e.g. ?guest=id)
  const guestId = new URLSearchParams(window.location.search).get('guest')

  const { data: guests = [] } = useQuery<Guest[]>({
    queryKey: ['guests', event?.id, 'public'],
    queryFn: () => api.getGuests(event!.id) as Promise<Guest[]>,
    enabled: !!event?.id && !!guestId
  })

  const myGuest = guests.find(g => g.id === guestId)

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-8 pb-4 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl glass-warm mb-3">
          <span className="text-3xl">🔥</span>
        </div>
        <h1 className="text-2xl font-bold text-smoke-100">{event?.name ?? `Bonfire Night ${year}`}</h1>
        {event?.date && (
          <p className="text-sm text-smoke-400 mt-1">{formatDate(event.date, 'EEEE d MMMM yyyy')}</p>
        )}
      </div>

      <PageContent>
        {/* Countdown */}
        <Countdown targetDate={bonfireDate} />

        {/* Personal RSVP status */}
        {myGuest && (
          <Card className={
            myGuest.rsvp_status === 'accepted'
              ? 'border-emerald-400/25 bg-emerald-500/5'
              : myGuest.rsvp_status === 'declined'
              ? 'border-red-400/25 bg-red-500/5'
              : ''
          }>
            <h2 className="text-sm font-semibold text-smoke-300 mb-1">Your RSVP</h2>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium px-2 py-0.5 rounded-full border ${
                myGuest.rsvp_status === 'accepted' ? 'text-emerald-400 border-emerald-400/25 bg-emerald-500/10'
                : myGuest.rsvp_status === 'declined' ? 'text-red-400 border-red-400/25 bg-red-500/10'
                : 'text-amber-400 border-amber-400/25 bg-amber-500/10'
              }`}>
                {myGuest.rsvp_status.charAt(0).toUpperCase() + myGuest.rsvp_status.slice(1)}
              </span>
              <span className="text-sm text-smoke-400">{myGuest.name}</span>
            </div>
          </Card>
        )}

        {/* Pick-up time */}
        {myGuest?.pickup_time && myGuest.rsvp_status === 'accepted' && (
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-fire-400" />
              <h2 className="text-sm font-semibold text-smoke-300">Your end-of-night pick-up</h2>
            </div>
            <p className="text-2xl font-bold text-gradient-fire">{formatTime(myGuest.pickup_time)}</p>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-400/80">
              <AlertCircle size={11} />
              <span>This is a preference — subject to change. Check with your organiser.</span>
            </div>
          </Card>
        )}

        {/* Event info */}
        {event && (
          <Card>
            <h2 className="text-sm font-semibold text-smoke-300 mb-3">Event Info</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Calendar size={16} className="text-fire-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-smoke-100">Date</p>
                  <p className="text-sm text-smoke-400">{formatDate(event.date, 'EEEE d MMMM yyyy')}</p>
                </div>
              </div>
              {event.meeting_location && (
                <div className="flex items-start gap-3">
                  <MapPin size={16} className="text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-smoke-100">Meet at</p>
                    <p className="text-sm text-smoke-400">{event.meeting_location}</p>
                  </div>
                </div>
              )}
              {event.event_location && (
                <div className="flex items-start gap-3">
                  <span className="text-base mt-0 shrink-0">🔥</span>
                  <div>
                    <p className="text-sm font-medium text-smoke-100">Event at</p>
                    <p className="text-sm text-smoke-400">{event.event_location}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Weather */}
        <WeatherWidget eventDate={bonfireDate} compact />

        {/* RSVP prompt */}
        {!myGuest && (
          <Card className="text-center py-4 glass-warm">
            <p className="text-sm text-smoke-300">Haven't RSVP'd yet?</p>
            <a href="/rsvp" className="text-fire-400 text-sm font-medium mt-1 block hover:text-fire-300 transition-colors">
              Submit your RSVP →
            </a>
          </Card>
        )}
      </PageContent>
    </div>
  )
}
