import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { FireBackground } from '../../components/FireBackground'
import { getMilestoneIcon } from '../../components/MilestoneBar'
import { cn } from '../../lib/utils'
import type { MilestonesResponse } from '../../lib/types'

export default function Tracker() {
  const [data, setData] = useState<MilestonesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [animatedPct, setAnimatedPct] = useState(0)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const evRes = await fetch('/api/public/event')
        if (!evRes.ok) { setError(true); return }
        const ev = await evRes.json() as { id: string; name?: string }
        const mRes = await fetch(`/api/public/milestones/${ev.id}`)
        if (mRes.ok) setData(await mRes.json() as MilestonesResponse)
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
        const max = data.milestones.length > 0 ? data.milestones[data.milestones.length - 1].amount : 1
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

  // Decide spacing: proportional if milestones spread naturally, evenly if too crowded
  const useProportional = sorted.length <= 8
  const minSpacingPct = 10 // minimum % gap between milestones

  const rawPositions = sorted.map(m => (m.amount / maxAmount) * 100)
  // Check if proportional positions are too crowded
  const isCrowded = rawPositions.some((p, i) => i > 0 && p - rawPositions[i - 1] < minSpacingPct)
  const positions = useProportional && !isCrowded
    ? rawPositions
    : sorted.map((_, i) => 5 + (i / (sorted.length - 1 || 1)) * 90)

  return (
    <div className="min-h-dvh min-h-screen relative animate-fade-in">
      <FireBackground />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-4xl">🔥</span>
          <h1 className="text-2xl font-bold text-smoke-100 mt-2">Milestone Tracker</h1>
          <div className="flex items-baseline justify-center gap-2 mt-2">
            <span className="text-xl font-bold text-gradient-fire">
              £{(totalRaised / 100).toFixed(0)} raised
            </span>
            <span className="text-sm text-smoke-400">of £{(maxAmount / 100).toFixed(0)}</span>
          </div>
          {allFunded && (
            <p className="text-sm font-semibold text-fire-400 mt-1 animate-pulse-glow">
              🎆 Fully funded! Thank you!
            </p>
          )}
        </div>

        {/* Vertical tracker */}
        <div className="relative ml-8">
          {/* Vertical line — fills proportionally */}
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-full bg-white/8" style={{ marginLeft: '1.25rem' }}>
            <div
              className="absolute top-0 left-0 right-0 rounded-full transition-all duration-1000 ease-out"
              style={{
                height: `${animatedPct}%`,
                background: 'linear-gradient(180deg, #e85f00, #fbbf24)',
              }}
            />
            {/* Pulsing leading edge on the vertical bar */}
            {!allFunded && animatedPct > 0 && (
              <div
                className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full animate-pulse-glow transition-all duration-1000 ease-out"
                style={{
                  top: `calc(${animatedPct}% - 6px)`,
                  background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)',
                }}
              />
            )}
          </div>

          {/* Milestones */}
          <div className="relative" style={{ minHeight: `${sorted.length * 120}px` }}>
            {sorted.map((m, i) => {
              const topPct = positions[i]
              const unlocked = totalRaised >= m.amount
              const isLeft = i % 2 === 0
              const icon = getMilestoneIcon(m)
              const hasImage = !!m.icon_image

              return (
                <div
                  key={m.id}
                  className="absolute w-full"
                  style={{ top: `${topPct}%` }}
                >
                  {/* Node on the line */}
                  <div
                    className={cn(
                      'absolute rounded-full border-2 flex items-center justify-center transition-all duration-500',
                      unlocked
                        ? 'w-10 h-10 border-fire-400 glow-fire-sm bg-coal-900'
                        : 'w-7 h-7 border-smoke-600 bg-coal-900 opacity-60 grayscale',
                    )}
                    style={{ left: '0.5rem', transform: 'translate(-50%, -50%)' }}
                  >
                    {hasImage ? (
                      <img src={m.icon_image} alt={m.name} className={cn('rounded-full object-cover', unlocked ? 'w-8 h-8' : 'w-5 h-5')} />
                    ) : (
                      <span className={unlocked ? 'text-lg' : 'text-sm'}>{icon}</span>
                    )}
                  </div>

                  {/* Horizontal branch line */}
                  <div
                    className={cn(
                      'absolute h-px transition-all duration-500',
                      unlocked ? 'bg-fire-400/50' : 'bg-smoke-700/50'
                    )}
                    style={isLeft
                      ? { left: '2.5rem', width: '1.5rem', top: 0, transform: 'translateY(-50%)' }
                      : { left: '2.5rem', width: '1.5rem', top: 0, transform: 'translateY(-50%)' }
                    }
                  />

                  {/* Milestone card */}
                  <div
                    className={cn(
                      'ml-20 glass-card p-3 transition-all duration-500',
                      unlocked ? 'border-fire-400/20' : 'opacity-60'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm font-semibold leading-tight',
                          unlocked ? 'text-smoke-100' : 'text-smoke-400'
                        )}>
                          {m.name}
                        </p>
                        {m.description && (
                          <p className="text-xs text-smoke-500 mt-0.5 leading-relaxed">{m.description}</p>
                        )}
                      </div>
                      <span className={cn(
                        'text-xs font-bold px-2 py-0.5 rounded-full border shrink-0',
                        unlocked
                          ? 'text-fire-300 border-fire-400/30 bg-fire-500/10'
                          : 'text-smoke-500 border-smoke-700 bg-smoke-800/50'
                      )}>
                        £{(m.amount / 100).toFixed(0)}
                      </span>
                    </div>
                    {unlocked && (
                      <p className="text-[10px] text-emerald-400 mt-1">✓ Unlocked</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-smoke-500 hover:text-smoke-300 transition-colors">
            ← Back to event
          </Link>
        </div>
      </div>
    </div>
  )
}
