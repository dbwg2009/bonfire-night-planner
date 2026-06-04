import { useState, useRef, useEffect } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useEventStore } from '../store/event'
import { timeAgo } from '../lib/utils'

const NOTIF_ICONS: Record<string, string> = {
  rsvp_accepted: '✅',
  rsvp_declined: '❌',
  rsvp_cancelled: '🚫',
}

export function NotificationBell() {
  const event = useEventStore(s => s.currentEvent)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', event?.id],
    queryFn: () => api.getNotifications(event!.id),
    enabled: !!event?.id,
    refetchInterval: 30_000,
  })

  const markRead = useMutation({
    mutationFn: () => api.markNotificationsRead(event!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unreadCount = notifications.filter(n => n.read === 0).length

  function handleOpen() {
    setOpen(o => !o)
    if (!open && unreadCount > 0) markRead.mutate()
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!event) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl text-smoke-400 hover:text-smoke-100 hover:bg-white/5 transition-colors tap-highlight-none"
        aria-label="Notifications"
      >
        <Bell size={20} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-fire-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 glass border border-white/10 rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <p className="text-sm font-semibold text-smoke-100">Notifications</p>
            {unreadCount > 0 && (
              <button
                onClick={() => markRead.mutate()}
                className="flex items-center gap-1 text-xs text-smoke-500 hover:text-smoke-300 transition-colors"
              >
                <CheckCheck size={12} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-smoke-500 text-center py-6">No notifications yet</p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0 ${n.read === 0 ? 'bg-white/[0.03]' : ''}`}
                >
                  <span className="text-base shrink-0 mt-0.5">{NOTIF_ICONS[n.type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-smoke-200 leading-snug">{n.message}</p>
                    <p className="text-xs text-smoke-500 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                  {n.read === 0 && <span className="w-1.5 h-1.5 rounded-full bg-fire-400 shrink-0 mt-1.5" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
