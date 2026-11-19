import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { translations } from '../i18n/translations'
import { clearPinLock, hasPinLock } from '../services/security'
import { usePinLock } from './usePinLock'

const en = translations.en
const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>

afterEach(() => clearPinLock())

describe('usePinLock', () => {
  it('meldet eine zu kurze PIN und speichert nichts', async () => {
    // Arrange
    const onMessage = vi.fn()
    const { result } = renderHook(() => usePinLock(onMessage), { wrapper })
    act(() => result.current.setPin('12'))

    // Act
    await act(async () => result.current.savePin())

    // Assert
    expect(onMessage).toHaveBeenCalledWith(en.pinTooShort)
    expect(hasPinLock()).toBe(false)
    expect(result.current.pin).toBe('12')
  })

  it('speichert eine gültige PIN, leert das Feld und meldet Erfolg', async () => {
    // Arrange
    const onMessage = vi.fn()
    const { result } = renderHook(() => usePinLock(onMessage), { wrapper })
    act(() => result.current.setPin('1234'))

    // Act
    await act(async () => result.current.savePin())

    // Assert
    expect(hasPinLock()).toBe(true)
    expect(result.current.pin).toBe('')
    expect(onMessage).toHaveBeenCalledWith(en.pinEnabled)
  })

  it('entfernt die PIN und meldet das', async () => {
    // Arrange
    const onMessage = vi.fn()
    const { result } = renderHook(() => usePinLock(onMessage), { wrapper })
    act(() => result.current.setPin('1234'))
    await act(async () => result.current.savePin())

    // Act
    act(() => result.current.removePin())

    // Assert
    expect(hasPinLock()).toBe(false)
    expect(onMessage).toHaveBeenLastCalledWith(en.pinDisabled)
  })
})
