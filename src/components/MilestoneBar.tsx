import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/utils'
import type { Milestone } from '../lib/types'

const PRESET_ICONS: Record<string, string> = {
  bonfire: '🔥', fireworks: '🎆', sparklers: '🎇', sausages: '🌭',
  burgers: '🍔', drinks: '🍺', music: '🎵', logs: '🪵',
  hotchoc: '☕', treats: '🍫', stars: '⭐', explosion: '💥',
  party: '🎉', moon: '🌙', marshmallow: '🍡', lantern: '🏮',
  trophy: '🏆', drum: '🥁', guitar: '🎸', sparkle: '✨'
}

export function getMilestoneIcon(m: Milestone): string {
  if (m.emoji) return m.emoji
  if (m.icon_preset && PRESET_ICONS[m.icon_preset]) return PRESET_ICONS[m.icon_preset]
  return '🎯'
}

interface Props {
  milestones: Milestone[]
  totalRaisedPence: number
  compact?: boolean // show only important milestones when true and they don't all fit
  onViewAll?: () => void
  showViewAll?: boolean
}

export function MilestoneBar({ milestones, totalRaisedPence, compact = false, onViewAll, showViewAll = false }: Props) {
  const [animatedPct, setAnimatedPct] = useState(0)
  const [newlyUnlocked, setNewlyUnlocked] = useState<Set<string>>(new Set())
  const prevUnlockedRef = useRef<Set<string>>(new Set())
  const barRef = useRef<HTMLDivElement>(null)

  const sorted = [...milestones].sort((a, b) => a.amount - b.amount)
  const displayed = compact
    ? (sorted.every(m => m.important) || sorted.length <= 5 ? sorted : sorted.filter(m => m.important))
    : sorted

  const maxAmount = sorted.length > 0 ? sorted[sorted.length - 1].amount : 1
  const targetPct = Math.min((totalRaisedPence / maxAmount) * 100, 100)
  const allFunded = totalRaisedPence >= maxAmount && sorted.length > 0

  // Determine newly unlocked milestones (unlocked now but not before animation started)
  useEffect(() => {
    const nowUnlocked = new Set(sorted.filter(m => totalRaisedPence >= m.amount).map(m => m.id))
    const prev = prevUnlockedRef.current
    const fresh = new Set([...nowUnlocked].filter(id => !prev.has(id)))
    if (fresh.size > 0) setNewlyUnlocked(fresh)
    prevUnlockedRef.current = nowUnlocked
  }, [totalRaisedPence, milestones])

  // Animate fill on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setTimeout(() => setAnimatedPct(targetPct), 80)
    })
    return () => cancelAnimationFrame(raf)
  }, [targetPct])

  if (displayed.length === 0) return null

  const pctFor = (m: Milestone) => Math.min((m.amount / maxAmount) * 100, 100)
  const isUnlocked = (m: Milestone) => totalRaisedPence >= m.amount

  const raisedGbp = (totalRaisedPence / 100).toFixed(0)
  const maxGbp = (maxAmount / 100).toFixed(0)

  return (
    <div className="space-y-3">
      {/* Amount raised */}
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-bold text-gradient-fire">£{raisedGbp} raised</span>
        <span className="text-xs text-smoke-400">of £{maxGbp} goal</span>
      </div>

      {/* Bar track + icons */}
      <div className="relative" ref={barRef}>
        {/* Icons above bar — alternating positions */}
        <div className="relative h-10 mb-1">
          {displayed.map((m, i) => {
            const pct = pctFor(m)
            const unlocked = isUnlocked(m)
            const isLast = m.id === sorted[sorted.length - 1].id
            const isNew = newlyUnlocked.has(m.id)
            // Final milestone sits on the bar end, others alternate above
            if (isLast) return null
            if (i % 2 !== 0) return null // only even indices above
            return (
              <MilestoneIcon
                key={m.id}
                milestone={m}
                pct={pct}
                unlocked={unlocked}
                isNew={isNew}
                position="above"
              />
            )
          })}
        </div>

        {/* The bar itself */}
        <div className="relative h-3 rounded-full bg-white/8 overflow-hidden">
          {/* Fill */}
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${animatedPct}%`,
              background: 'linear-gradient(90deg, #e85f00, #fbbf24)',
            }}
          />
          {/* Pulsing leading edge */}
          {!allFunded && animatedPct > 0 && (
            <div
              className="absolute inset-y-0 w-3 rounded-full animate-pulse-glow transition-all duration-1000 ease-out"
              style={{
                left: `calc(${animatedPct}% - 6px)`,
                background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)',
                opacity: 0.8
              }}
            />
          )}
          {/* Milestone tick marks */}
          {displayed.map(m => {
            const isLast = m.id === sorted[sorted.length - 1].id
            if (isLast) return null
            return (
              <div
                key={m.id}
                className="absolute inset-y-0 w-0.5 bg-black/20"
                style={{ left: `${pctFor(m)}%` }}
              />
            )
          })}
        </div>

        {/* Icons below bar — alternating, + final milestone on bar end */}
        <div className="relative h-10 mt-1">
          {displayed.map((m, i) => {
            const pct = pctFor(m)
            const unlocked = isUnlocked(m)
            const isLast = m.id === sorted[sorted.length - 1].id
            const isNew = newlyUnlocked.has(m.id)
            if (isLast) {
              // Final milestone sits on the bar end, inline
              return (
                <MilestoneIcon
                  key={m.id}
                  milestone={m}
                  pct={pct}
                  unlocked={unlocked}
                  isNew={isNew}
                  position="inline"
                />
              )
            }
            if (i % 2 !== 1) return null // only odd indices below
            return (
              <MilestoneIcon
                key={m.id}
                milestone={m}
                pct={pct}
                unlocked={unlocked}
                isNew={isNew}
                position="below"
              />
            )
          })}
        </div>

        {/* Amount labels */}
        <div className="relative h-4">
          {displayed.map(m => {
            return (
              <span
                key={m.id}
                className={cn(
                  'absolute text-[10px] -translate-x-1/2 transition-colors',
                  isUnlocked(m) ? 'text-fire-400' : 'text-smoke-600'
                )}
                style={{ left: `${pctFor(m)}%` }}
                title={m.name}
              >
                £{(m.amount / 100).toFixed(0)}
              </span>
            )
          })}
        </div>
      </div>

      {/* Fully funded celebration */}
      {allFunded && (
        <div className="text-center py-2">
          <span className="text-sm font-semibold text-gradient-fire animate-pulse-glow">
            🎆 Fully funded! Thank you! 🎆
          </span>
        </div>
      )}

      {/* View full tracker link */}
      {showViewAll && onViewAll && (
        <button
          onClick={onViewAll}
          className="text-xs text-fire-400 hover:text-fire-300 transition-colors tap-highlight-none"
        >
          View full tracker →
        </button>
      )}
    </div>
  )
}

function MilestoneIcon({
  milestone, pct, unlocked, isNew, position
}: {
  milestone: Milestone
  pct: number
  unlocked: boolean
  isNew: boolean
  position: 'above' | 'below' | 'inline'
}) {
  const icon = getMilestoneIcon(milestone)
  const hasImage = !!milestone.icon_image

  const sizeClass = unlocked ? 'w-8 h-8 text-base' : 'w-6 h-6 text-sm'
  const topStyle = position === 'above'
    ? { bottom: 0, left: `${pct}%`, transform: 'translateX(-50%)' }
    : position === 'below'
      ? { top: 0, left: `${pct}%`, transform: 'translateX(-50%)' }
      : { top: '50%', left: `${pct}%`, transform: 'translate(-50%, -50%)' } // inline on bar end

  return (
    <div
      className={cn(
        'absolute flex items-center justify-center rounded-full border-2 transition-all duration-500',
        unlocked
          ? cn('border-fire-400/60 glow-fire-sm', isNew && 'animate-bounce')
          : 'border-smoke-700 opacity-50 grayscale',
        sizeClass
      )}
      style={topStyle}
      title={`${milestone.name} — £${(milestone.amount / 100).toFixed(0)}`}
    >
      {hasImage ? (
        <img
          src={milestone.icon_image}
          alt={milestone.name}
          className={cn('rounded-full object-cover', unlocked ? 'w-7 h-7' : 'w-5 h-5')}
        />
      ) : (
        <span className="leading-none">{icon}</span>
      )}
    </div>
  )
}

export { PRESET_ICONS }
