import { Link, useNavigate } from 'react-router-dom'
import { CreditCard, MapPin, Flame, Settings, ChevronRight, LogOut, ListTodo, History, Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '../../components/ui/card'
import { PageHeader, PageContent } from '../../components/Layout'
import { useAuthStore } from '../../store/auth'
import { useEventStore } from '../../store/event'
import { api } from '../../lib/api'
import { cn, formatDate } from '../../lib/utils'
import type { Event } from '../../lib/types'

export default function More() {
  const organiser = useAuthStore(s => s.organiser)
  const logout = useAuthStore(s => s.logout)
  const event = useEventStore(s => s.currentEvent)
  const setCurrentEvent = useEventStore(s => s.setCurrentEvent)
  const navigate = useNavigate()

  const canFinance = organiser?.is_owner || organiser?.permissions.finance
  const canSettings = organiser?.is_owner || organiser?.permissions.tasks_and_settings

  const { data: allEvents = [] } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: () => api.getEvents() as Promise<Event[]>
  })

  const pastEvents = allEvents.filter(e => e.id !== event?.id).sort((a, b) => b.year - a.year)

  function switchToEvent(e: Event) {
    setCurrentEvent(e)
    navigate('/admin')
  }

  const sections = [
    {
      label: 'Tasks',
      desc: 'To-do list with stages, owners and due dates',
      icon: ListTodo,
      to: '/admin/tasks',
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
      show: true
    },
    {
      label: 'Finance',
      desc: 'Costs, contributions and expenses',
      icon: CreditCard,
      to: '/admin/finance',
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      show: canFinance
    },
    {
      label: 'Venue Locations',
      desc: 'Plan and compare potential venues',
      icon: MapPin,
      to: '/admin/locations',
      color: 'text-cyan-400',
      bg: 'bg-cyan-400/10',
      show: true
    },
    {
      label: event?.conflict_event_name || 'Conflict Event',
      desc: 'Transport & timing for guests with a clash',
      icon: Flame,
      to: '/admin/conflict-event',
      color: 'text-orange-400',
      bg: 'bg-orange-400/10',
      show: event?.conflict_event_enabled
    },
    {
      label: 'Settings',
      desc: 'Event setup, food algorithm, light levels, roles',
      icon: Settings,
      to: '/admin/settings',
      color: 'text-smoke-400',
      bg: 'bg-smoke-600/20',
      show: canSettings
    }
  ].filter(s => s.show)

  return (
    <div className="animate-fade-in">
      <PageHeader title="More" subtitle={organiser?.name} />

      <PageContent>
        {/* Organiser card */}
        <Card className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-bold shrink-0"
            style={{ backgroundColor: organiser?.color ?? '#e85f00' }}
          >
            {organiser?.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-smoke-100">{organiser?.name}</p>
            <p className="text-xs text-smoke-400">
              {organiser?.is_owner ? 'Owner — full access' : 'Co-organiser'}
            </p>
          </div>
        </Card>

        {/* Feature links */}
        <div className="space-y-2">
          {sections.map(({ label, desc, icon: Icon, to, color, bg }) => (
            <Link key={to} to={to}>
              <Card className="flex items-center gap-3 hover:bg-white/[0.06] active:scale-[0.98] transition-all tap-highlight-none">
                <div className={cn('p-2.5 rounded-xl shrink-0', bg)}>
                  <Icon size={18} className={color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-smoke-100">{label}</p>
                  <p className="text-xs text-smoke-500 truncate">{desc}</p>
                </div>
                <ChevronRight size={16} className="text-smoke-600 shrink-0" />
              </Card>
            </Link>
          ))}
        </div>

        {/* Previous bonfire nights */}
        {(pastEvents.length > 0 || canSettings) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <History size={14} className="text-smoke-500" />
                <p className="text-xs font-semibold text-smoke-400 uppercase tracking-wider">Previous Years</p>
              </div>
              {canSettings && (
                <Link to="/setup" className="flex items-center gap-1 text-xs text-fire-400 hover:text-fire-300 transition-colors">
                  <Plus size={12} /> New year
                </Link>
              )}
            </div>

            {pastEvents.length === 0 ? (
              <Card className="text-center py-4">
                <p className="text-xs text-smoke-500">No previous events yet</p>
                <p className="text-[11px] text-smoke-600 mt-0.5">Past events will appear here after the first year</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {pastEvents.map(e => (
                  <button
                    key={e.id}
                    onClick={() => switchToEvent(e)}
                    className="w-full glass-card flex items-center gap-3 p-3 hover:bg-white/[0.06] active:scale-[0.98] transition-all tap-highlight-none text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-smoke-700/50 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-smoke-300">{e.year}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-smoke-200">{e.name}</p>
                      <p className="text-xs text-smoke-500">{formatDate(e.date, 'EEEE d MMMM yyyy')} · {e.status}</p>
                    </div>
                    <ChevronRight size={14} className="text-smoke-600 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Guest view link */}
        <a href="/" target="_blank" rel="noopener noreferrer">
          <Card className="flex items-center gap-3 hover:bg-white/[0.06] active:scale-[0.98] transition-all tap-highlight-none">
            <div className="p-2.5 rounded-xl bg-fire-400/10 shrink-0">
              <span className="text-lg leading-none">🔥</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-smoke-100">Guest view</p>
              <p className="text-xs text-smoke-500">See what guests see</p>
            </div>
            <ChevronRight size={16} className="text-smoke-600 shrink-0" />
          </Card>
        </a>

        {/* Logout */}
        <button
          onClick={() => { logout(); navigate('/login') }}
          className="w-full glass-card p-4 flex items-center gap-3 text-red-400 hover:bg-red-500/5 tap-highlight-none transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Log out</span>
        </button>
      </PageContent>
    </div>
  )
}
