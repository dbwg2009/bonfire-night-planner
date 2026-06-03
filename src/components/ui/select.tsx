import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

export const Select = SelectPrimitive.Root
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value

export function SelectTrigger({ className, children, ...props }: SelectPrimitive.SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'flex h-11 w-full items-center justify-between rounded-xl glass border border-white/10 px-3 py-2 text-sm text-smoke-100 placeholder:text-smoke-500 focus:outline-none focus:ring-2 focus:ring-fire-400/40 disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown size={14} className="text-smoke-400" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

export function SelectContent({ className, children, position = 'popper', ...props }: SelectPrimitive.SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          'relative z-50 min-w-[8rem] overflow-hidden rounded-xl glass border border-white/10 shadow-2xl data-[state=open]:animate-fade-in',
          position === 'popper' && 'translate-y-1',
          className
        )}
        position={position}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

export function SelectItem({ className, children, ...props }: SelectPrimitive.SelectItemProps) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-3 text-sm text-smoke-200 outline-none focus:bg-fire-400/10 focus:text-fire-300 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors',
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check size={12} className="text-fire-400" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export function SelectLabel({ className, ...props }: SelectPrimitive.SelectLabelProps) {
  return (
    <SelectPrimitive.Label
      className={cn('py-1.5 pl-8 pr-2 text-xs font-semibold text-smoke-500 uppercase tracking-wider', className)}
      {...props}
    />
  )
}

export function SelectSeparator({ className, ...props }: SelectPrimitive.SelectSeparatorProps) {
  return (
    <SelectPrimitive.Separator
      className={cn('-mx-1 my-1 h-px bg-white/5', className)}
      {...props}
    />
  )
}
