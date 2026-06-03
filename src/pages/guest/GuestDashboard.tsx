import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, MapPin, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Countdown } from '../../components/Countdown'
import { WeatherWidget } from '../../components/WeatherWidget'
import { FireBackground } from '../../components/FireBackground'
import { MilestoneBar } from '../../components/MilestoneBar'
import { Toaster } from '../../components/ui/toast'
import { formatDate, formatTime, getBonfireDate } from '../../lib/utils'
import type { Event, Guest, MilestonesResponse } from '../../lib/types'

type PublicGuest = Pick<Guest, 'id' | 'name' | 'rsvp_status' | 'dietary' | 'pickup_time'>

export default function GuestDashboard() {
  const [event, setEvent] = useState<Event | null>(null)
  const [myGuest, setMyGuest] = useState<PublicGuest | null>(null)
  const [milestones, setMilestones] = useState<MilestonesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  // Guest ID from URL param — share links like /?guest=GUEST_ID
  const guestId = new URLSearchParams(window.location.search).get('guest')

  useEffect(() => {
    async function load() {
      let loadedEventId: string | null = null
      try {
        const eventRes = await fetch('/api/public/event')
        if (eventRes.ok) {
          const data = await eventRes.json() as Event
          setEvent(data)
          loadedEventId = data.id
        }
      } catch { /* offline or no event yet */ }

      if (guestId) {
        try {
          const guestRes = await fetch(`/api/public/guest/${guestId}`)
          if (guestRes.ok) setMyGuest(await guestRes.json() as PublicGuest)
        } catch { /* guest not found */ }
      }

      if (loadedEventId) {
        try {
          const mRes = await fetch(`/api/public/milestones/${loadedEventId}`)
          if (mRes.ok) setMilestones(await mRes.json() as MilestonesResponse)
        } catch { /* no milestones */ }
      }

      setLoading(false)
    }
    load()
  }, [guestId])

  const year = event?.year ?? new Date().getFullYear()
  const bonfireDate = event ? new Date(event.date) : getBonfireDate(year)

  if (loading) {
    return (
      <div className="min-h-dvh min-h-screen relative flex items-center justify-center">
        <FireBackground />
        <Toaster />
        <Loader2 size={24} className="text-fire-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh min-h-screen relative animate-fade-in">
      <FireBackground />
      <Toaster />

      <div className="relative z-10 max-w-md mx-auto">
        {/* Header */}
        <div className="px-4 pt-10 pb-4 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl glass-warm mb-3 glow-fire">
            <span className="text-3xl animate-flicker">🔥</span>
          </div>
          <h1 className="text-2xl font-bold text-smoke-100">{event?.name ?? `Bonfire Night ${year}`}</h1>
          {event?.date && (
            <p className="text-sm text-smoke-400 mt-1">{formatDate(event.date, 'EEEE d MMMM yyyy')}</p>
          )}
        </div>

        <div className="px-4 pb-8 space-y-3">
          {/* Countdown */}
          <Countdown targetDate={bonfireDate} />

          {/* Personal RSVP status */}
          {myGuest && (
            <Card className={
              myGuest.rsvp_status === 'accepted' ? 'border-emerald-400/25 bg-emerald-500/5'
              : myGuest.rsvp_status === 'declined' ? 'border-red-400/25 bg-red-500/5' : ''
            }>
              <h2 className="text-sm font-semibold text-smoke-300 mb-2">Your RSVP — {myGuest.name}</h2>
              <span className={`text-sm font-medium px-2.5 py-1 rounded-full border inline-block ${
                myGuest.rsvp_status === 'accepted' ? 'text-emerald-400 border-emerald-400/25 bg-emerald-500/10'
                : myGuest.rsvp_status === 'declined' ? 'text-red-400 border-red-400/25 bg-red-500/10'
                : 'text-amber-400 border-amber-400/25 bg-amber-500/10'
              }`}>
                {myGuest.rsvp_status === 'accepted' ? '✅ Coming!' : myGuest.rsvp_status === 'declined' ? "❌ Can't make it" : '⏳ Pending'}
              </span>
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
              <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-400/80">
                <AlertCircle size={11} />
                <span>Preference only — subject to change. Check with your organiser.</span>
              </div>
            </Card>
          )}

          {/* Event info */}
          {event && (
            <Card>
              <h2 className="text-sm font-semibold text-smoke-300 mb-3">Event Info</h2>
              <div className="space-y-3">
                <InfoRow icon={<Calendar size={16} className="text-fire-400" />} label="Date" value={formatDate(event.date, 'EEEE d MMMM yyyy')} />
                {event.meeting_location && (
                  <InfoRow icon={<MapPin size={16} className="text-amber-400" />} label="Meet at" value={event.meeting_location} />
                )}
                {event.event_location && (
                  <InfoRow icon={<span className="text-base leading-none">🔥</span>} label="Event at" value={event.event_location} />
                )}
              </div>
            </Card>
          )}

          {/* Weather */}
          <WeatherWidget eventDate={bonfireDate} compact />

          {/* Milestone bar */}
          {milestones && milestones.milestones.length > 0 && (
            <Card>
              <MilestoneBar
                milestones={milestones.milestones}
                totalRaisedPence={milestones.total_raised}
                compact
              />
            </Card>
          )}

          {/* View full tracker card */}
          {milestones && milestones.milestones.length > 0 && (
            <Card
              className="flex items-center justify-between cursor-pointer hover:border-fire-400/30 transition-colors tap-highlight-none"
              onClick={() => navigate('/tracker')}
            >
              <div>
                <p className="text-sm font-semibold text-smoke-100">Milestone Tracker</p>
                <p className="text-xs text-smoke-400">See every reward and how close we are</p>
              </div>
              <span className="text-fire-400 text-sm">→</span>
            </Card>
          )}

          {/* Contribution */}
          {event?.contribution_link && (
            <ContributionCard link={event.contribution_link} matchRatio={event.contribution_match_ratio} />
          )}

          {/* RSVP CTA */}
          {!myGuest && (
            <Card className="text-center py-5 glass-warm">
              <p className="text-sm text-smoke-300 mb-2">Haven't RSVP'd yet?</p>
              <a
                href="/rsvp"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-fire-500 hover:bg-fire-400 text-white text-sm font-medium rounded-xl transition-colors tap-highlight-none glow-fire-sm"
              >
                Submit your RSVP 🔥
              </a>
            </Card>
          )}

          {/* Admin link */}
          <div className="text-center pt-2">
            <a href="/login" className="text-xs text-smoke-600 hover:text-smoke-400 transition-colors">
              Organiser login
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContributionCard({ link, matchRatio }: { link: string; matchRatio: number }) {
  return (
    <Card className="glass-warm text-center py-5">
      <p className="text-lg mb-1">🔥</p>
      <h2 className="text-sm font-semibold text-smoke-100 mb-2">Help cover the costs</h2>
      <p className="text-xs text-smoke-400 mb-4 leading-relaxed">
        Bonfire Night runs on contributions from guests — it's what keeps the fire burning year after year.
        Any amount helps and nothing is ever expected.
      </p>
      {matchRatio > 0 && (
        <p className="text-xs text-fire-400/80 mb-4 leading-relaxed">
          Contributions are match-funded at {Math.round(matchRatio * 100)}% — so if guests raise £100, we'll put in £{Math.round(100 * matchRatio)} too.
        </p>
      )}
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-fire-500 hover:bg-fire-400 text-white text-sm font-medium rounded-xl transition-colors tap-highlight-none glow-fire-sm"
      >
        Help cover the costs 💛
      </a>
    </Card>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-smoke-500 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-smoke-100">{value}</p>
      </div>
    </div>
  )
}
