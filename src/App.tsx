import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './store/auth'
import { useEventStore } from './store/event'
import { Layout } from './components/Layout'

// Pages
import Login from './pages/Login'
import EventSetup from './pages/EventSetup'
import Dashboard from './pages/admin/Dashboard'
import Guests from './pages/admin/Guests'
import Food from './pages/admin/Food'
import CheckIn from './pages/admin/CheckIn'
import Tasks from './pages/admin/Tasks'
import Schedule from './pages/admin/Schedule'
import Finance from './pages/admin/Finance'
import Locations from './pages/admin/Locations'
import ConflictEvent from './pages/admin/ConflictEvent'
import Settings from './pages/admin/Settings'
import Milestones from './pages/admin/Milestones'
import Pickup from './pages/admin/Pickup'
import LightLevels from './pages/admin/LightLevels'
import More from './pages/admin/More'
import GuestDashboard from './pages/guest/GuestDashboard'
import RsvpForm from './pages/guest/RsvpForm'
import Tracker from './pages/guest/Tracker'
import Status from './pages/Status'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 }
  }
})

function AdminGuard({ children }: { children: React.ReactNode }) {
  const organiser = useAuthStore(s => s.organiser)
  if (!organiser) return <Navigate to="/login" replace />
  return <>{children}</>
}

function EventGuard({ children }: { children: React.ReactNode }) {
  const event = useEventStore(s => s.currentEvent)
  if (!event) return <Navigate to="/setup" replace />
  return <>{children}</>
}

function FinanceGuard({ children }: { children: React.ReactNode }) {
  const organiser = useAuthStore(s => s.organiser)
  const canFinance = !!organiser && (organiser.is_owner || organiser.permissions.finance)
  if (!canFinance) return <Navigate to="/admin/more" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public guest pages — no nav bar, standalone pages */}
          <Route path="/" element={<GuestDashboard />} />
          <Route path="/rsvp" element={<RsvpForm />} />
          <Route path="/tracker" element={<Tracker />} />
          <Route path="/status" element={<Status />} />

          {/* Auth */}
          <Route path="/login" element={<Login />} />

          {/* Event setup — shown when admin is logged in but no event exists */}
          <Route path="/setup" element={
            <AdminGuard><EventSetup /></AdminGuard>
          } />

          {/* Admin routes — all behind auth + event guards, have bottom nav */}
          <Route path="/admin" element={
            <AdminGuard><EventGuard><Layout /></EventGuard></AdminGuard>
          }>
            <Route index element={<Dashboard />} />
            <Route path="guests" element={<Guests />} />
            <Route path="food" element={<Food />} />
            <Route path="checkin" element={<CheckIn />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="finance" element={<Finance />} />
            <Route path="locations" element={<Locations />} />
            <Route path="conflict-event" element={<ConflictEvent />} />
            <Route path="settings" element={<Settings />} />
            <Route path="milestones" element={<FinanceGuard><Milestones /></FinanceGuard>} />
            <Route path="pickup" element={<Pickup />} />
            <Route path="light-levels" element={<LightLevels />} />
            <Route path="more" element={<More />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
