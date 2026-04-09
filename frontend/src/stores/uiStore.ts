import { create } from 'zustand'

import type { DomainId } from '@/types/domain'
import { isRtlLocale } from '@/utils/format'

export type UiDirection = 'ltr' | 'rtl'
export type UiDensity = 'comfortable' | 'compact'

interface UiState {
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  lastDomain: DomainId
  locale: string
  currency: string
  direction: UiDirection
  density: UiDensity
  toggleTheme: () => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebarCollapsed: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setLastDomain: (domain: DomainId) => void
  setLocale: (locale: string) => void
  setCurrency: (currency: string) => void
  setDirection: (direction: UiDirection) => void
  setDensity: (density: UiDensity) => void
}

const getInitialTheme = (): 'light' | 'dark' => {
  const stored = localStorage.getItem('mathia-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const getInitialLocale = () => localStorage.getItem('mathia-locale') || navigator.language || 'en-KE'
const getInitialCurrency = () => localStorage.getItem('mathia-currency') || 'KES'

const getInitialDirection = (locale: string): UiDirection => {
  const stored = localStorage.getItem('mathia-direction')
  if (stored === 'ltr' || stored === 'rtl') return stored
  return isRtlLocale(locale) ? 'rtl' : 'ltr'
}

const getInitialDensity = (): UiDensity =>
  localStorage.getItem('mathia-ui-density') === 'compact' ? 'compact' : 'comfortable'

export function applyUiPreferences({
  theme,
  locale,
  direction,
  density,
}: {
  theme: 'light' | 'dark'
  locale: string
  direction: UiDirection
  density: UiDensity
}) {
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.setAttribute('data-ui-density', density)
  document.documentElement.lang = locale
  document.documentElement.dir = direction
}

const initialTheme = getInitialTheme()
const initialLocale = getInitialLocale()
const initialCurrency = getInitialCurrency()
const initialDirection = getInitialDirection(initialLocale)
const initialDensity = getInitialDensity()

applyUiPreferences({
  theme: initialTheme,
  locale: initialLocale,
  direction: initialDirection,
  density: initialDensity,
})

export const useUiStore = create<UiState>((set) => ({
  theme: initialTheme,
  sidebarOpen: false,
  sidebarCollapsed: localStorage.getItem('mathia-sidebar-collapsed') === 'true',
  lastDomain: (localStorage.getItem('mathia-last-domain') as DomainId) || 'security',
  locale: initialLocale,
  currency: initialCurrency,
  direction: initialDirection,
  density: initialDensity,
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light'
      localStorage.setItem('mathia-theme', next)
      applyUiPreferences({
        theme: next,
        locale: state.locale,
        direction: state.direction,
        density: state.density,
      })
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
    set((state) => (state.sidebarCollapsed === collapsed ? state : { sidebarCollapsed: collapsed }))
  },
  setLastDomain: (domain) => {
    if (localStorage.getItem('mathia-last-domain') === domain) return
    localStorage.setItem('mathia-last-domain', domain)
    set((state) => (state.lastDomain === domain ? state : { lastDomain: domain }))
  },
  setLocale: (locale) =>
    set((state) => {
      localStorage.setItem('mathia-locale', locale)
      applyUiPreferences({
        theme: state.theme,
        locale,
        direction: state.direction,
        density: state.density,
      })
      return { locale }
    }),
  setCurrency: (currency) => {
    localStorage.setItem('mathia-currency', currency)
    set({ currency })
  },
  setDirection: (direction) =>
    set((state) => {
      localStorage.setItem('mathia-direction', direction)
      applyUiPreferences({
        theme: state.theme,
        locale: state.locale,
        direction,
        density: state.density,
      })
      return { direction }
    }),
  setDensity: (density) =>
    set((state) => {
      localStorage.setItem('mathia-ui-density', density)
      applyUiPreferences({
        theme: state.theme,
        locale: state.locale,
        direction: state.direction,
        density,
      })
      return { density }
    }),
}))
