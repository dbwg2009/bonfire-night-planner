import { useAuthStore } from '../store/auth'

const BASE = '/api'

function getToken(): string | null {
  // The in-memory auth store is the source of truth — it's set on login and
  // rehydrated from persisted state on reload, so it can't fall out of sync the
  // way a separate localStorage key can. Fall back to localStorage, guarded
  // against environments where storage access throws (blocked site storage).
  const storeToken = useAuthStore.getState().token
  if (storeToken) return storeToken
  try {
    return localStorage.getItem('bonfire_token')
  } catch {
    return null
  }
}

function handleUnauthorised() {
  localStorage.removeItem('bonfire_token')
  localStorage.removeItem('bonfire-auth')
  localStorage.removeItem('bonfire-event')
  window.location.href = '/login'
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  skipAuthRedirect = false
): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    }
  })
  if (res.status === 401 && !skipAuthRedirect) {
    handleUnauthorised()
    return undefined as unknown as T
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Request failed')
  return data
}

export const api = {
  // Auth
  login: (pin: string) =>
    request<{ token: string; organiser: unknown }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ pin })
    }, true),

  // Events
  getEvents: (skipAuthRedirect = false) => request<unknown[]>('/events', {}, skipAuthRedirect),
  getEvent: (id: string) => request<unknown>(`/events/${id}`),
  createEvent: (data: unknown) =>
    request<unknown>('/events', { method: 'POST', body: JSON.stringify(data) }),
  updateEvent: (id: string, data: unknown) =>
    request<unknown>(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Guests
  getGuests: (eventId: string) => request<unknown[]>(`/events/${eventId}/guests`),
  createGuest: (eventId: string, data: unknown) =>
    request<unknown>(`/events/${eventId}/guests`, { method: 'POST', body: JSON.stringify(data) }),
  updateGuest: (eventId: string, id: string, data: unknown) =>
    request<unknown>(`/events/${eventId}/guests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGuest: (eventId: string, id: string) =>
    request<unknown>(`/events/${eventId}/guests/${id}`, { method: 'DELETE' }),

  // Public RSVP (no auth)
  submitRsvp: (eventId: string, data: unknown) =>
    fetch(`${BASE}/events/${eventId}/rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),

  // Check-in
  getCheckins: (eventId: string) => request<unknown[]>(`/events/${eventId}/checkins`),
  toggleCheckin: (eventId: string, guestId: string, location: string) =>
    request<unknown>(`/events/${eventId}/checkins`, {
      method: 'POST',
      body: JSON.stringify({ guest_id: guestId, location })
    }),

  // Tasks
  getTasks: (eventId: string) => request<unknown[]>(`/events/${eventId}/tasks`),
  createTask: (eventId: string, data: unknown) =>
    request<unknown>(`/events/${eventId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (eventId: string, id: string, data: unknown) =>
    request<unknown>(`/events/${eventId}/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (eventId: string, id: string) =>
    request<unknown>(`/events/${eventId}/tasks/${id}`, { method: 'DELETE' }),

  // Schedule
  getSchedule: (eventId: string) => request<unknown[]>(`/events/${eventId}/schedule`),
  createScheduleItem: (eventId: string, data: unknown) =>
    request<unknown>(`/events/${eventId}/schedule`, { method: 'POST', body: JSON.stringify(data) }),
  updateScheduleItem: (eventId: string, id: string, data: unknown) =>
    request<unknown>(`/events/${eventId}/schedule/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteScheduleItem: (eventId: string, id: string) =>
    request<unknown>(`/events/${eventId}/schedule/${id}`, { method: 'DELETE' }),

  // Finance
  getTransactions: (eventId: string) => request<unknown[]>(`/events/${eventId}/finance`),
  createTransaction: (eventId: string, data: unknown) =>
    request<unknown>(`/events/${eventId}/finance`, { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (eventId: string, id: string, data: unknown) =>
    request<unknown>(`/events/${eventId}/finance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTransaction: (eventId: string, id: string) =>
    request<unknown>(`/events/${eventId}/finance/${id}`, { method: 'DELETE' }),

  // Locations
  getLocations: (eventId: string) => request<unknown[]>(`/events/${eventId}/locations`),
  createLocation: (eventId: string, data: unknown) =>
    request<unknown>(`/events/${eventId}/locations`, { method: 'POST', body: JSON.stringify(data) }),
  updateLocation: (eventId: string, id: string, data: unknown) =>
    request<unknown>(`/events/${eventId}/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLocation: (eventId: string, id: string) =>
    request<unknown>(`/events/${eventId}/locations/${id}`, { method: 'DELETE' }),

  // Conflict event
  getConflictSchedule: (eventId: string) => request<unknown[]>(`/events/${eventId}/conflict-schedule`),
  createConflictItem: (eventId: string, data: unknown) =>
    request<unknown>(`/events/${eventId}/conflict-schedule`, { method: 'POST', body: JSON.stringify(data) }),
  updateConflictItem: (eventId: string, id: string, data: unknown) =>
    request<unknown>(`/events/${eventId}/conflict-schedule/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteConflictItem: (eventId: string, id: string) =>
    request<unknown>(`/events/${eventId}/conflict-schedule/${id}`, { method: 'DELETE' }),

  // Organisers
  getOrganisers: (eventId: string) => request<unknown[]>(`/events/${eventId}/organisers`),
  createOrganiser: (eventId: string, data: unknown) =>
    request<unknown>(`/events/${eventId}/organisers`, { method: 'POST', body: JSON.stringify(data) }),
  updateOrganiser: (eventId: string, id: string, data: unknown) =>
    request<unknown>(`/events/${eventId}/organisers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteOrganiser: (eventId: string, id: string) =>
    request<unknown>(`/events/${eventId}/organisers/${id}`, { method: 'DELETE' })
}
