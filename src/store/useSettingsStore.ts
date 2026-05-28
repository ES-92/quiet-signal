import { create } from 'zustand'

export type DailyMode = 'balanced' | 'random'
export type AppTheme = 'light' | 'dark'

interface AppSettings {
  dailyCount: number
  dailyMode: DailyMode
  theme: AppTheme
  reminderEnabled: boolean
  reminderTime: string
  setDailyCount: (dailyCount: number) => void
  setDailyMode: (dailyMode: DailyMode) => void
  setTheme: (theme: AppTheme) => void
  setReminderEnabled: (reminderEnabled: boolean) => void
  setReminderTime: (reminderTime: string) => void
}

const storageKey = 'commonplace-review-settings'

type Persisted = Pick<AppSettings, 'dailyCount' | 'dailyMode' | 'theme' | 'reminderEnabled' | 'reminderTime'>

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

function loadSettings(): Persisted {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<AppSettings>
    const theme = stored.theme === 'light' || stored.theme === 'dark' ? stored.theme : preferredTheme()
    applyTheme(theme)
    return {
      dailyCount: stored.dailyCount && [3, 5, 10, 15].includes(stored.dailyCount) ? stored.dailyCount : 5,
      dailyMode: (stored.dailyMode === 'random' ? 'random' : 'balanced') as DailyMode,
      theme,
      reminderEnabled: stored.reminderEnabled === true,
      reminderTime: typeof stored.reminderTime === 'string' && timePattern.test(stored.reminderTime) ? stored.reminderTime : '08:00'
    }
  } catch {
    const theme = preferredTheme()
    applyTheme(theme)
    return { dailyCount: 5, dailyMode: 'balanced', theme, reminderEnabled: false, reminderTime: '08:00' }
  }
}

function persist(settings: Persisted) {
  localStorage.setItem(storageKey, JSON.stringify(settings))
}

export const useSettingsStore = create<AppSettings>((set, get) => ({
  ...loadSettings(),
  setDailyCount: (dailyCount) => {
    set({ dailyCount })
    persist(snapshot(get(), { dailyCount }))
  },
  setDailyMode: (dailyMode) => {
    set({ dailyMode })
    persist(snapshot(get(), { dailyMode }))
  },
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
    persist(snapshot(get(), { theme }))
  },
  setReminderEnabled: (reminderEnabled) => {
    set({ reminderEnabled })
    persist(snapshot(get(), { reminderEnabled }))
  },
  setReminderTime: (reminderTime) => {
    set({ reminderTime })
    persist(snapshot(get(), { reminderTime }))
  }
}))

function snapshot(state: AppSettings, patch: Partial<Persisted>): Persisted {
  return {
    dailyCount: state.dailyCount,
    dailyMode: state.dailyMode,
    theme: state.theme,
    reminderEnabled: state.reminderEnabled,
    reminderTime: state.reminderTime,
    ...patch
  }
}

function preferredTheme(): AppTheme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: AppTheme) {
  document.documentElement.classList.toggle('theme-dark', theme === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#141312' : '#f7f4ef')
}
