import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { clearPinLock, setPinLock } from '../services/security'
import { useSecurityStatus } from './useSecurityStatus'

afterEach(() => clearPinLock())

describe('useSecurityStatus', () => {
  it('liefert offenen Schutz ohne PIN und Tresor', () => {
    // Arrange / Act
    const { result } = renderHook(() => useSecurityStatus())

    // Assert
    expect(result.current).toEqual({ pinEnabled: false, encryptionEnabled: false, encryptionUnlocked: true })
  })

  it('aktualisiert sich, wenn der Sicherheitsdienst eine Änderung meldet', async () => {
    // Arrange
    const { result } = renderHook(() => useSecurityStatus())

    // Act
    await act(async () => {
      await setPinLock('1234')
    })

    // Assert
    expect(result.current.pinEnabled).toBe(true)
  })
})
