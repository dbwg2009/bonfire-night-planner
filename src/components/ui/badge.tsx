import { cn } from '../../lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'fire' | 'success' | 'warning' | 'danger' | 'ghost'
}

const variants = {
  default: 'bg-white/8 text-smoke-200 border-white/10',
  fire: 'bg-fire-500/15 text-fire-300 border-fire-400/25',
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-400/25',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-400/25',
  danger: 'bg-red-500/15 text-red-400 border-red-400/25',
  ghost: 'bg-transparent text-smoke-400 border-smoke-600'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  )
}
