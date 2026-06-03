import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Event } from '../lib/types'

interface EventStore {
  currentEvent: Event | null
  events: Event[]
  setCurrentEvent: (event: Event | null) => void
  setEvents: (events: Event[]) => void
}

export const useEventStore = create<EventStore>()(
  persist(
    (set) => ({
      currentEvent: null,
      events: [],
      setCurrentEvent: (event) => set({ currentEvent: event }),
      setEvents: (events) => set({ events })
    }),
    {
      name: 'bonfire-event',
      partialize: (state) => ({ currentEvent: state.currentEvent })
    }
  )
)
