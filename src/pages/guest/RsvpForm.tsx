import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { FireBackground } from '../../components/FireBackground'
import { Toaster } from '../../components/ui/toast'
import { toast } from '../../components/ui/toast'
import { useEventStore } from '../../store/event'
import { api } from '../../lib/api'

export default function RsvpForm() {
  const event = useEventStore(s => s.currentEvent)
  const [step, setStep] = useState<'form' | 'done'>('form')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    rsvp_status: 'accepted' as 'accepted' | 'declined',
    dietary: [] as ('burger' | 'sausage')[],
    pickup_time: '',
    emergency_contact: ''
  })

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
    return (
      <div className="min-h-dvh min-h-screen flex flex-col items-center justify-center relative">
        <FireBackground />
        <Toaster />
        <div className="relative z-10 text-center px-6 max-w-xs">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-emerald-400" />
          </div>
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
