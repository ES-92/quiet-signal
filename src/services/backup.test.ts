import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { backupAgeDays, backupFilename, backupState, getLastBackupAt, markBackupNow } from './backup'

const NOW = '2026-03-20T12:00:00+01:00'
const day = 86_400_000

function daysAgo(days: number) {
  return new Date(new Date(NOW).getTime() - days * day).toISOString()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('backupAgeDays', () => {
  it('liefert undefined ohne oder mit ungültigem Zeitstempel', () => {
    // Arrange / Act / Assert
    expect(backupAgeDays(undefined)).toBeUndefined()
    expect(backupAgeDays('kaputt')).toBeUndefined()
  })

  it('rundet auf volle Tage ab', () => {
    // Arrange
    const timestamp = new Date(new Date(NOW).getTime() - 2.9 * day).toISOString()

    // Act
    const age = backupAgeDays(timestamp)

    // Assert
    expect(age).toBe(2)
  })

  it('liefert 0 für Zeitstempel in der Zukunft', () => {
    // Arrange
    const timestamp = new Date(new Date(NOW).getTime() + 3 * day).toISOString()

    // Act
    const age = backupAgeDays(timestamp)

    // Assert
    expect(age).toBe(0)
  })
})

describe('backupState', () => {
  it('ist empty bei 0 Einträgen, auch mit frischem Backup', () => {
    // Arrange
    const timestamp = daysAgo(0)

    // Act
    const state = backupState(0, timestamp)

    // Assert
    expect(state).toBe('empty')
  })

  it('ist stale ohne Backup-Zeitstempel', () => {
    // Arrange / Act
    const state = backupState(5, undefined)

    // Assert
    expect(state).toBe('stale')
  })

  it('ist stale bei ungültigem Zeitstempel', () => {
    // Arrange / Act
    const state = backupState(5, 'kaputt')

    // Assert
    expect(state).toBe('stale')
  })

  it.each([
    [0, 'fresh'],
    [6.9, 'fresh'],
    [7, 'due'],
    [13.9, 'due'],
    [14, 'stale'],
    [40, 'stale']
  ] as const)('ist bei %s Tagen Alter %s', (days, expected) => {
    // Arrange
    const timestamp = daysAgo(days)

    // Act
    const state = backupState(3, timestamp)

    // Assert
    expect(state).toBe(expected)
  })

  it('liest ohne Argument den gespeicherten Zeitstempel', () => {
    // Arrange
    localStorage.setItem('quiet-signal-last-backup-at', daysAgo(8))

    // Act
    const state = backupState(3)

    // Assert
    expect(state).toBe('due')
  })
})

describe('markBackupNow / getLastBackupAt', () => {
  it('liefert undefined ohne gespeichertes Backup', () => {
    // Arrange / Act / Assert
    expect(getLastBackupAt()).toBeUndefined()
  })

  it('speichert den aktuellen Zeitpunkt als ISO-String', () => {
    // Arrange / Act
    const timestamp = markBackupNow()

    // Assert
    expect(timestamp).toBe(new Date(NOW).toISOString())
    expect(getLastBackupAt()).toBe(timestamp)
  })
})

describe('backupFilename', () => {
  it('enthält das Datum', () => {
    // Arrange / Act
    const name = backupFilename()

    // Assert
    expect(name).toBe('quiet-signal-backup-2026-03-20.json')
  })

  it('verwendet das UTC-Datum statt des lokalen', () => {
    // Arrange
    vi.setSystemTime(new Date('2026-03-21T00:30:00+01:00')) // 20.03. 23:30 UTC

    // Act
    const name = backupFilename()

    // Assert
    // CHARACTERIZATION: vermutlich Bug, siehe Task 10 (lokaler 21.03. wird als 20.03. benannt)
    expect(name).toBe('quiet-signal-backup-2026-03-20.json')
  })
})
