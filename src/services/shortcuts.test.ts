import { describe, expect, it } from 'vitest'
import { shortcutUrl } from './shortcuts'

describe('shortcutUrl', () => {
  it.each(['text', 'photo', 'audio'] as const)('führt den %s-Link über Heute ins Capture-Sheet', (mode) => {
    // Act
    const url = new URL(shortcutUrl(mode))

    // Assert
    expect(url.pathname + url.search).toBe(`/today?capture=${mode}`)
  })
})
