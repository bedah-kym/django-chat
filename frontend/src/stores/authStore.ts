import { create } from 'zustand'
import { login, setAuthToken, getAuthToken } from '@/api/client'
import { fetchCurrentUser } from '@/api/user'

interface AuthState {
  isAuthenticated: boolean
  username: string | null
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  isLoading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  restoreSession: () => void
  fetchUserProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!getAuthToken(),
  username: null,
  email: null,
  displayName: null,
  avatarUrl: null,
  isLoading: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      await login(username, password)
      set({ isAuthenticated: true, username, isLoading: false })
      try {
        const user = await fetchCurrentUser()
        if (user.auth_token) setAuthToken(user.auth_token)
        set({
          username: user.username,
          email: user.email,
          displayName: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username,
          avatarUrl: user.avatar ?? null,
        })
      } catch {
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Login failed', isLoading: false })
      throw err
    }
  },

  logout: () => {
    setAuthToken(null)
    set({ isAuthenticated: false, username: null, email: null, displayName: null, avatarUrl: null })
  },

  restoreSession: () => {
    const token = getAuthToken()
    if (token) {
      set({ isAuthenticated: true })
    }
  },

  fetchUserProfile: async () => {
    set({ isLoading: true, error: null })
    try {
      const user = await fetchCurrentUser()
      if (user.auth_token) setAuthToken(user.auth_token)
      set({
        isAuthenticated: true,
        username: user.username,
        email: user.email,
        displayName: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username,
        avatarUrl: user.avatar ?? null,
        isLoading: false,
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Profile unavailable', isLoading: false })
      throw err
    }
  },
}))

// Auto-login with dev credentials for local development
let authReadyPromise: Promise<void> | null = null

export function ensureAuth(): Promise<void> {
  if (getAuthToken()) {
    return useAuthStore.getState().fetchUserProfile().catch(() => {})
  }

  if (!import.meta.env.DEV) {
    return useAuthStore.getState().fetchUserProfile().catch((err) => {
      const next = `${window.location.pathname}${window.location.search}`
      window.location.assign(`/accounts/login/?next=${encodeURIComponent(next)}`)
      throw err
    })
  }

  if (!authReadyPromise) {
    authReadyPromise = useAuthStore.getState().login('alex', 'mathia123').catch(() => {})
  }
  return authReadyPromise
}

if (import.meta.env.DEV && !getAuthToken()) {
  ensureAuth()
}
