import { forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-400/50 disabled:pointer-events-none disabled:opacity-40 tap-highlight-none active:scale-[0.97]',
  {
    variants: {
      variant: {
        default: 'bg-fire-500 hover:bg-fire-400 text-white glow-fire-sm',
        destructive: 'bg-red-500/90 hover:bg-red-500 text-white',
        outline: 'glass border-fire-400/30 hover:border-fire-400/60 hover:bg-fire-400/10 text-fire-300',
        ghost: 'hover:bg-white/5 text-smoke-300 hover:text-smoke-100',
        glass: 'glass-card hover:bg-white/[0.07] text-smoke-100',
        link: 'text-fire-300 underline-offset-4 hover:underline p-0 h-auto',
        success: 'bg-emerald-500/90 hover:bg-emerald-500 text-white',
        warning: 'bg-amber-500/90 hover:bg-amber-500 text-white'
      },
      size: {
        default: 'h-11 px-5 py-2.5',
        sm: 'h-9 px-3 text-xs',
        lg: 'h-13 px-7 text-base',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8'
      }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
