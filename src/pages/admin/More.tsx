import { Link, useNavigate } from 'react-router-dom'
import { CreditCard, MapPin, Flame, Settings, ChevronRight, LogOut, ListTodo } from 'lucide-react'
import { Card } from '../../components/ui/card'
import { PageHeader, PageContent } from '../../components/Layout'
import { useAuthStore } from '../../store/auth'
import { useEventStore } from '../../store/event'
import { cn } from '../../lib/utils'

export default function More() {
  const organiser = useAuthStore(s => s.organiser)
  const logout = useAuthStore(s => s.logout)
  const event = useEventStore(s => s.currentEvent)
  const navigate = useNavigate()

  const canFinance = organiser?.is_owner || organiser?.permissions.finance
  const canSettings = organiser?.is_owner || organiser?.permissions.tasks_and_settings

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
      desc: `Transport & timing for guests with a clash`,
      icon: Flame,
      to: '/admin/conflict-event',
      color: 'text-orange-400',
      bg: 'bg-orange-400/10',
      show: event?.conflict_event_enabled
    },
    {
      label: 'Settings',
      desc: 'Event setup, food algorithm, organisers & roles',
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
