import { create } from 'zustand'

interface UiState {
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  toggleTheme: () => void
  setSidebarOpen: (open: boolean) => void
}

const getInitialTheme = (): 'light' | 'dark' => {
  const stored = localStorage.getItem('mathia-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useUiStore = create<UiState>((set) => ({
  theme: getInitialTheme(),
  sidebarOpen: false,
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light'
      localStorage.setItem('mathia-theme', next)
      document.documentElement.setAttribute('data-theme', next)
      return { theme: next }
    }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
