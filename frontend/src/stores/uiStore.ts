import { create } from 'zustand'

import type { DomainId } from '@/types/domain'

interface UiState {
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  lastDomain: DomainId
  toggleTheme: () => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebarCollapsed: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setLastDomain: (domain: DomainId) => void
}

const getInitialTheme = (): 'light' | 'dark' => {
  const stored = localStorage.getItem('mathia-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useUiStore = create<UiState>((set) => ({
  theme: getInitialTheme(),
  sidebarOpen: false,
  sidebarCollapsed: localStorage.getItem('mathia-sidebar-collapsed') === 'true',
  lastDomain: (localStorage.getItem('mathia-last-domain') as DomainId) || 'security',
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light'
      localStorage.setItem('mathia-theme', next)
      document.documentElement.setAttribute('data-theme', next)
      return { theme: next }
    }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebarCollapsed: () =>
    set((state) => {
      const next = !state.sidebarCollapsed
      localStorage.setItem('mathia-sidebar-collapsed', String(next))
      return { sidebarCollapsed: next }
    }),
  setSidebarCollapsed: (collapsed) => {
    localStorage.setItem('mathia-sidebar-collapsed', String(collapsed))
    set((state) => state.sidebarCollapsed === collapsed ? state : { sidebarCollapsed: collapsed })
  },
  setLastDomain: (domain) => {
    if (localStorage.getItem('mathia-last-domain') === domain) return
    localStorage.setItem('mathia-last-domain', domain)
    set((state) => state.lastDomain === domain ? state : { lastDomain: domain })
  },
}))
