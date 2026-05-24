import { create } from 'zustand'

export type DailyMode = 'balanced' | 'random'

interface AppSettings {
  dailyCount: number
  dailyMode: DailyMode
  setDailyCount: (dailyCount: number) => void
  setDailyMode: (dailyMode: DailyMode) => void
}

const storageKey = 'commonplace-review-settings'

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<AppSettings>
    return {
      dailyCount: stored.dailyCount && [3, 5, 10, 15].includes(stored.dailyCount) ? stored.dailyCount : 5,
      dailyMode: (stored.dailyMode === 'random' ? 'random' : 'balanced') as DailyMode
    }
  } catch {
    return { dailyCount: 5, dailyMode: 'balanced' as DailyMode }
  }
}

function persist(settings: Pick<AppSettings, 'dailyCount' | 'dailyMode'>) {
  localStorage.setItem(storageKey, JSON.stringify(settings))
}

export const useSettingsStore = create<AppSettings>((set, get) => ({
  ...loadSettings(),
  setDailyCount: (dailyCount) => {
    set({ dailyCount })
    persist({ dailyCount, dailyMode: get().dailyMode })
  },
  setDailyMode: (dailyMode) => {
    set({ dailyMode })
    persist({ dailyCount: get().dailyCount, dailyMode })
  }
}))
