import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/utils'
import type { Milestone } from '../lib/types'
import { PRESET_ICONS } from '../lib/milestoneConstants'

export function getMilestoneIcon(m: Milestone): string {
  if (m.emoji) return m.emoji
  if (m.icon_preset && PRESET_ICONS[m.icon_preset]) return PRESET_ICONS[m.icon_preset]
  return '🎯'
}

interface Props {
  milestones: Milestone[]
  totalRaisedPence: number
  compact?: boolean
  onViewAll?: () => void
  showViewAll?: boolean
}

export function MilestoneBar({ milestones, totalRaisedPence, compact = false, onViewAll, showViewAll = false }: Props) {
  const [animatedPct, setAnimatedPct] = useState(0)
  const [newlyUnlocked, setNewlyUnlocked] = useState<Set<string>>(new Set())
  const prevUnlockedRef = useRef<Set<string>>(new Set())

  const sorted = [...milestones].sort((a, b) => a.amount - b.amount)
  const shouldShowAll = sorted.every(m => m.important) || sorted.length <= 5
  const displayed = !compact ? sorted : (shouldShowAll ? sorted : sorted.filter(m => m.important))

  const maxAmount = sorted.length > 0 ? sorted[sorted.length - 1].amount : 1
  const targetPct = Math.min((totalRaisedPence / maxAmount) * 100, 100)
  const allFunded = totalRaisedPence >= maxAmount && sorted.length > 0

  const milestoneKey = sorted.map(m => `${m.id}:${m.amount}`).join(',')

  useEffect(() => {
    const nowUnlocked = new Set(sorted.filter(m => totalRaisedPence >= m.amount).map(m => m.id))
    const prev = prevUnlockedRef.current
    const fresh = new Set([...nowUnlocked].filter(id => !prev.has(id)))
    if (fresh.size > 0) setNewlyUnlocked(fresh)
    prevUnlockedRef.current = nowUnlocked
  }, [totalRaisedPence, milestoneKey])

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPct(targetPct), 80)
    return () => clearTimeout(timer)
  }, [targetPct])

  if (displayed.length === 0) return null

  const pctFor = (m: Milestone) => Math.min((m.amount / maxAmount) * 100, 100)
  const isUnlocked = (m: Milestone) => totalRaisedPence >= m.amount

  const raisedGbp = (totalRaisedPence / 100).toFixed(0)
  const maxGbp = (maxAmount / 100).toFixed(0)

  // Even-index milestones sit above the bar, odd-index below (first milestone is above)
  const aboveIcons = displayed.filter((_, i) => i % 2 === 0)
  const belowIcons = displayed.filter((_, i) => i % 2 !== 0)

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-bold text-gradient-fire">£{raisedGbp} raised</span>
        <span className="text-xs text-smoke-400">of £{maxGbp} goal</span>
      </div>

      <div className="relative">
        {/* Icons above bar */}
        <div className="relative h-11 mb-2">
          {aboveIcons.map(m => (
            <BarIcon key={m.id} milestone={m} pct={pctFor(m)} unlocked={isUnlocked(m)} isNew={newlyUnlocked.has(m.id)} align="bottom" />
          ))}
        </div>

        {/* Bar track */}
        <div className="relative h-3 rounded-full bg-white/8">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${animatedPct}%`, background: 'linear-gradient(90deg, #e85f00, #fbbf24)' }}
          />
          {!allFunded && animatedPct > 0 && (
            <div
              className="absolute inset-y-0 w-3 rounded-full animate-pulse-glow transition-all duration-1000 ease-out"
              style={{ left: `calc(${animatedPct}% - 6px)`, background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)', opacity: 0.8 }}
            />
          )}
        </div>

        {/* Icons below bar */}
        <div className="relative h-11 mt-2">
          {belowIcons.map(m => (
            <BarIcon key={m.id} milestone={m} pct={pctFor(m)} unlocked={isUnlocked(m)} isNew={newlyUnlocked.has(m.id)} align="top" />
          ))}
        </div>
      </div>

      {allFunded && (
        <div className="text-center py-2">
          <span className="text-sm font-semibold text-gradient-fire animate-pulse-glow">🎆 Fully funded! Thank you! 🎆</span>
        </div>
      )}

      {showViewAll && onViewAll && (
        <button onClick={onViewAll} className="text-xs text-fire-400 hover:text-fire-300 transition-colors tap-highlight-none">
          View full tracker →
        </button>
      )}
    </div>
  )
}

function BarIcon({
  milestone, pct, unlocked, isNew, align
}: {
  milestone: Milestone
  pct: number
  unlocked: boolean
  isNew: boolean
  align: 'top' | 'bottom'
}) {
  const icon = getMilestoneIcon(milestone)
  const hasImage = !!milestone.icon_image
  const [imgError, setImgError] = useState(false)

  return (
    <div
      className={cn(
        'w-9 h-9 flex items-center justify-center rounded-xl border transition-all duration-500',
        unlocked ? cn('border-fire-400/40', isNew && 'scale-110') : 'border-smoke-700/60 opacity-50 grayscale'
      )}
      title={milestone.name}
      style={{
        position: 'absolute',
        left: `${pct}%`,
        transform: 'translateX(-50%)',
        [align]: 0,
        background: unlocked ? 'linear-gradient(135deg, #e85f00, #fbbf24)' : 'rgba(255,255,255,0.04)',
      }}
    >
      {hasImage && !imgError ? (
        <img src={milestone.icon_image} alt={milestone.name} className="w-7 h-7 rounded-lg object-cover" onError={() => setImgError(true)} />
      ) : (
        <span className="text-base leading-none">{icon}</span>
      )}
    </div>
  )
}
