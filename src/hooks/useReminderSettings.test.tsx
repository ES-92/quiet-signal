import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { translations } from '../i18n/translations'
import { useSettingsStore } from '../store/useSettingsStore'
import { useReminderSettings } from './useReminderSettings'

const reminder = vi.hoisted(() => ({
  isNotificationSupported: vi.fn(() => true),
  notificationPermission: vi.fn<() => NotificationPermission>(() => 'granted'),
  requestNotificationPermission: vi.fn<() => Promise<NotificationPermission>>(async () => 'granted'),
  enableReminder: vi.fn(async () => ({ ok: true, background: true })),
  disableReminder: vi.fn(async () => undefined),
  refreshReminderConfig: vi.fn(async () => undefined),
  sendTestReminder: vi.fn(async () => true)
}))
vi.mock('../services/reminder', () => reminder)

const en = translations.en
const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>

beforeEach(() => {
  useSettingsStore.setState({ reminderEnabled: false, reminderTime: '08:00' })
  reminder.isNotificationSupported.mockReturnValue(true)
  reminder.notificationPermission.mockReturnValue('granted')
  reminder.requestNotificationPermission.mockResolvedValue('granted')
  reminder.enableReminder.mockResolvedValue({ ok: true, background: true })
  reminder.refreshReminderConfig.mockClear()
  reminder.sendTestReminder.mockClear()
})

describe('useReminderSettings', () => {
  it('meldet fehlende Unterstützung, ohne etwas zu aktivieren', async () => {
    // Arrange
    reminder.isNotificationSupported.mockReturnValue(false)
    const { result } = renderHook(() => useReminderSettings(), { wrapper })

    // Act
    await act(async () => result.current.toggle(true))

    // Assert
    expect(result.current.message).toBe(en.reminderUnsupported)
    expect(result.current.reminderEnabled).toBe(false)
  })

  it('aktiviert die Erinnerung und meldet den Status', async () => {
    // Arrange
    const { result } = renderHook(() => useReminderSettings(), { wrapper })

    // Act
    await act(async () => result.current.toggle(true))

    // Assert
    expect(result.current.reminderEnabled).toBe(true)
    expect(result.current.message).toBe(en.reminderActive)
  })

  it('bleibt bei verweigerter Berechtigung aus', async () => {
    // Arrange
    reminder.enableReminder.mockResolvedValue({ ok: false, background: false })
    const { result } = renderHook(() => useReminderSettings(), { wrapper })

    // Act
    await act(async () => result.current.toggle(true))

    // Assert
    expect(result.current.reminderEnabled).toBe(false)
    expect(result.current.message).toBe(en.reminderDenied)
  })

  it('deaktiviert die Erinnerung und leert die Meldung', async () => {
    // Arrange
    const { result } = renderHook(() => useReminderSettings(), { wrapper })
    await act(async () => result.current.toggle(true))

    // Act
    await act(async () => result.current.toggle(false))

    // Assert
    expect(result.current.reminderEnabled).toBe(false)
    expect(result.current.message).toBe('')
  })

  it('aktualisiert die Konfiguration bei neuer Uhrzeit nur, wenn aktiv', async () => {
    // Arrange
    const { result } = renderHook(() => useReminderSettings(), { wrapper })

    // Act
    await act(async () => result.current.changeTime('07:15'))

    // Assert
    expect(result.current.reminderTime).toBe('07:15')
    expect(reminder.refreshReminderConfig).not.toHaveBeenCalled()
  })

  it('sendet den Test erst nach erteilter Berechtigung', async () => {
    // Arrange
    reminder.notificationPermission.mockReturnValue('default')
    reminder.requestNotificationPermission.mockResolvedValue('denied')
    const { result } = renderHook(() => useReminderSettings(), { wrapper })

    // Act
    await act(async () => result.current.sendTest())

    // Assert
    expect(reminder.sendTestReminder).not.toHaveBeenCalled()
    expect(result.current.message).toBe(en.reminderDenied)
  })
})
