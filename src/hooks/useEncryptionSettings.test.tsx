import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, upsertQuotes } from '../db/database'
import { I18nProvider } from '../i18n/I18nProvider'
import { translations } from '../i18n/translations'
import { disableEncryptionRecord, isEncryptionEnabled, lockEncryption } from '../services/security'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useToastStore } from '../store/useToastStore'
import { makeQuote, resetFactories } from '../test/factories'
import { useEncryptionSettings } from './useEncryptionSettings'

const en = translations.en
const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [] })
  useBookStore.setState({ books: [] })
  useToastStore.setState({ toast: null })
})

afterEach(() => {
  vi.restoreAllMocks()
  lockEncryption()
  disableEncryptionRecord()
})

describe('useEncryptionSettings', () => {
  it('lehnt ein zu kurzes Passwort ab, ohne die Sperre zu setzen', async () => {
    // Arrange
    const onMessage = vi.fn()
    const { result } = renderHook(() => useEncryptionSettings(onMessage), { wrapper })
    act(() => result.current.setPassword('kurz'))

    // Act
    await act(async () => result.current.enable())

    // Assert
    expect(onMessage).toHaveBeenCalledWith(en.passwordTooShort)
    expect(isEncryptionEnabled()).toBe(false)
    expect(result.current.busy).toBe(false)
  })

  it('verschlüsselt beim Aktivieren alle Zeilen und leert das Passwort', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ text: 'Geheim' })])
    const onMessage = vi.fn()
    const { result } = renderHook(() => useEncryptionSettings(onMessage), { wrapper })
    act(() => result.current.setPassword('passwort-123'))

    // Act
    await act(async () => result.current.enable())

    // Assert
    expect((await db.quotes.toArray()).every((row) => row.encrypted === true)).toBe(true)
    expect(result.current.password).toBe('')
    expect(result.current.busy).toBe(false)
    expect(onMessage).toHaveBeenCalledWith(en.encryptionEnabled)
  })

  it('zeigt beim Aktivieren eines Fehlers einen Toast und setzt busy zurück', async () => {
    // Arrange
    vi.spyOn(db, 'transaction').mockRejectedValue(new Error('Schreibfehler'))
    const { result } = renderHook(() => useEncryptionSettings(vi.fn()), { wrapper })
    act(() => result.current.setPassword('passwort-123'))

    // Act
    await act(async () => result.current.enable())

    // Assert
    expect(useToastStore.getState().toast?.message).toBe(en.encryptionEnableFailed)
    expect(result.current.busy).toBe(false)
    expect(result.current.password).toBe('passwort-123')
  })

  it('entfernt die Verschlüsselung und schreibt Klartext zurück', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ text: 'Klartext' })])
    const onMessage = vi.fn()
    const { result } = renderHook(() => useEncryptionSettings(onMessage), { wrapper })
    act(() => result.current.setPassword('passwort-123'))
    await act(async () => result.current.enable())
    act(() => result.current.setPassword('passwort-123'))

    // Act
    await act(async () => result.current.disable())

    // Assert
    expect(isEncryptionEnabled()).toBe(false)
    expect((await db.quotes.toArray()).map((row) => row.text)).toEqual(['Klartext'])
    expect(onMessage).toHaveBeenLastCalledWith(en.encryptionDisabled)
  })

  it('meldet beim gesperrten Tresor ein falsches Passwort', async () => {
    // Arrange
    const onMessage = vi.fn()
    const { result } = renderHook(() => useEncryptionSettings(onMessage), { wrapper })
    act(() => result.current.setPassword('passwort-123'))
    await act(async () => result.current.enable())
    lockEncryption()
    act(() => result.current.setPassword('falsch-falsch'))

    // Act
    await act(async () => result.current.disable())

    // Assert
    expect(onMessage).toHaveBeenLastCalledWith(en.wrongPassword)
    expect(isEncryptionEnabled()).toBe(true)
  })

  it('zeigt beim Entfernen eines Fehlers einen Toast', async () => {
    // Arrange
    const { result } = renderHook(() => useEncryptionSettings(vi.fn()), { wrapper })
    act(() => result.current.setPassword('passwort-123'))
    await act(async () => result.current.enable())
    vi.spyOn(db, 'transaction').mockRejectedValue(new Error('Schreibfehler'))

    // Act
    await act(async () => result.current.disable())

    // Assert
    expect(useToastStore.getState().toast?.message).toBe(en.encryptionDisableFailed)
    expect(isEncryptionEnabled()).toBe(true)
    expect(result.current.busy).toBe(false)
  })
})
