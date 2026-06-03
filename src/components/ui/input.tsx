import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-xl glass border border-white/10 bg-transparent px-3 py-2 text-sm text-smoke-100 placeholder:text-smoke-500 focus:outline-none focus:ring-2 focus:ring-fire-400/40 focus:border-fire-400/40 disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        'flex min-h-20 w-full rounded-xl glass border border-white/10 bg-transparent px-3 py-2.5 text-sm text-smoke-100 placeholder:text-smoke-500 focus:outline-none focus:ring-2 focus:ring-fire-400/40 focus:border-fire-400/40 disabled:cursor-not-allowed disabled:opacity-50 transition-colors resize-none',
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'
