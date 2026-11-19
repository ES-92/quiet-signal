import { describe, expect, it } from 'vitest'
import { localDateKey } from './date'

describe('localDateKey', () => {
  it('liefert das lokale Datum um 00:30 Berliner Zeit (UTC liegt noch am Vortag)', () => {
    // Arrange
    const date = new Date('2026-03-10T00:30:00+01:00')

    // Act
    const key = localDateKey(date)

    // Assert
    expect(key).toBe('2026-03-10')
  })

  it('liefert das lokale Datum um 23:30 Berliner Zeit', () => {
    // Arrange
    const date = new Date('2026-03-10T23:30:00+01:00')

    // Act
    const key = localDateKey(date)

    // Assert
    expect(key).toBe('2026-03-10')
  })

  it('füllt Monat und Tag einstellig mit führenden Nullen auf', () => {
    // Arrange
    const date = new Date('2026-01-05T12:00:00+01:00')

    // Act
    const key = localDateKey(date)

    // Assert
    expect(key).toBe('2026-01-05')
  })

  it('liefert am Tag der Sommerzeit-Umstellung (29.03.2026) das lokale Datum', () => {
    // Arrange
    const beforeSwitch = new Date('2026-03-29T00:30:00+01:00')
    const afterSwitch = new Date('2026-03-29T23:30:00+02:00')

    // Act
    const keys = [localDateKey(beforeSwitch), localDateKey(afterSwitch)]

    // Assert
    expect(keys).toEqual(['2026-03-29', '2026-03-29'])
  })

  it('liefert am Tag der Winterzeit-Umstellung (25.10.2026) das lokale Datum', () => {
    // Arrange
    const beforeSwitch = new Date('2026-10-25T00:30:00+02:00')
    const afterSwitch = new Date('2026-10-25T23:30:00+01:00')

    // Act
    const keys = [localDateKey(beforeSwitch), localDateKey(afterSwitch)]

    // Assert
    expect(keys).toEqual(['2026-10-25', '2026-10-25'])
  })

  it('liefert am Jahreswechsel um 00:30 das neue Jahr', () => {
    // Arrange
    const date = new Date('2027-01-01T00:30:00+01:00')

    // Act
    const key = localDateKey(date)

    // Assert
    expect(key).toBe('2027-01-01')
  })
})
