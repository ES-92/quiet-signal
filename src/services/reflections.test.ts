import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeQuote, resetFactories } from '../test/factories'
import { buildReflection, periodRange, reflectionMarkdown } from './reflections'

const NOW = '2026-03-11T10:00:00+01:00' // Mittwoch

beforeEach(() => {
  resetFactories()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('periodRange', () => {
  it('beginnt die Woche am Montag um 00:00 Ortszeit und endet Sonntag 23:59:59.999', () => {
    // Arrange
    const now = new Date(NOW)

    // Act
    const { start, end } = periodRange('week', now)

    // Assert
    expect(start.getTime()).toBe(new Date('2026-03-09T00:00:00+01:00').getTime())
    expect(end.getTime()).toBe(new Date('2026-03-15T23:59:59.999+01:00').getTime())
  })

  it('behandelt Sonntag als letzten Tag der Woche', () => {
    // Arrange
    const sonntag = new Date('2026-03-15T12:00:00+01:00')

    // Act
    const { start } = periodRange('week', sonntag)

    // Assert
    expect(start.getTime()).toBe(new Date('2026-03-09T00:00:00+01:00').getTime())
  })

  it('beginnt der Monat am Ersten um 00:00 und endet am letzten Tag 23:59:59.999 Ortszeit', () => {
    // Arrange
    const now = new Date(NOW)

    // Act
    const { start, end } = periodRange('month', now)

    // Assert
    expect(start.getTime()).toBe(new Date('2026-03-01T00:00:00+01:00').getTime())
    expect(end.getTime()).toBe(new Date('2026-03-31T23:59:59.999+02:00').getTime())
  })

  it('endet die Woche der Winterzeit-Umstellung am Sonntag 23:59:59.999 Ortszeit', () => {
    // Arrange
    const now = new Date('2026-10-22T10:00:00+02:00') // Woche mit Umstellung am 25.10.

    // Act
    const { end } = periodRange('week', now)

    // Assert
    expect(end.getTime()).toBe(new Date('2026-10-25T23:59:59.999+01:00').getTime())
  })

  it('endet die Woche der Sommerzeit-Umstellung am Sonntag 23:59:59.999 Ortszeit', () => {
    // Arrange
    const now = new Date('2026-03-25T10:00:00+01:00') // Woche mit Umstellung am 29.03.

    // Act
    const { end } = periodRange('week', now)

    // Assert
    expect(end.getTime()).toBe(new Date('2026-03-29T23:59:59.999+02:00').getTime())
  })
})

describe('buildReflection', () => {
  it('zählt nur Einträge im Zeitraum', () => {
    // Arrange
    const inside = makeQuote({ createdAt: '2026-03-10T09:00:00+01:00' })
    const before = makeQuote({ createdAt: '2026-03-08T23:59:00+01:00' })
    const after = makeQuote({ createdAt: '2026-03-16T00:00:00+01:00' })

    // Act
    const result = buildReflection([inside, before, after], [], 'week', new Date(NOW))

    // Assert
    expect(result.entries.map((q) => q.id)).toEqual([inside.id])
  })

  it('bevorzugt occurredAt vor createdAt', () => {
    // Arrange
    const q = makeQuote({ createdAt: '2026-01-01T09:00:00.000Z', occurredAt: '2026-03-10T09:00:00+01:00' })

    // Act
    const result = buildReflection([q], [], 'week', new Date(NOW))

    // Assert
    expect(result.entries).toHaveLength(1)
  })

  it('fällt bei ungültigem occurredAt auf createdAt zurück', () => {
    // Arrange
    const q = makeQuote({ createdAt: '2026-03-10T09:00:00+01:00', occurredAt: 'kein-datum' })

    // Act
    const result = buildReflection([q], [], 'week', new Date(NOW))

    // Assert
    expect(result.entries).toHaveLength(1)
  })

  it('schließt gespeicherte Reflexionen aus', () => {
    // Arrange
    const reflection = makeQuote({
      createdAt: '2026-03-10T09:00:00+01:00',
      tags: ['reflection'],
      source: 'Quiet Signal'
    })
    const normal = makeQuote({ createdAt: '2026-03-10T09:00:00+01:00', tags: ['reflection'], source: 'Buch' })

    // Act
    const result = buildReflection([reflection, normal], [], 'week', new Date(NOW))

    // Assert
    expect(result.entries.map((q) => q.id)).toEqual([normal.id])
  })

  it('trennt Signale und Rauschen nach Status und sortiert neueste zuerst', () => {
    // Arrange
    const older = makeQuote({ status: 'signal', createdAt: '2026-03-09T09:00:00+01:00' })
    const newer = makeQuote({ status: 'inbox', createdAt: '2026-03-10T09:00:00+01:00' })

    // Act
    const result = buildReflection([older, newer], [], 'week', new Date(NOW))

    // Assert
    expect(result.entries.map((q) => q.id)).toEqual([newer.id, older.id])
    expect(result.signals.map((q) => q.id)).toEqual([older.id])
    expect(result.noise.map((q) => q.id)).toEqual([newer.id])
  })

  it('zählt Stille-Einträge zu den Signalen und nie zum Rauschen', () => {
    // Arrange
    const resting = makeQuote({ status: 'rest', createdAt: '2026-03-10T09:00:00+01:00' })
    const inbox = makeQuote({ status: 'inbox', createdAt: '2026-03-10T10:00:00+01:00' })

    // Act
    const result = buildReflection([resting, inbox], [], 'week', new Date(NOW))

    // Assert
    expect(result.signals.map((q) => q.id)).toEqual([resting.id])
    expect(result.noise.map((q) => q.id)).toEqual([inbox.id])
  })

  it('wählt das Signal mit dem höchsten Score als Top-Signal', () => {
    // Arrange
    const schwach = makeQuote({ createdAt: '2026-03-10T09:00:00+01:00' })
    const favorit = makeQuote({ createdAt: '2026-03-10T09:00:00+01:00', favorite: true })

    // Act
    const result = buildReflection([schwach, favorit], [], 'week', new Date(NOW))

    // Assert
    expect(result.topSignal?.id).toBe(favorit.id)
  })

  it('hat kein Top-Signal ohne Signale', () => {
    // Arrange
    const q = makeQuote({ status: 'inbox', createdAt: '2026-03-10T09:00:00+01:00' })

    // Act
    const result = buildReflection([q], [], 'week', new Date(NOW))

    // Assert
    expect(result.topSignal).toBeUndefined()
  })

  it('aggregiert Tags ohne Beachtung von Groß-/Kleinschreibung, begrenzt auf 4', () => {
    // Arrange
    const date = '2026-03-10T09:00:00+01:00'
    const quotes = [
      makeQuote({ createdAt: date, tags: ['Stille', 'a', 'b', 'c', 'd'] }),
      makeQuote({ createdAt: date, tags: ['stille  '] })
    ]

    // Act
    const result = buildReflection(quotes, [], 'week', new Date(NOW))

    // Assert
    expect(result.topTags).toHaveLength(4)
    expect(result.topTags[0]).toEqual({ key: 'stille', label: 'Stille', count: 2 })
  })

  it('nutzt Buchtitel über bookId, sonst das Werk', () => {
    // Arrange
    const date = '2026-03-10T09:00:00+01:00'
    const book = makeBook({ title: 'Der Prozess' })
    const quotes = [
      makeQuote({ createdAt: date, bookId: book.id, work: 'Anderes Werk' }),
      makeQuote({ createdAt: date, work: 'Walden' }),
      makeQuote({ createdAt: date, bookId: 'unbekannt', work: 'Walden' })
    ]

    // Act
    const result = buildReflection(quotes, [book], 'week', new Date(NOW))

    // Assert
    expect(result.topBooks.map((b) => [b.label, b.count])).toEqual([
      ['Walden', 2],
      ['Der Prozess', 1]
    ])
  })

  it('wertet gespeicherte Orte und Arten nicht aus', () => {
    // Arrange
    const date = '2026-03-10T09:00:00+01:00'
    const quotes = [
      makeQuote({ createdAt: date, locationName: 'Hannover', entryType: 'idea' }),
      makeQuote({ createdAt: date, locationName: 'Hannover', entryType: 'idea' })
    ]

    // Act
    const result = buildReflection(quotes, [], 'week', new Date(NOW))
    const markdown = reflectionMarkdown(result, 'Brief')

    // Assert
    expect(result).not.toHaveProperty('topPlaces')
    expect(result).not.toHaveProperty('topTypes')
    expect(markdown).not.toContain('Hannover')
  })

  it('bestimmt die häufigste Tageszeit in Ortszeit', () => {
    // Arrange
    const quotes = [
      makeQuote({ createdAt: '2026-03-10T04:59:00+01:00' }), // night
      makeQuote({ createdAt: '2026-03-10T05:00:00+01:00' }), // morning
      makeQuote({ createdAt: '2026-03-10T08:00:00+01:00' }), // morning
      makeQuote({ createdAt: '2026-03-10T12:00:00+01:00' }) // afternoon
    ]

    // Act
    const result = buildReflection(quotes, [], 'week', new Date(NOW))

    // Assert
    expect(result.topTime).toEqual({ key: 'morning', label: 'morning', count: 2 })
  })

  it('liefert leere Metriken ohne Einträge', () => {
    // Arrange / Act
    const result = buildReflection([], [], 'month', new Date(NOW))

    // Assert
    expect(result.entries).toEqual([])
    expect(result.topTime).toBeUndefined()
    expect(result.topTags).toEqual([])
  })
})

describe('reflectionMarkdown', () => {
  it('enthält Titel, Zähler und Top-Signal', () => {
    // Arrange
    const q = makeQuote({ text: 'Schweigen', author: 'Autor', createdAt: '2026-03-10T09:00:00+01:00' })
    const summary = buildReflection([q], [], 'week', new Date(NOW))

    // Act
    const md = reflectionMarkdown(summary, 'Brief')

    // Assert
    expect(md).toContain('# Weekly Reflection')
    expect(md).toContain('Entries: 1')
    expect(md).toContain('Signals: 1')
    expect(md).toContain('> Schweigen')
    expect(md).toContain('- Autor')
  })

  it('formatiert den Wochenbeginn als lokales Datum', () => {
    // Arrange
    const summary = buildReflection([], [], 'week', new Date(NOW))

    // Act
    const md = reflectionMarkdown(summary, '')

    // Assert
    expect(md).toContain('2026-03-09 - 2026-03-15')
  })
})
