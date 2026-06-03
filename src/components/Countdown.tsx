import { useState, useEffect } from 'react'
import { getCountdownData } from '../lib/utils'
import { cn } from '../lib/utils'

interface CountdownProps {
  targetDate: Date
  className?: string
  compact?: boolean
}

export function Countdown({ targetDate, className, compact = false }: CountdownProps) {
  const [data, setData] = useState(getCountdownData(targetDate))

  useEffect(() => {
    const id = setInterval(() => setData(getCountdownData(targetDate)), 1000)
    return () => clearInterval(id)
  }, [targetDate])

  if (data.past) {
    return (
      <div className={cn('text-center', className)}>
        <span className="text-gradient-fire font-bold text-xl">🔥 Bonfire Night is here!</span>
      </div>
    )
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1.5 text-sm', className)}>
        <span className="text-fire-400">🔥</span>
        <span className="font-semibold text-smoke-100">
          {data.days}d {data.hours}h {data.minutes}m
        </span>
        <span className="text-smoke-400">to go</span>
      </div>
    )
  }

  const units = [
    { label: 'Days', value: data.days },
    { label: 'Hrs', value: data.hours },
    { label: 'Mins', value: data.minutes },
    { label: 'Secs', value: data.seconds }
  ]

  return (
    <div className={cn('text-center', className)}>
      <p className="text-xs font-medium text-fire-400/70 uppercase tracking-widest mb-2">Until Bonfire Night</p>
      <div className="flex justify-center gap-2">
        {units.map(({ label, value }) => (
          <div key={label} className="glass-card px-3 py-2.5 min-w-[58px] animate-count-pulse">
            <div className="text-2xl font-bold text-gradient-fire tabular-nums leading-none">
              {String(value).padStart(2, '0')}
            </div>
            <div className="text-[10px] text-smoke-500 uppercase tracking-wider mt-0.5">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
