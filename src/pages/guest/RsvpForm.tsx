import { useState, useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { FireBackground } from '../../components/FireBackground'
import { MilestoneBar } from '../../components/MilestoneBar'
import { Toaster } from '../../components/ui/toast'
import { toast } from '../../components/ui/toast'
import { useEventStore } from '../../store/event'
import { api } from '../../lib/api'
import type { MilestonesResponse } from '../../lib/types'

const CONTRIBUTION_COPY = [
  (name: string) => ({
    heading: "You're on the list! 🎉",
    body: `Thanks ${name}! Bonfire Night is put on for everyone and funded by contributions from guests — there's no set amount and nothing is expected. But if you'd like to chip in towards the fire, food, and fireworks, it's always massively appreciated.`
  }),
  (name: string) => ({
    heading: "You're coming — brilliant! 🔥",
    body: `Thanks ${name}! Every year Bonfire Night is self-funded by the people who come. No pressure at all, but if you'd like to help cover the costs (fire, food, the works), anything you contribute goes straight towards making the night happen.`
  }),
  (name: string) => ({
    heading: "See you on the night! 🪵",
    body: `Thanks ${name}! Bonfire Night runs on contributions from guests — it's what keeps the fire burning year after year. Any amount helps and nothing is ever expected, but if you'd like to chip in it's hugely appreciated.`
  }),
  (name: string) => ({
    heading: "You're in! 🎉",
    body: `Thanks ${name}! This night is put on for everyone and funded by the people who come along. There's no set amount and absolutely no pressure — but if you'd like to help cover the fire, food, and fireworks, every contribution makes a real difference.`
  }),
]

const COMMON_RESTRICTIONS = [
  { label: '🥜 Nut allergy', value: 'nut_allergy' },
  { label: '🥛 Dairy-free', value: 'dairy_free' },
  { label: '🌾 Gluten-free', value: 'gluten_free' },
  { label: '🐷 No pork / Halal', value: 'no_pork' },
  { label: '🥬 Vegetarian', value: 'vegetarian' },
  { label: '🌱 Vegan', value: 'vegan' },
]

export default function RsvpForm() {
  const storeEvent = useEventStore(s => s.currentEvent)
  const [publicEvent, setPublicEvent] = useState<{ id: string; name?: string; contribution_link?: string; contribution_match_ratio: number } | null>(null)
  const [step, setStep] = useState<'form' | 'done'>('form')
  const [loading, setLoading] = useState(false)
  const [copyVariant] = useState(() => Math.floor(Math.random() * CONTRIBUTION_COPY.length))
  const [milestones, setMilestones] = useState<MilestonesResponse | null>(null)

  useEffect(() => {
    fetch('/api/public/event')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        setPublicEvent(d)
        return fetch(`/api/public/milestones/${d.id}`)
          .then(r => r.ok ? r.json() : null)
          .then(m => m && setMilestones(m))
      })
      .catch(() => {})
  }, [])

  const event = publicEvent ?? storeEvent
  const [form, setForm] = useState({
    name: '',
    rsvp_status: 'accepted' as 'accepted' | 'declined',
    dietary: [] as ('burger' | 'sausage')[],
    dietary_restrictions: [] as string[],
    dietary_notes: '',
    pickup_time: '',
    emergency_contact: ''
  })

  const toggleRestriction = (value: string) => {
    setForm(f => ({
      ...f,
      dietary_restrictions: f.dietary_restrictions.includes(value)
        ? f.dietary_restrictions.filter(r => r !== value)
        : [...f.dietary_restrictions, value]
    }))
  }

  const toggle = (item: 'burger' | 'sausage') => {
    setForm(f => ({
      ...f,
      dietary: f.dietary.includes(item) ? f.dietary.filter(d => d !== item) : [...f.dietary, item]
    }))
  }

  async function submit() {
    if (!form.name.trim()) { toast('Please enter your name', 'error'); return }
    if (!event?.id) { toast('Event not found', 'error'); return }
    setLoading(true)
    try {
      await api.submitRsvp(event.id, form)
      setStep('done')
    } catch {
      toast('Failed to submit — please try again', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'done') {
    const showContribution = form.rsvp_status === 'accepted' && !!event?.contribution_link
    const copy = showContribution
      ? CONTRIBUTION_COPY[copyVariant](form.name)
      : null

    return (
      <div className="min-h-dvh min-h-screen flex flex-col items-center justify-center relative">
        <FireBackground />
        <Toaster />
        <div className="relative z-10 text-center px-6 max-w-sm w-full">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-emerald-400" />
          </div>

          {showContribution && copy ? (
            <>
              <h1 className="text-2xl font-bold text-smoke-100 mb-3">{copy.heading}</h1>
              <p className="text-smoke-400 text-sm mb-6 leading-relaxed">{copy.body}</p>

              {event.contribution_match_ratio > 0 && (
                <p className="text-xs text-fire-400/80 mb-5 leading-relaxed">
                  Contributions are match-funded at {Math.round(event.contribution_match_ratio * 100)}% — so if guests raise £100, we'll put in £{Math.round(100 * event.contribution_match_ratio)} too.
                </p>
              )}

              <a
                href={event.contribution_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-fire-500 hover:bg-fire-400 text-white text-sm font-semibold rounded-2xl transition-colors tap-highlight-none glow-fire-sm mb-4"
              >
                Help cover the costs 💛
              </a>

              {/* Milestone bar on contribution screen */}
              {milestones && milestones.milestones.length > 0 && (
                <div className="mt-6 mb-4 text-left">
                  <MilestoneBar
                    milestones={milestones.milestones}
                    totalRaisedPence={milestones.total_raised}
                    compact
                    showViewAll
                    onViewAll={() => window.location.href = '/tracker'}
                  />
                </div>
              )}

              <a href="/" className="text-smoke-500 text-sm hover:text-smoke-300 transition-colors">
                No thanks — back to event info
              </a>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-smoke-100 mb-2">
                {form.rsvp_status === 'accepted' ? "See you there! 🔥" : "No worries!"}
              </h1>
              <p className="text-smoke-400 text-sm mb-6">
                {form.rsvp_status === 'accepted'
                  ? `Thanks ${form.name}! Your RSVP has been recorded. We'll be in touch with more details.`
                  : `Thanks for letting us know, ${form.name}. Hope to see you another time!`
                }
              </p>
              <a href="/" className="text-fire-400 text-sm hover:text-fire-300 transition-colors">
                ← Back to event info
              </a>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh min-h-screen relative">
      <FireBackground />
      <Toaster />

      <div className="relative z-10 max-w-md mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <span className="text-4xl">🔥</span>
          <h1 className="text-2xl font-bold text-smoke-100 mt-2">{event?.name ?? 'Bonfire Night'}</h1>
          <p className="text-sm text-smoke-400 mt-1">Submit your RSVP</p>
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold text-smoke-300 mb-3">Your details</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-smoke-400 mb-1 block">Your name *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
              </div>
              <div>
                <label className="text-xs text-smoke-400 mb-1 block">Emergency contact number</label>
                <Input value={form.emergency_contact} onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))} placeholder="+44 7700 000000" type="tel" />
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-smoke-300 mb-3">Are you coming?</h2>
            <div className="grid grid-cols-2 gap-2">
              {(['accepted', 'declined'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setForm(f => ({ ...f, rsvp_status: s }))}
                  className={`py-3 rounded-xl text-sm font-medium border tap-highlight-none transition-all ${
                    form.rsvp_status === s
                      ? s === 'accepted' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-400/30' : 'bg-red-500/15 text-red-400 border-red-400/30'
                      : 'glass border-white/10 text-smoke-400'
                  }`}
                >
                  {s === 'accepted' ? '✅ Yes, coming!' : "❌ Can't make it"}
                </button>
              ))}
            </div>
          </Card>

          {form.rsvp_status === 'accepted' && (
            <>
              <Card className="animate-slide-up">
                <h2 className="text-sm font-semibold text-smoke-300 mb-3">Food preferences</h2>
                <div className="flex gap-2">
                  {(['burger', 'sausage'] as const).map(item => (
                    <button
                      key={item}
                      onClick={() => toggle(item)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border tap-highlight-none transition-all ${
                        form.dietary.includes(item)
                          ? 'bg-fire-400/15 text-fire-300 border-fire-400/30'
                          : 'glass border-white/10 text-smoke-400'
                      }`}
                    >
                      {item === 'burger' ? '🍔 Burger' : '🌭 Sausage'}
                    </button>
                  ))}
                </div>
                {form.dietary.length === 0 && (
                  <p className="text-xs text-smoke-500 mt-2 text-center">Select none if you don't want food</p>
                )}
              </Card>

              <Card className="animate-slide-up">
                <h2 className="text-sm font-semibold text-smoke-300 mb-2">Any dietary restrictions or allergies?</h2>
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
                  placeholder="Anything else we should know? (e.g. severe nut allergy)"
                />
              </Card>

              <Card className="animate-slide-up">
                <h2 className="text-sm font-semibold text-smoke-300 mb-1">Pick-up preference</h2>
                <p className="text-xs text-amber-400/80 mb-3 flex items-center gap-1">
                  ⚠️ This is a preference only — subject to change. We'll confirm pick-up times nearer the date.
                </p>
                <label className="text-xs text-smoke-400 mb-1 block">Preferred pick-up time (end of night)</label>
                <Input
                  type="time"
                  value={form.pickup_time}
                  onChange={e => setForm(f => ({ ...f, pickup_time: e.target.value }))}
                />
              </Card>
            </>
          )}

          <Button
            onClick={submit}
            disabled={loading || !form.name.trim()}
            className="w-full"
            size="lg"
          >
            {loading ? 'Submitting…' : 'Submit RSVP'}
          </Button>

          <p className="text-center text-xs text-smoke-500">
            Your emergency contact is only visible to organisers.
          </p>
        </div>
      </div>
    </div>
  )
}
