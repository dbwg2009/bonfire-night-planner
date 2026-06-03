import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Organiser } from '../lib/types'

interface AuthStore {
  organiser: Organiser | null
  token: string | null
  login: (organiser: Organiser, token: string) => void
  logout: () => void
  hasPermission: (key: keyof Organiser['permissions']) => boolean
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      organiser: null,
      token: null,
      login: (organiser, token) => {
        localStorage.setItem('bonfire_token', token)
        set({ organiser, token })
      },
      logout: () => {
        localStorage.removeItem('bonfire_token')
        set({ organiser: null, token: null })
      },
      hasPermission: (key) => {
        const { organiser } = get()
        if (!organiser) return false
        if (organiser.is_owner) return true
        return organiser.permissions[key] ?? false
      }
    }),
    {
      name: 'bonfire-auth',
      partialize: (state) => ({ organiser: state.organiser, token: state.token })
    }
  )
)
