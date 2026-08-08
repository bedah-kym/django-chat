import { create } from 'zustand'

type Density = 'comfortable' | 'compact' | 'spacious'

interface SettingsState {
  fontSize: number
  messageDensity: Density
  soundEnabled: boolean
  tourSeen: boolean
  setFontSize: (size: number) => void
  setMessageDensity: (d: Density) => void
  toggleSound: () => void
  markTourSeen: () => void
}

const STORAGE_KEY = 'mathia_settings'

function loadSettings(): Partial<SettingsState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveSettings(state: Partial<SettingsState>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function applySettings(fontSize: number, density: Density) {
  document.documentElement.style.setProperty('--chat-font-size', `${fontSize}px`)
  document.documentElement.setAttribute('data-message-density', density)
}

const saved = loadSettings()
const initialFontSize = saved.fontSize ?? 15
const initialDensity = saved.messageDensity ?? 'comfortable'

// Apply immediately on load
applySettings(initialFontSize, initialDensity)

export const useSettingsStore = create<SettingsState>((set, get) => ({
  fontSize: initialFontSize,
  messageDensity: initialDensity,
  soundEnabled: saved.soundEnabled ?? true,
  tourSeen: saved.tourSeen ?? false,

  setFontSize: (size) => {
    set({ fontSize: size })
    applySettings(size, get().messageDensity)
    saveSettings({ ...get(), fontSize: size })
  },
  setMessageDensity: (d) => {
    set({ messageDensity: d })
    applySettings(get().fontSize, d)
    saveSettings({ ...get(), messageDensity: d })
  },
  toggleSound: () => {
    const next = !get().soundEnabled
    set({ soundEnabled: next })
    saveSettings({ ...get(), soundEnabled: next })
  },
  markTourSeen: () => {
    set({ tourSeen: true })
    saveSettings({ ...get(), tourSeen: true })
  },
}))
