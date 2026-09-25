import { useMemo, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import Fuse from 'fuse.js'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '../lib/utils'

type GuestOption = { id: string; name: string }

interface GuestNamePickerProps {
  guests: GuestOption[]
  value: GuestOption | null
  onChange: (guest: GuestOption) => void
}

export function GuestNamePicker({ guests, value, onChange }: GuestNamePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  // Typo-tolerant matching: "jhon smtih" still finds "John Smith"
  const fuse = useMemo(
    () => new Fuse(guests, { keys: ['name'], threshold: 0.4, ignoreLocation: true, ignoreDiacritics: true }),
    [guests]
  )
  const trimmed = query.trim()
  const results = trimmed ? fuse.search(trimmed).map(r => r.item) : guests

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setQuery('')
  }

  function select(guest: GuestOption) {
    onChange(guest)
    handleOpenChange(false)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Trigger
        className="flex h-11 w-full items-center justify-between rounded-xl glass border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fire-400/40 tap-highlight-none transition-colors"
      >
        <span className={value ? 'text-smoke-100' : 'text-smoke-500'}>
          {value?.name ?? 'Select your name…'}
        </span>
        <ChevronDown size={14} className="text-smoke-400" />
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col sheet-surface data-[state=open]:animate-slide-up"
          aria-describedby={undefined}
        >
          <div className="flex items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 border-b border-white/10">
            <DialogPrimitive.Title className="flex-1 text-base font-semibold text-smoke-100">
              Find your name
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close"
              className="rounded-lg p-2 -mr-2 text-smoke-400 hover:text-smoke-200 hover:bg-white/5 tap-highlight-none transition-colors"
            >
              <X size={20} />
            </DialogPrimitive.Close>
          </div>

          <div className="px-4 py-3">
            <label className="relative block">
              <span className="sr-only">Search names</span>
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-smoke-500 pointer-events-none" />
              <input
                autoFocus
                type="text"
                enterKeyHint="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Start typing your name…"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-controls="guest-name-results"
                className="flex h-11 w-full rounded-xl glass border border-white/10 bg-transparent pl-9 pr-3 py-2 text-base text-smoke-100 placeholder:text-smoke-500 focus:outline-none focus:ring-2 focus:ring-fire-400/40 focus:border-fire-400/40"
              />
            </label>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <p className="sr-only" aria-live="polite">
              {results.length === 0 ? 'No matches' : `${results.length} ${results.length === 1 ? 'match' : 'matches'}`}
            </p>
            {results.length > 0 ? (
              <ul id="guest-name-results" aria-label="Guest names">
                {results.map(g => {
                  const selected = value?.id === g.id
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => select(g)}
                        aria-pressed={selected}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-base tap-highlight-none transition-colors',
                          selected ? 'bg-fire-400/10 text-fire-300' : 'text-smoke-200 active:bg-white/5 hover:bg-white/5'
                        )}
                      >
                        <span className="flex-1">{g.name}</span>
                        {selected && <Check size={16} className="text-fire-400" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium text-smoke-300 mb-1">
                  {guests.length === 0 ? 'No names to show yet' : 'No matches'}
                </p>
                <p className="text-sm text-smoke-500 leading-relaxed">
                  Can't find your name? Check the spelling or message the host to be added to the list.
                </p>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
