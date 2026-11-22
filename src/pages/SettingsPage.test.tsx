import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, encryptAllQuotes, listBooks, listQuotes, upsertBooks, upsertQuotes } from '../db/database'
import { translations } from '../i18n/translations'
import { getLastBackupAt } from '../services/backup'
import { onboardingEventName } from '../services/onboarding'
import {
  clearPinLock,
  disableEncryptionRecord,
  enableEncryption,
  hasPinLock,
  isEncryptionEnabled,
  isEncryptionUnlocked,
  lockEncryption
} from '../services/security'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { useToastStore } from '../store/useToastStore'
import { makeBook, makeQuote, resetFactories } from '../test/factories'
import { renderWithProviders } from '../test/render'
import pkg from '../../package.json'
import { SettingsPage } from './SettingsPage'

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

const download = vi.hoisted(() => vi.fn())
vi.mock('../services/importExport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/importExport')>()),
  downloadText: download
}))

const en = translations.en

function resetSettings() {
  useSettingsStore.setState({
    dailyCount: 5,
    theme: 'light',
    reminderEnabled: false,
    reminderTime: '08:00'
  })
}

beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
  useQuoteStore.setState({ quotes: [] })
  useBookStore.setState({ books: [] })
  useToastStore.setState({ toast: null })
  resetSettings()
  reminder.isNotificationSupported.mockReturnValue(true)
  reminder.notificationPermission.mockReturnValue('granted')
  reminder.requestNotificationPermission.mockResolvedValue('granted')
  reminder.enableReminder.mockResolvedValue({ ok: true, background: true })
  reminder.refreshReminderConfig.mockClear()
  reminder.disableReminder.mockClear()
  reminder.sendTestReminder.mockClear()
  download.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
  clearPinLock()
  lockEncryption()
  disableEncryptionRecord()
})

describe('SettingsPage: Sprache, Darstellung, Tagesansicht', () => {
  it('wechselt die Sprache über die Auswahl', async () => {
    // Arrange
    renderWithProviders(<SettingsPage />)

    // Act
    fireEvent.change(screen.getByDisplayValue('English'), { target: { value: 'de' } })

    // Assert
    expect(await screen.findByRole('heading', { name: translations.de.settings })).toBeInTheDocument()
  })

  it('schaltet das Design zwischen hell und dunkel um', () => {
    // Arrange
    renderWithProviders(<SettingsPage />)
    const toggle = screen.getByRole('button', { name: new RegExp(en.lightMode) })

    // Act
    fireEvent.click(toggle)

    // Assert
    expect(useSettingsStore.getState().theme).toBe('dark')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })

  it('speichert die Anzahl der Tageshighlights und bietet keinen Auswahlmodus mehr', () => {
    // Arrange
    renderWithProviders(<SettingsPage />)

    // Act
    fireEvent.change(screen.getByLabelText(en.highlightsPerDay), { target: { value: '10' } })

    // Assert
    expect(useSettingsStore.getState().dailyCount).toBe(10)
    expect(screen.queryByText('Selection style')).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'More random' })).not.toBeInTheDocument()
  })
})

describe('SettingsPage: Hinweise', () => {
  function notes() {
    return screen.queryAllByRole('note')
  }

  async function secureAndBackedUp() {
    await enableEncryption('passwort-123')
    localStorage.setItem('quiet-signal-last-backup-at', new Date().toISOString())
  }

  it('zeigt weder Zähl-Kacheln noch das alte Statusband', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ status: 'signal' }), makeQuote({ status: 'rest' }), makeQuote({ status: 'inbox' })])
    await upsertBooks([makeBook()])

    // Act
    renderWithProviders(<SettingsPage />)
    await screen.findByText(en.storedLocally.replace('{count}', '3'))

    // Assert
    expect(screen.queryByText(/at rest/)).not.toBeInTheDocument()
    expect(screen.queryByText('Local status')).not.toBeInTheDocument()
  })

  it('zeigt keinen Hinweis, wenn ein frisches Backup besteht und der Schutz aktiv ist', async () => {
    // Arrange
    await upsertQuotes([makeQuote()])
    await secureAndBackedUp()

    // Act
    renderWithProviders(<SettingsPage />)
    await screen.findByText(en.backupToday)

    // Assert
    expect(notes()).toHaveLength(0)
  })

  it('warnt vor einem fehlenden Backup und lädt es über die Aktion im Hinweis herunter', async () => {
    // Arrange
    await upsertQuotes([makeQuote()])
    await enableEncryption('passwort-123')
    renderWithProviders(<SettingsPage />)
    const notice = (await screen.findByText(en.noticeNoBackup)).closest('[role="note"]') as HTMLElement

    // Act
    fireEvent.click(within(notice).getByRole('button', { name: en.backupNow }))

    // Assert
    expect(download).toHaveBeenCalledTimes(1)
    expect(getLastBackupAt()).toBeDefined()
    await waitFor(() => expect(notes()).toHaveLength(0))
  })

  it('warnt bei einem überfälligen Backup mit dessen Alter', async () => {
    // Arrange
    await upsertQuotes([makeQuote()])
    await enableEncryption('passwort-123')
    localStorage.setItem('quiet-signal-last-backup-at', new Date(Date.now() - 20 * 86_400_000).toISOString())

    // Act
    renderWithProviders(<SettingsPage />)

    // Assert
    expect(await screen.findByText('Your last backup is 20 days old.')).toBeInTheDocument()
    expect(screen.queryByText(en.noticeNoBackup)).not.toBeInTheDocument()
  })

  it('warnt nicht vor einem Backup, solange nichts gesammelt wurde', async () => {
    // Arrange
    await enableEncryption('passwort-123')

    // Act
    renderWithProviders(<SettingsPage />)
    await screen.findByText(en.backupEmpty)

    // Assert
    expect(notes()).toHaveLength(0)
  })

  it('warnt bei fehlendem Schutz und öffnet über die Aktion den Sicherheitsbereich', async () => {
    // Arrange
    localStorage.setItem('quiet-signal-last-backup-at', new Date().toISOString())
    renderWithProviders(<SettingsPage />)
    const securityPanel = screen.getByText(en.securityHelp).closest('details') as HTMLDetailsElement
    expect(securityPanel.open).toBe(false)
    const notice = screen.getByText(en.noticeProtectionOff).closest('[role="note"]') as HTMLElement

    // Act
    fireEvent.click(within(notice).getByRole('button', { name: en.openSecurity }))

    // Assert
    expect(securityPanel.open).toBe(true)
  })

  it('blendet die Schutz-Warnung aus, sobald eine PIN gesetzt ist', async () => {
    // Arrange
    renderWithProviders(<SettingsPage />)
    expect(screen.getByText(en.noticeProtectionOff)).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText(en.pinPlaceholder), { target: { value: '1234' } })

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.enablePin }))

    // Assert
    await waitFor(() => expect(screen.queryByText(en.noticeProtectionOff)).not.toBeInTheDocument())
  })

  it('blendet die Schutz-Warnung aus, sobald der Tresor aktiv ist', async () => {
    // Arrange
    await enableEncryption('passwort-123')

    // Act
    renderWithProviders(<SettingsPage />)
    await screen.findByText(en.backupEmpty)

    // Assert
    expect(screen.queryByText(en.noticeProtectionOff)).not.toBeInTheDocument()
  })
})

describe('SettingsPage: Backup', () => {
  it.each([
    [0, en.backupToday],
    [1, 'Last backup 1 day ago.'],
    [3, 'Last backup 3 days ago.']
  ])('nennt das Alter des letzten Backups nach %i Tag(en) in der richtigen Zahlform', async (days, expected) => {
    // Arrange
    await upsertQuotes([makeQuote()])
    localStorage.setItem('quiet-signal-last-backup-at', new Date(Date.now() - days * 86_400_000 - 60_000).toISOString())

    // Act
    renderWithProviders(<SettingsPage />)

    // Assert
    expect(await screen.findByText(expected)).toBeInTheDocument()
  })

  it('meldet ein leeres Archiv ohne Backup-Hinweis', () => {
    // Arrange / Act
    renderWithProviders(<SettingsPage />)

    // Assert
    expect(screen.getByText(en.backupEmpty)).toBeInTheDocument()
    expect(screen.queryByText(en.noticeNoBackup)).not.toBeInTheDocument()
  })

  it('erstellt ein Backup und merkt sich den Zeitpunkt', async () => {
    // Arrange
    await upsertQuotes([makeQuote()])
    renderWithProviders(<SettingsPage />)
    expect(await screen.findByText(en.backupMissing)).toBeInTheDocument()

    // Act
    fireEvent.click(within(screen.getByText(en.backupMissing).closest('div') as HTMLElement).getByRole('button', { name: en.backupNow }))

    // Assert
    expect(download).toHaveBeenCalledTimes(1)
    expect(getLastBackupAt()).toBeDefined()
    expect(screen.getByText(/^Backup created:/)).toBeInTheDocument()
    expect(screen.getByText(en.backupToday)).toBeInTheDocument()
  })
})

describe('SettingsPage: Erinnerung', () => {
  it('meldet fehlende Browser-Unterstützung', () => {
    // Arrange
    reminder.isNotificationSupported.mockReturnValue(false)
    renderWithProviders(<SettingsPage />)

    // Act
    fireEvent.click(screen.getByLabelText(en.enableReminder))

    // Assert
    expect(screen.getByText(en.reminderUnsupported)).toBeInTheDocument()
    expect(useSettingsStore.getState().reminderEnabled).toBe(false)
  })

  it('aktiviert die Erinnerung und zeigt die Statusmeldung', async () => {
    // Arrange
    renderWithProviders(<SettingsPage />)

    // Act
    fireEvent.click(screen.getByLabelText(en.enableReminder))

    // Assert
    expect(await screen.findByText(en.reminderActive)).toBeInTheDocument()
    expect(useSettingsStore.getState().reminderEnabled).toBe(true)
    expect(reminder.enableReminder).toHaveBeenCalledWith({ time: '08:00', title: en.reminderTitle, body: en.reminderBody })
  })

  it('hängt den Hintergrund-Hinweis an, wenn nur ohne Hintergrund möglich', async () => {
    // Arrange
    reminder.enableReminder.mockResolvedValue({ ok: true, background: false })
    renderWithProviders(<SettingsPage />)

    // Act
    fireEvent.click(screen.getByLabelText(en.enableReminder))

    // Assert
    expect(await screen.findByText(`${en.reminderActive} ${en.reminderBackgroundNote}`)).toBeInTheDocument()
  })

  it('bleibt aus und meldet die Sperre, wenn Benachrichtigungen verweigert werden', async () => {
    // Arrange
    reminder.enableReminder.mockResolvedValue({ ok: false, background: false })
    renderWithProviders(<SettingsPage />)

    // Act
    fireEvent.click(screen.getByLabelText(en.enableReminder))

    // Assert
    expect(await screen.findByText(en.reminderDenied)).toBeInTheDocument()
    expect(useSettingsStore.getState().reminderEnabled).toBe(false)
  })

  it('deaktiviert die Erinnerung und räumt die Meldung auf', async () => {
    // Arrange
    renderWithProviders(<SettingsPage />)
    fireEvent.click(screen.getByLabelText(en.enableReminder))
    await screen.findByText(en.reminderActive)

    // Act
    fireEvent.click(screen.getByLabelText(en.enableReminder))

    // Assert
    await waitFor(() => expect(screen.queryByText(en.reminderActive)).not.toBeInTheDocument())
    expect(reminder.disableReminder).toHaveBeenCalled()
    expect(useSettingsStore.getState().reminderEnabled).toBe(false)
  })

  it('übernimmt eine neue Uhrzeit und aktualisiert die Konfiguration nur bei aktiver Erinnerung', async () => {
    // Arrange
    renderWithProviders(<SettingsPage />)
    const time = screen.getByLabelText(en.reminderTimeLabel)
    expect(time).toBeDisabled()
    act(() => useSettingsStore.setState({ reminderEnabled: true }))
    expect(time).toBeEnabled()
    reminder.refreshReminderConfig.mockClear()

    // Act
    fireEvent.change(time, { target: { value: '19:30' } })

    // Assert
    expect(useSettingsStore.getState().reminderTime).toBe('19:30')
    await waitFor(() =>
      expect(reminder.refreshReminderConfig).toHaveBeenCalledWith({ time: '19:30', title: en.reminderTitle, body: en.reminderBody })
    )
  })

  it('sendet eine Testbenachrichtigung bei erteilter Berechtigung', async () => {
    // Arrange
    renderWithProviders(<SettingsPage />)

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.testReminder }))

    // Assert
    expect(await screen.findByText(en.reminderTestSent)).toBeInTheDocument()
    expect(reminder.sendTestReminder).toHaveBeenCalledWith(en.reminderTitle, en.reminderBody)
  })

  it('fragt die Berechtigung für den Test an und meldet eine Ablehnung', async () => {
    // Arrange
    reminder.notificationPermission.mockReturnValue('default')
    reminder.requestNotificationPermission.mockResolvedValue('denied')
    renderWithProviders(<SettingsPage />)

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.testReminder }))

    // Assert
    expect(await screen.findByText(en.reminderDenied)).toBeInTheDocument()
    expect(reminder.sendTestReminder).not.toHaveBeenCalled()
  })

  it('gleicht die Erinnerungstexte beim Sprachwechsel an, wenn sie aktiv ist', async () => {
    // Arrange
    useSettingsStore.setState({ reminderEnabled: true })
    renderWithProviders(<SettingsPage />)
    reminder.refreshReminderConfig.mockClear()

    // Act
    fireEvent.change(screen.getByDisplayValue('English'), { target: { value: 'de' } })

    // Assert
    await waitFor(() =>
      expect(reminder.refreshReminderConfig).toHaveBeenCalledWith({
        time: '08:00',
        title: translations.de.reminderTitle,
        body: translations.de.reminderBody
      })
    )
  })
})

describe('SettingsPage: Kurzbefehle', () => {
  it('kopiert den Link und bestätigt das', async () => {
    // Arrange
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderWithProviders(<SettingsPage />)

    // Act
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.shortcutText) }))

    // Assert
    expect(await screen.findByText(en.shortcutCopied)).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/today?capture=text'))
  })

  it('zeigt den Link selbst, wenn die Zwischenablage nicht verfügbar ist', async () => {
    // Arrange
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true
    })
    renderWithProviders(<SettingsPage />)

    // Act
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.shortcutPhoto) }))

    // Assert
    expect(await screen.findByText(/\/today\?capture=photo$/)).toBeInTheDocument()
  })
})

describe('SettingsPage: PIN-Sperre', () => {
  it('lehnt eine zu kurze PIN ab', async () => {
    // Arrange
    renderWithProviders(<SettingsPage />)
    fireEvent.change(screen.getByPlaceholderText(en.pinPlaceholder), { target: { value: '12' } })

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.enablePin }))

    // Assert
    expect(await screen.findByText(en.pinTooShort)).toBeInTheDocument()
    expect(hasPinLock()).toBe(false)
  })

  it('aktiviert die PIN, leert das Feld und und passt die Schaltflächen an', async () => {
    // Arrange
    renderWithProviders(<SettingsPage />)
    const input = screen.getByPlaceholderText(en.pinPlaceholder)
    fireEvent.change(input, { target: { value: '1234' } })

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.enablePin }))

    // Assert
    expect(await screen.findByText(en.pinEnabled)).toBeInTheDocument()
    expect(hasPinLock()).toBe(true)
    expect(input).toHaveValue('')
    expect(screen.getByRole('button', { name: en.changePin })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.lockNow })).toBeInTheDocument()
  })

  it('entfernt die PIN wieder', async () => {
    // Arrange
    renderWithProviders(<SettingsPage />)
    fireEvent.change(screen.getByPlaceholderText(en.pinPlaceholder), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: en.enablePin }))
    await screen.findByText(en.pinEnabled)

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.disablePin }))

    // Assert
    expect(await screen.findByText(en.pinDisabled)).toBeInTheDocument()
    expect(hasPinLock()).toBe(false)
    expect(screen.getByText(en.noticeProtectionOff)).toBeInTheDocument()
  })

  it('sendet beim Sofort-Sperren das Sperr-Ereignis', async () => {
    // Arrange
    renderWithProviders(<SettingsPage />)
    fireEvent.change(screen.getByPlaceholderText(en.pinPlaceholder), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: en.enablePin }))
    await screen.findByText(en.pinEnabled)
    const onLock = vi.fn()
    window.addEventListener('quiet-signal-lock-now', onLock)

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.lockNow }))

    // Assert
    window.removeEventListener('quiet-signal-lock-now', onLock)
    expect(onLock).toHaveBeenCalledTimes(1)
  })
})

describe('SettingsPage: Tresor-Verschlüsselung', () => {
  it('lehnt ein zu kurzes Passwort ab und ändert nichts', async () => {
    // Arrange
    renderWithProviders(<SettingsPage />)
    fireEvent.change(screen.getByPlaceholderText(en.encryptionPassword), { target: { value: 'kurz' } })

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.enableEncryption }))

    // Assert
    expect(await screen.findByText(en.passwordTooShort)).toBeInTheDocument()
    expect(isEncryptionEnabled()).toBe(false)
  })

  it('verschlüsselt beim Aktivieren alle Zeilen und lädt die Daten entschlüsselt neu', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1', text: 'Geheimes Zitat' })])
    await upsertBooks([makeBook({ id: 'b1', title: 'Geheimbuch' })])
    renderWithProviders(<SettingsPage />)
    const input = screen.getByPlaceholderText(en.encryptionPassword)
    fireEvent.change(input, { target: { value: 'passwort-123' } })

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.enableEncryption }))

    // Assert
    expect(await screen.findByText(en.encryptionEnabled)).toBeInTheDocument()
    const rawQuotes = await db.quotes.toArray()
    const rawBooks = await db.books.toArray()
    expect(rawQuotes.every((row) => row.encrypted === true && row.text === '')).toBe(true)
    expect(rawBooks.every((row) => row.encrypted === true)).toBe(true)
    expect(isEncryptionEnabled()).toBe(true)
    expect(input).toHaveValue('')
    expect(useQuoteStore.getState().quotes.map((quote) => quote.text)).toEqual(['Geheimes Zitat'])
    expect(screen.queryByRole('button', { name: en.enableEncryption })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.lockVault })).toBeInTheDocument()
  })

  it('zeigt bei einem Fehler einen Toast und lässt die Zeilen im Klartext', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1', text: 'Bleibt lesbar' })])
    vi.spyOn(db, 'transaction').mockRejectedValue(new Error('Schreibfehler'))
    renderWithProviders(<SettingsPage />)
    fireEvent.change(screen.getByPlaceholderText(en.encryptionPassword), { target: { value: 'passwort-123' } })

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.enableEncryption }))

    // Assert
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(en.encryptionEnableFailed))
    const raw = await db.quotes.toArray()
    expect(raw.map((row) => row.text)).toEqual(['Bleibt lesbar'])
    expect(screen.queryByText(en.encryptionEnabled)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText(en.encryptionPassword)).toHaveValue('passwort-123')
  })

  it('entfernt die Verschlüsselung und schreibt Klartext zurück', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1', text: 'Wieder lesbar' })])
    await enableEncryption('passwort-123')
    await encryptAllQuotes()
    renderWithProviders(<SettingsPage />)

    // Act
    fireEvent.click(await screen.findByRole('button', { name: en.disableEncryption }))

    // Assert
    expect(await screen.findByText(en.encryptionDisabled)).toBeInTheDocument()
    expect(isEncryptionEnabled()).toBe(false)
    const raw = await db.quotes.toArray()
    expect(raw.map((row) => row.text)).toEqual(['Wieder lesbar'])
    expect(raw.every((row) => !row.encrypted)).toBe(true)
    expect(screen.getByRole('button', { name: en.enableEncryption })).toBeInTheDocument()
    expect(useQuoteStore.getState().quotes.map((quote) => quote.text)).toEqual(['Wieder lesbar'])
  })

  it('entsperrt beim Entfernen mit dem Passwort, wenn der Tresor gesperrt ist', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1', text: 'Gesperrt gewesen' })])
    await enableEncryption('passwort-123')
    await encryptAllQuotes()
    lockEncryption()
    renderWithProviders(<SettingsPage />)
    fireEvent.change(screen.getByPlaceholderText(en.encryptionPassword), { target: { value: 'passwort-123' } })

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.disableEncryption }))

    // Assert
    expect(await screen.findByText(en.encryptionDisabled)).toBeInTheDocument()
    expect((await db.quotes.toArray()).map((row) => row.text)).toEqual(['Gesperrt gewesen'])
  })

  it('meldet ein falsches Passwort beim Entfernen und behält die Verschlüsselung', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1' })])
    await enableEncryption('passwort-123')
    await encryptAllQuotes()
    lockEncryption()
    renderWithProviders(<SettingsPage />)
    fireEvent.change(screen.getByPlaceholderText(en.encryptionPassword), { target: { value: 'falsches-passwort' } })

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.disableEncryption }))

    // Assert
    expect(await screen.findByText(en.wrongPassword)).toBeInTheDocument()
    expect(isEncryptionEnabled()).toBe(true)
    expect((await db.quotes.toArray()).every((row) => row.encrypted === true)).toBe(true)
  })

  it('zeigt beim Entfernen mit Fehler einen Toast und behält die Verschlüsselung', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1' })])
    await enableEncryption('passwort-123')
    await encryptAllQuotes()
    renderWithProviders(<SettingsPage />)
    vi.spyOn(db, 'transaction').mockRejectedValue(new Error('Schreibfehler'))

    // Act
    fireEvent.click(await screen.findByRole('button', { name: en.disableEncryption }))

    // Assert
    await waitFor(() => expect(useToastStore.getState().toast?.message).toBe(en.encryptionDisableFailed))
    expect(isEncryptionEnabled()).toBe(true)
    expect(screen.queryByText(en.encryptionDisabled)).not.toBeInTheDocument()
  })

  it('sperrt den Tresor per Schaltfläche und zeigt den gesperrten Zustand', async () => {
    // Arrange
    await enableEncryption('passwort-123')
    renderWithProviders(<SettingsPage />)

    // Act
    fireEvent.click(await screen.findByRole('button', { name: en.lockVault }))

    // Assert
    expect(isEncryptionUnlocked()).toBe(false)
    expect(await screen.findByRole('button', { name: en.vaultLocked })).toBeInTheDocument()
  })
})

describe('SettingsPage: Daten, Onboarding, Support', () => {
  it('bietet keine Beispieldaten mehr an (die liegen in den Leerzuständen)', () => {
    // Arrange / Act
    renderWithProviders(<SettingsPage />)

    // Assert
    expect(screen.queryByText('Sample data')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try it with examples' })).not.toBeInTheDocument()
  })

  it('löscht erst nach Bestätigung alle Einträge und Bücher', async () => {
    // Arrange
    await upsertQuotes([makeQuote()])
    await upsertBooks([makeBook()])
    renderWithProviders(<SettingsPage />)
    await screen.findByText(en.storedLocally_one.replace('{count}', '1'))

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.deleteAllLocalData }))
    expect(await listQuotes()).toHaveLength(1)
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: en.delete }))

    // Assert
    await waitFor(async () => expect(await listQuotes()).toHaveLength(0))
    expect(await listBooks()).toHaveLength(0)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('behält die Daten, wenn die Löschbestätigung abgebrochen wird', async () => {
    // Arrange
    await upsertQuotes([makeQuote()])
    renderWithProviders(<SettingsPage />)
    fireEvent.click(screen.getByRole('button', { name: en.deleteAllLocalData }))
    const dialog = await screen.findByRole('dialog')

    // Act
    fireEvent.click(within(dialog).getAllByRole('button', { name: en.cancel })[1])

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await listQuotes()).toHaveLength(1)
  })

  it('startet das Onboarding neu', () => {
    // Arrange
    const onOpen = vi.fn()
    window.addEventListener(onboardingEventName, onOpen)
    renderWithProviders(<SettingsPage />)

    // Act
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.restartOnboarding) }))
    })

    // Assert
    window.removeEventListener(onboardingEventName, onOpen)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('verlinkt die Unterstützungsangebote', () => {
    // Arrange / Act
    renderWithProviders(<SettingsPage />)

    // Assert
    expect(screen.getByRole('link', { name: `${en.supportProjectAction} via Ko-fi` })).toHaveAttribute('href', 'https://ko-fi.com/esc92')
    expect(screen.getByRole('link', { name: `${en.supportProjectAction} via PayPal` })).toHaveAttribute(
      'href',
      'https://paypal.me/ErikSchroeder92'
    )
  })
})

describe('SettingsPage: Versionszeile und entfernte Panels', () => {
  it('zeigt am Ende genau eine ruhige Versionszeile aus package.json', () => {
    // Arrange / Act
    renderWithProviders(<SettingsPage />)

    // Assert
    const line = screen.getByText(`Quiet Signal ${pkg.version}`)
    expect(line.compareDocumentPosition(screen.getByRole('button', { name: en.deleteAllLocalData }))).toBe(
      Node.DOCUMENT_POSITION_PRECEDING
    )
  })

  it('hat weder „Datenschutz & Vertrauen“ noch „Release-Status“', () => {
    // Arrange / Act
    renderWithProviders(<SettingsPage />)

    // Assert
    expect(screen.queryByRole('heading', { name: 'Privacy & trust' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Release status' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Daily Build/)).not.toBeInTheDocument()
  })

  it('hat keine dekorative Überschrift über dem Titel', () => {
    // Arrange / Act
    renderWithProviders(<SettingsPage />)

    // Assert
    const title = screen.getByRole('heading', { level: 1, name: en.settings })
    expect(title.previousElementSibling).toBeNull()
  })
})
