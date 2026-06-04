import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { FireBackground } from '../../components/FireBackground'
import { getMilestoneIcon } from '../../components/MilestoneBar'
import { cn } from '../../lib/utils'
import type { MilestonesResponse, Milestone } from '../../lib/types'

type PublicEvent = { id: string; name?: string; contribution_link?: string; contribution_match_ratio: number }

function TrackerIcon({ milestone, unlocked }: { milestone: Milestone; unlocked: boolean }) {
  const [imgError, setImgError] = useState(false)
  const icon = getMilestoneIcon(milestone)
  if (milestone.icon_image && !imgError) {
    return (
      <img
        src={milestone.icon_image}
        alt={milestone.name}
        className={cn('rounded-lg object-cover', unlocked ? 'w-10 h-10' : 'w-7 h-7')}
        onError={() => setImgError(true)}
      />
    )
  }
  return <span className="leading-none">{icon}</span>
}

export default function Tracker() {
  const [data, setData] = useState<MilestonesResponse | null>(null)
  const [event, setEvent] = useState<PublicEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [animatedPct, setAnimatedPct] = useState(0)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const evRes = await fetch('/api/public/event')
        if (!evRes.ok) { setError(true); return }
        const ev = await evRes.json() as PublicEvent
        setEvent(ev)
        const mRes = await fetch(`/api/public/milestones/${ev.id}`)
        if (mRes.ok) setData(await mRes.json() as MilestonesResponse)
        else setError(true)
      } catch { setError(true) } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!data) return
    const raf = requestAnimationFrame(() => {
      setTimeout(() => {
        const max = data.milestones.length > 0 ? Math.max(...data.milestones.map(m => m.amount)) : 1
        setAnimatedPct(Math.min((data.total_raised / max) * 100, 100))
      }, 100)
    })
    return () => cancelAnimationFrame(raf)
  }, [data])

  if (loading) {
    return (
      <div className="min-h-dvh min-h-screen relative flex items-center justify-center">
        <FireBackground />
        <Loader2 size={24} className="text-fire-400 animate-spin relative z-10" />
      </div>
    )
  }

  if (!data || data.milestones.length === 0) {
    return (
      <div className="min-h-dvh min-h-screen relative flex items-center justify-center">
        <FireBackground />
        <div className="relative z-10 text-center px-6">
          <p className="text-smoke-400 text-sm">{error ? 'Something went wrong. Please try again.' : 'No milestones set up yet.'}</p>
          <Link to="/" className="text-fire-400 text-sm hover:text-fire-300 transition-colors mt-4 block">← Back to event</Link>
        </div>
      </div>
    )
  }

  const sorted = [...data.milestones].sort((a, b) => a.amount - b.amount)
  const maxAmount = sorted[sorted.length - 1].amount
  const totalRaised = data.total_raised
  const allFunded = totalRaised >= maxAmount

  const minSpacingPct = 12
  const rawPositions = sorted.map(m => (m.amount / maxAmount) * 100)
  const isCrowded = rawPositions.some((p, i) => i > 0 && p - rawPositions[i - 1] < minSpacingPct)
  const useProportional = sorted.length <= 8 && !isCrowded
  const positions = useProportional
    ? rawPositions
    : sorted.map((_, i) => 4 + (i / (sorted.length - 1 || 1)) * 92)

  return (
    <div className="min-h-dvh min-h-screen relative animate-fade-in pb-28">
      <FireBackground />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-6">
          <span className="text-4xl">🔥</span>
          <h1 className="text-2xl font-bold text-smoke-100 mt-2">Milestone Tracker</h1>
          <div className="flex items-baseline justify-center gap-2 mt-2">
            <span className="text-xl font-bold text-gradient-fire">£{(totalRaised / 100).toFixed(0)} raised</span>
            <span className="text-sm text-smoke-400">of £{(maxAmount / 100).toFixed(0)}</span>
          </div>
          {allFunded && (
            <p className="text-sm font-semibold text-fire-400 mt-1 animate-pulse-glow">🎆 Fully funded! Thank you!</p>
          )}
        </div>

        {/* Description */}
        <div className="glass-card p-4 mb-4">
          <p className="text-sm text-smoke-300 leading-relaxed text-center">
            Bonfire Night runs on contributions from guests — it's what keeps the fire burning year after year.
            Every amount helps unlock something special. Nothing is ever expected, but every contribution makes a real difference.
          </p>
        </div>

        {/* Donation card */}
        {event?.contribution_link && (
          <div className="glass-card p-4 mb-10 text-center">
            <p className="text-sm font-semibold text-smoke-100 mb-1">Help cover the costs</p>
            {(event.contribution_match_ratio ?? 0) > 0 && (
              <p className="text-xs text-fire-400/80 mb-3 leading-relaxed">
                Contributions are match-funded at {Math.round(event.contribution_match_ratio * 100)}% — so if guests raise £100, we'll put in £{Math.round(100 * event.contribution_match_ratio)} too.
              </p>
            )}
            <a
              href={event.contribution_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-fire-500 hover:bg-fire-400 text-white text-sm font-semibold rounded-xl transition-colors tap-highlight-none glow-fire-sm"
            >
              Contribute 💛
            </a>
          </div>
        )}

        {/* Vertical tracker — bar centred, milestones alternating sides */}
        <div className="relative" style={{ minHeight: `${sorted.length * 130}px` }}>
          {/* Centred vertical bar */}
          <div
            className="absolute top-0 bottom-0 rounded-full bg-white/8"
            style={{ left: '50%', transform: 'translateX(-50%)', width: '4px' }}
          >
            <div
              className="absolute top-0 left-0 right-0 rounded-full transition-all duration-1000 ease-out"
              style={{ height: `${animatedPct}%`, background: 'linear-gradient(180deg, #e85f00, #fbbf24)' }}
            />
            {!allFunded && animatedPct > 0 && (
              <div
                className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full animate-pulse-glow transition-all duration-1000 ease-out"
                style={{ top: `calc(${animatedPct}% - 6px)`, background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)' }}
              />
            )}
          </div>

          {/* Milestone items */}
          {sorted.map((m, i) => {
            const topPct = positions[i]
            const unlocked = totalRaised >= m.amount
            const isLeft = i % 2 === 0

            return (
              <div key={m.id} className="absolute w-full" style={{ top: `${topPct}%` }}>
                {/* Icon square centred on bar, covers bar behind it */}
                <div
                  className={cn(
                    'absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-xl border transition-all duration-500 z-10',
                    unlocked
                      ? 'w-12 h-12 text-2xl border-fire-400/50'
                      : 'w-9 h-9 text-base border-smoke-600/40 opacity-60 grayscale'
                  )}
                  style={{
                    background: unlocked ? 'linear-gradient(135deg, #e85f00, #fbbf24)' : 'rgba(10, 5, 0, 0.92)',
                  }}
                >
                  <TrackerIcon milestone={m} unlocked={unlocked} />
                </div>

                {/* Card — left or right of centre */}
                <div
                  className={cn('absolute -translate-y-1/2', isLeft ? 'right-[calc(50%+36px)] text-right' : 'left-[calc(50%+36px)] text-left')}
                  style={{ width: 'calc(50% - 52px)' }}
                >
                  <div className={cn('glass-card p-3 transition-all duration-500', unlocked ? 'border-fire-400/20' : 'opacity-60')}>
                    <p className={cn('text-sm font-semibold leading-tight', unlocked ? 'text-smoke-100' : 'text-smoke-400')}>
                      {m.name}
                    </p>
                    <p className={cn('text-xs font-bold mt-0.5', unlocked ? 'text-fire-300' : 'text-smoke-500')}>
                      £{(m.amount / 100).toFixed(0)}
                    </p>
                    {m.description && (
                      <p className="text-xs text-smoke-500 mt-0.5 leading-relaxed">{m.description}</p>
                    )}
                    {unlocked && <p className="text-[10px] text-emerald-400 mt-1">✓ Unlocked</p>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Fixed floating back button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20" style={{ width: 'max-content' }}>
        <Link
          to="/"
          className="flex items-center gap-2 px-5 py-2.5 glass-card border-white/20 text-smoke-300 hover:text-smoke-100 text-sm font-medium transition-all tap-highlight-none shadow-xl"
          style={{ backdropFilter: 'blur(12px)' }}
        >
          ← Back to event
        </Link>
      </div>
    </div>
  )
}
