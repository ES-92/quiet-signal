import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { translations } from '../i18n/translations'
import { useShortcutCopy } from './useShortcutCopy'

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>

describe('useShortcutCopy', () => {
  it('bestätigt das Kopieren des Links', async () => {
    // Arrange
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })
    const { result } = renderHook(() => useShortcutCopy(), { wrapper })

    // Act
    await act(async () => result.current.copy('audio'))

    // Assert
    expect(result.current.message).toBe(translations.en.shortcutCopied)
  })

  it('zeigt den Link selbst, wenn die Zwischenablage fehlschlägt', async () => {
    // Arrange
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('x')) }, configurable: true })
    const { result } = renderHook(() => useShortcutCopy(), { wrapper })

    // Act
    await act(async () => result.current.copy('photo'))

    // Assert
    expect(result.current.message).toMatch(/\/today\?capture=photo$/)
  })
})
