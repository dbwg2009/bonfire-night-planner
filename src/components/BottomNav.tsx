import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, UtensilsCrossed, ListTodo, Calendar, Settings
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuthStore } from '../store/auth'

const adminNavItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Home', exact: true },
  { to: '/admin/guests', icon: Users, label: 'Guests' },
  { to: '/admin/food', icon: UtensilsCrossed, label: 'Food' },
  { to: '/admin/tasks', icon: ListTodo, label: 'Tasks' },
  { to: '/admin/schedule', icon: Calendar, label: 'Schedule' },
  { to: '/admin/settings', icon: Settings, label: 'More' }
]

const guestNavItems = [
  { to: '/event', icon: LayoutDashboard, label: 'Home', exact: true },
  { to: '/event/rsvp', icon: Users, label: 'RSVP' },
  { to: '/event/info', icon: Calendar, label: 'Info' }
]

export function BottomNav() {
  const organiser = useAuthStore(s => s.organiser)
  const items = organiser ? adminNavItems : guestNavItems

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 safe-bottom">
      <div className="glass border-t border-white/8 px-1 pt-2 pb-1">
        <div className="flex justify-around max-w-lg mx-auto">
          {items.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 tap-highlight-none min-w-0 flex-1',
                  isActive
                    ? 'text-fire-400'
                    : 'text-smoke-500 active:text-smoke-300'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    'p-1.5 rounded-lg transition-all duration-200',
                    isActive ? 'bg-fire-400/15 glow-fire-sm' : ''
                  )}>
                    <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                  </div>
                  <span className="text-[10px] font-medium leading-none truncate">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
