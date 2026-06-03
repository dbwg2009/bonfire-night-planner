import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Delete, Check } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { useEventStore } from '../store/event'
import { api } from '../lib/api'
import { FireBackground } from '../components/FireBackground'
import { cn } from '../lib/utils'
import { toast } from '../components/ui/toast'
import { Toaster } from '../components/ui/toast'
import type { Organiser, Event } from '../lib/types'

const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫']
const MAX_PIN = 6
const MIN_PIN = 4

export default function Login() {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const navigate = useNavigate()
  const login = useAuthStore(s => s.login)
  const setCurrentEvent = useEventStore(s => s.setCurrentEvent)
  const setEvents = useEventStore(s => s.setEvents)

  function press(key: string) {
    if (loading) return
    if (key === '⌫') {
      setPin(p => p.slice(0, -1))
    } else if (pin.length < MAX_PIN) {
      const next = pin + key
      setPin(next)
      // Auto-submit at max PIN length
      if (next.length === MAX_PIN) {
        doSubmit(next)
      }
    }
  }

  async function doSubmit(pinValue = pin) {
    if (pinValue.length < MIN_PIN) return
    setLoading(true)
    try {
      const res = await api.login(pinValue) as { token: string; organiser: Organiser }
      login(res.organiser, res.token)
      // Load the organiser's existing event so we go straight to the dashboard
      // instead of being forced onto the Create Event screen when one exists.
      try {
        const events = await api.getEvents() as Event[]
        setEvents(events)
        const chosen =
          events.find(e => e.id === res.organiser.event_id) ??
          [...events].filter(e => e.status !== 'archived').sort((a, b) => b.year - a.year)[0]
        if (chosen) setCurrentEvent(chosen)
      } catch { /* no events yet — the setup screen will handle creation */ }
      navigate('/admin')
    } catch {
      setShake(true)
      setPin('')
      toast('Incorrect PIN — try again', 'error')
      setTimeout(() => setShake(false), 600)
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = pin.length >= MIN_PIN && pin.length < MAX_PIN

  return (
    <div className="min-h-dvh min-h-screen flex flex-col items-center justify-center relative">
      <FireBackground />
      <Toaster />

      <div className="relative z-10 w-full max-w-xs px-6 text-center">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-3xl glass-warm flex items-center justify-center glow-fire">
            <BonfireIcon />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gradient-fire mb-1">Bonfire Night</h1>
        <p className="text-sm text-smoke-400 mb-8">Enter your organiser PIN</p>

        {/* PIN dots — always show MAX_PIN dots */}
        <div className={cn('flex justify-center gap-3 mb-8', shake && '[animation:shake_0.4s_ease]')}>
          {Array.from({ length: MAX_PIN }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-3.5 h-3.5 rounded-full border-2 transition-all duration-200',
                i < pin.length
                  ? 'bg-fire-400 border-fire-400 glow-fire-sm scale-110'
                  : 'border-smoke-600 bg-transparent'
              )}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3">
          {PAD.map((key, i) => {
            if (key === '') return <div key={i} />

            if (key === '⌫') {
              return (
                <button
                  key={i}
                  onClick={() => press(key)}
                  className="h-16 rounded-2xl glass flex items-center justify-center text-smoke-400 hover:text-smoke-200 active:scale-95 transition-all tap-highlight-none"
                  aria-label="Delete"
                >
                  <Delete size={22} />
                </button>
              )
            }

            return (
              <button
                key={i}
                onClick={() => press(key)}
                disabled={loading}
                className="h-16 rounded-2xl glass-card hover:bg-white/8 active:scale-95 active:bg-fire-400/10 transition-all tap-highlight-none text-xl font-semibold text-smoke-100"
              >
                {key}
              </button>
            )
          })}
        </div>

        {/* Manual confirm button — shown for 4 or 5 digit PINs before max length */}
        <div className="mt-4 h-12">
          {canSubmit && (
            <button
              onClick={() => doSubmit()}
              disabled={loading}
              className="w-full h-full rounded-2xl bg-fire-500 hover:bg-fire-400 text-white font-semibold flex items-center justify-center gap-2 transition-all tap-highlight-none glow-fire-sm animate-fade-in"
            >
              {loading ? (
                <span className="text-sm">Checking…</span>
              ) : (
                <>
                  <Check size={18} />
                  <span className="text-sm">Confirm PIN</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="mt-6">
          <a href="/" className="text-sm text-smoke-500 hover:text-smoke-300 transition-colors">
            ← Back to guest view
          </a>
        </div>
      </div>
    </div>
  )
}

function BonfireIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-flicker">
      <ellipse cx="24" cy="40" rx="14" ry="3" fill="#4a1e00" opacity="0.8"/>
      <rect x="10" y="36" width="28" height="5" rx="2.5" fill="#7a3000" opacity="0.9"/>
      <path d="M24 8 C20 14 16 20 18 28 C20 33 24 35 24 35 C24 35 28 33 30 28 C32 20 28 14 24 8Z" fill="#ffd966"/>
      <path d="M24 12 C21 17 17 22 19 30 C21 34 24 35 24 35 C24 35 27 34 29 30 C31 22 27 17 24 12Z" fill="#ff8c2a"/>
      <path d="M22 16 C18 22 16 27 18 32 C20 36 24 37 24 37 C24 37 28 36 30 32 C32 27 30 22 26 16 C25 20 23 22 22 16Z" fill="#e85f00" opacity="0.8"/>
      <path d="M21 6 C20 10 21 14 22 16 C21 12 20 8 21 6Z" fill="#ffeb66" opacity="0.7"/>
      <path d="M27 4 C27 8 26 12 26 16 C27 12 28 8 27 4Z" fill="#ffeb66" opacity="0.7"/>
      <ellipse cx="24" cy="35" rx="6" ry="2" fill="#ff6b00" opacity="0.4"/>
    </svg>
  )
}
