import { useState, useEffect, useCallback } from 'react'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { cn } from '../../lib/utils'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

let toastQueue: ((toast: Toast) => void) | null = null

export function toast(message: string, type: ToastType = 'success') {
  if (toastQueue) toastQueue({ id: crypto.randomUUID(), message, type })
}

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info
}

const styles = {
  success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
  error: 'border-red-400/30 bg-red-500/10 text-red-300',
  info: 'border-fire-400/30 bg-fire-500/10 text-fire-300'
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((t: Toast) => {
    setToasts(prev => [...prev, t])
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 3500)
  }, [])

  useEffect(() => {
    toastQueue = addToast
    return () => { toastQueue = null }
  }, [addToast])

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none">
      {toasts.map(t => {
        const Icon = icons[t.type]
        return (
          <div
            key={t.id}
            className={cn(
              'glass-card border flex items-center gap-3 px-4 py-3 text-sm animate-slide-up pointer-events-auto shadow-xl',
              styles[t.type]
            )}
          >
            <Icon size={16} className="shrink-0" />
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
