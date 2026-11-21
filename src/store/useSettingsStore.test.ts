import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storageKey = 'quiet-signal-review-settings'

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

afterEach(() => {
  localStorage.clear()
})

describe('useSettingsStore', () => {
  it('ignores a legacy dailyMode value in storage and drops it on the next save', async () => {
    // Arrange
    localStorage.setItem(storageKey, JSON.stringify({ dailyCount: 10, dailyMode: 'random' }))

    // Act
    const { useSettingsStore } = await import('./useSettingsStore')
    useSettingsStore.getState().setDailyCount(15)

    // Assert
    expect(useSettingsStore.getState()).not.toHaveProperty('dailyMode')
    expect(JSON.parse(localStorage.getItem(storageKey) ?? '{}')).not.toHaveProperty('dailyMode')
  })
})
