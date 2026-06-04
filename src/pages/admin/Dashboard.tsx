import { Link } from 'react-router-dom'
import {
  Users, UtensilsCrossed, ListTodo, CreditCard, MapPin,
  CheckSquare, Calendar, Settings, LogOut, ChevronRight, Car, Trophy, CheckCheck, Circle, Clock3
} from 'lucide-react'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '../../components/ui/card'
import { Countdown } from '../../components/Countdown'
import { WeatherCard, LightLevelsCard } from '../../components/WeatherWidget'
import { PageContent } from '../../components/Layout'
import { useAuthStore } from '../../store/auth'
import { useEventStore } from '../../store/event'
import { api } from '../../lib/api'
import { getBonfireDate, timeAgo, formatDate } from '../../lib/utils'
import type { Guest, Task, MilestonesResponse } from '../../lib/types'

const NOTIF_ICONS: Record<string, string> = {
  rsvp_accepted: '✅',
  rsvp_declined: '❌',
  rsvp_cancelled: '🚫',
}

export default function Dashboard() {
  const organiser = useAuthStore(s => s.organiser)
  const logout = useAuthStore(s => s.logout)
  const event = useEventStore(s => s.currentEvent)
  const qc = useQueryClient()

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

  const unreadCount = notifications.filter((n: { read: number }) => n.read === 0).length
  const [showAllNotifs, setShowAllNotifs] = useState(false)

  const accepted = guests.filter(g => g.rsvp_status === 'accepted').length
  const declined = guests.filter(g => g.rsvp_status === 'declined').length
  const pending = guests.filter(g => g.rsvp_status === 'invited').length
  const completedTasks = tasks.filter(t => t.status === 'completed').length
  const totalTasks = tasks.length

  const upcomingTasks = tasks
    .filter(t => t.status !== 'completed')
    .sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1
      return 0
    })
    .slice(0, 2)

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
      <div className="px-4 pt-6 pb-4 flex items-start justify-between">
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

        {/* Notifications */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-smoke-300">Notifications</h2>
              {unreadCount > 0 && (
                <span className="w-4 h-4 bg-fire-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
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
          {notifications.length === 0 ? (
            <p className="text-sm text-smoke-500 text-center py-3">No notifications yet</p>
          ) : (
            <div className="space-y-0 -mx-4 -mb-4">
              {(showAllNotifs ? notifications : notifications.slice(0, 2)).map((n: { id: string; type: string; message: string; created_at: string; read: number }) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-t border-white/[0.04] ${n.read === 0 ? 'bg-white/[0.03]' : ''}`}
                >
                  <span className="text-base shrink-0 mt-0.5">{NOTIF_ICONS[n.type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-smoke-200 leading-snug">{n.message}</p>
                    <p className="text-xs text-smoke-500 mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                  {n.read === 0 && <span className="w-1.5 h-1.5 rounded-full bg-fire-400 shrink-0 mt-1.5" />}
                </div>
              ))}
              {notifications.length > 2 && (
                <button
                  onClick={() => setShowAllNotifs(v => !v)}
                  className="w-full px-4 py-2.5 border-t border-white/[0.04] text-xs text-fire-400 hover:text-fire-300 transition-colors text-center"
                >
                  {showAllNotifs ? 'Show less' : `View ${notifications.length - 2} more`}
                </button>
              )}
            </div>
          )}
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
            {upcomingTasks.length > 0 && (
              <div className="mt-3 space-y-2 border-t border-white/[0.04] pt-3">
                {upcomingTasks.map(task => {
                  const Icon = task.status === 'in_progress' ? Clock3 : Circle
                  const iconColor = task.status === 'in_progress' ? 'text-amber-400' : 'text-smoke-600'
                  return (
                    <div key={task.id} className="flex items-center gap-2">
                      <Icon size={14} className={`${iconColor} shrink-0`} />
                      <p className="text-sm text-smoke-200 flex-1 min-w-0 truncate">{task.title}</p>
                      {task.due_date && (
                        <span className="text-[11px] text-smoke-500 shrink-0">{formatDate(task.due_date, 'dd MMM')}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
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

        {/* Weather */}
        <WeatherCard
          eventDate={bonfireDate}
          lat={event?.lat}
          lon={event?.lon}
        />

        {/* Light Levels — tap to configure */}
        <Link to="/admin/light-levels" className="block tap-highlight-none">
          <LightLevelsCard
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
