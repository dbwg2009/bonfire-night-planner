import { Link } from 'react-router-dom'
import {
  Users, UtensilsCrossed, ListTodo, CreditCard, MapPin,
  CheckSquare, Calendar, Settings, LogOut, ChevronRight, Car, Trophy
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '../../components/ui/card'
import { Countdown } from '../../components/Countdown'
import { WeatherWidget } from '../../components/WeatherWidget'
import { PageContent } from '../../components/Layout'
import { useAuthStore } from '../../store/auth'
import { useEventStore } from '../../store/event'
import { api } from '../../lib/api'
import { getBonfireDate } from '../../lib/utils'
import type { Guest, Task, MilestonesResponse } from '../../lib/types'

export default function Dashboard() {
  const organiser = useAuthStore(s => s.organiser)
  const logout = useAuthStore(s => s.logout)
  const event = useEventStore(s => s.currentEvent)

  const year = event?.year ?? new Date().getFullYear()
  const bonfireDate = event ? new Date(event.date) : getBonfireDate(year)

  const { data: guests = [] } = useQuery<Guest[]>({
    queryKey: ['guests', event?.id],
    queryFn: () => api.getGuests(event!.id) as Promise<Guest[]>,
    enabled: !!event?.id
  })

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks', event?.id],
    queryFn: () => api.getTasks(event!.id) as Promise<Task[]>,
    enabled: !!event?.id
  })

  const { data: pickupSlots = [] } = useQuery<{ id: string; label: string; sort_order: number }[]>({
    queryKey: ['pickup-slots', event?.id],
    queryFn: () => api.getPickupSlots(event!.id),
    enabled: !!event?.id
  })

  const { data: milestonesData } = useQuery<MilestonesResponse>({
    queryKey: ['milestones', event?.id],
    queryFn: () => api.getMilestones(event!.id),
    enabled: !!event?.id
  })

  const accepted = guests.filter(g => g.rsvp_status === 'accepted').length
  const declined = guests.filter(g => g.rsvp_status === 'declined').length
  const pending = guests.filter(g => g.rsvp_status === 'invited').length
  const completedTasks = tasks.filter(t => t.status === 'completed').length
  const totalTasks = tasks.length

  const slotsMeta = pickupSlots.length === 0 ? 'No slots yet' : `${pickupSlots.length} slot${pickupSlots.length !== 1 ? 's' : ''}`
  const milestonesMeta = milestonesData && milestonesData.total_raised > 0
    ? `£${(milestonesData.total_raised / 100).toFixed(0)} raised`
    : 'Track progress'

  const quickLinks = [
    { to: '/admin/guests', icon: Users, label: 'Guests', meta: `${accepted} coming`, color: 'text-emerald-400' },
    { to: '/admin/food', icon: UtensilsCrossed, label: 'Food', meta: 'Shopping list', color: 'text-amber-400' },
    { to: '/admin/checkin', icon: CheckSquare, label: 'Check-in', meta: 'Live register', color: 'text-fire-400' },
    { to: '/admin/pickup', icon: Car, label: 'Transport', meta: slotsMeta, color: 'text-teal-400' },
    { to: '/admin/finance', icon: CreditCard, label: 'Finance', meta: 'Costs', color: 'text-blue-400' },
    { to: '/admin/milestones', icon: Trophy, label: 'Milestones', meta: milestonesMeta, color: 'text-yellow-400' },
    { to: '/admin/tasks', icon: ListTodo, label: 'Tasks', meta: `${completedTasks}/${totalTasks} done`, color: 'text-purple-400' },
    { to: '/admin/schedule', icon: Calendar, label: 'Schedule', meta: 'Timeline', color: 'text-rose-400' },
    { to: '/admin/locations', icon: MapPin, label: 'Locations', meta: 'Venue planning', color: 'text-cyan-400' },
    { to: '/admin/settings', icon: Settings, label: 'Settings', meta: 'Event & roles', color: 'text-smoke-400' }
  ]

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="pl-4 pr-14 pt-6 pb-4 flex items-start justify-between">
        <div>
          <p className="text-xs text-fire-400/70 uppercase tracking-widest font-medium">Welcome back</p>
          <h1 className="text-2xl font-bold text-smoke-100 mt-0.5">{organiser?.name}</h1>
          <p className="text-sm text-smoke-400">{event?.name ?? `Bonfire Night ${year}`}</p>
        </div>
        <button
          onClick={logout}
          className="p-2 rounded-xl glass text-smoke-500 hover:text-red-400 transition-colors tap-highlight-none"
          title="Log out"
        >
          <LogOut size={18} />
        </button>
      </div>

      <PageContent>
        {/* Countdown */}
        <Countdown targetDate={bonfireDate} />

        {/* RSVP Stats */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-smoke-300">RSVP Summary</h2>
            <Link to="/admin/guests" className="text-xs text-fire-400 hover:text-fire-300 flex items-center gap-0.5">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatPill label="Coming" value={accepted} color="text-emerald-400" bg="bg-emerald-500/10" />
            <StatPill label="Declined" value={declined} color="text-red-400" bg="bg-red-500/10" />
            <StatPill label="Pending" value={pending} color="text-amber-400" bg="bg-amber-500/10" />
          </div>
        </Card>

        {/* Task progress */}
        {totalTasks > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-smoke-300">Tasks</h2>
              <Link to="/admin/tasks" className="text-xs text-fire-400 hover:text-fire-300 flex items-center gap-0.5">
                View all <ChevronRight size={12} />
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-fire-500 to-fire-400 rounded-full transition-all duration-700"
                  style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs text-smoke-400 shrink-0">
                {completedTasks}/{totalTasks}
              </span>
            </div>
          </Card>
        )}

        {/* Quick links grid */}
        <div className="grid grid-cols-2 gap-3">
          {quickLinks.map(({ to, icon: Icon, label, meta, color }) => (
            <Link key={to} to={to}>
              <Card className="p-3 hover:bg-white/[0.06] active:scale-[0.98] transition-all tap-highlight-none h-full">
                <Icon size={20} className={color} />
                <p className="text-sm font-medium text-smoke-100 mt-2">{label}</p>
                <p className="text-xs text-smoke-500 mt-0.5">{meta}</p>
              </Card>
            </Link>
          ))}
        </div>

        {/* Weather — tap to open Light Levels page */}
        <Link to="/admin/light-levels" className="block tap-highlight-none">
          <WeatherWidget
            eventDate={bonfireDate}
            lat={event?.lat}
            lon={event?.lon}
            walkByOverride={event?.light_walk_by}
            fireworksOverride={event?.light_fireworks_after}
            lightNotes={event?.light_notes}
          />
        </Link>
      </PageContent>
    </div>
  )
}

function StatPill({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`rounded-xl ${bg} p-3 text-center`}>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[11px] text-smoke-500 mt-0.5">{label}</p>
    </div>
  )
}
