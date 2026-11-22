import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeQuote, resetFactories } from '../test/factories'
import type { ActivityEvent, Thought } from '../types/quote'
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

let thoughtCounter = 0
function thought(createdAt: string, text = `Gedanke ${++thoughtCounter}`, extra: Partial<Thought> = {}): Thought {
  return { id: `t-${++thoughtCounter}`, text, createdAt: new Date(createdAt).toISOString(), ...extra }
}

function event(at: string, type: ActivityEvent['type']): ActivityEvent {
  return { at: new Date(at).toISOString(), type }
}

describe('periodRange', () => {
  it('beginnt die Woche am Montag um 00:00 Ortszeit und endet Sonntag 23:59:59.999', () => {
    // Act
    const { start, end } = periodRange('week', new Date(NOW))

    // Assert
    expect(start.getTime()).toBe(new Date('2026-03-09T00:00:00+01:00').getTime())
    expect(end.getTime()).toBe(new Date('2026-03-15T23:59:59.999+01:00').getTime())
  })

  it('behandelt Sonntag als letzten Tag der Woche', () => {
    // Act
    const { start } = periodRange('week', new Date('2026-03-15T12:00:00+01:00'))

    // Assert
    expect(start.getTime()).toBe(new Date('2026-03-09T00:00:00+01:00').getTime())
  })

  it('beginnt der Monat am Ersten um 00:00 und endet am letzten Tag 23:59:59.999 Ortszeit', () => {
    // Act
    const { start, end } = periodRange('month', new Date(NOW))

    // Assert
    expect(start.getTime()).toBe(new Date('2026-03-01T00:00:00+01:00').getTime())
    expect(end.getTime()).toBe(new Date('2026-03-31T23:59:59.999+02:00').getTime())
  })

  it('endet die Woche der Winterzeit-Umstellung am Sonntag 23:59:59.999 Ortszeit', () => {
    // Act
    const { end } = periodRange('week', new Date('2026-10-22T10:00:00+02:00'))

    // Assert
    expect(end.getTime()).toBe(new Date('2026-10-25T23:59:59.999+01:00').getTime())
  })
})

describe('buildReflection – Gedanken', () => {
  it('sammelt die Gedanken der Woche über alle Einträge, neueste zuerst, inklusive der Grenzen', () => {
    // Arrange
    const montag = thought('2026-03-09T00:00:00+01:00', 'Montag früh')
    const sonntag = thought('2026-03-15T23:59:00+01:00', 'Sonntag spät')
    const mitte = thought('2026-03-11T08:00:00+01:00', 'Mitte')
    const davor = thought('2026-03-08T23:59:00+01:00', 'davor')
    const danach = thought('2026-03-16T00:00:00+01:00', 'danach')
    const a = makeQuote({ author: 'Seneca', work: 'Briefe', thoughts: [davor, montag, sonntag] })
    const b = makeQuote({ text: 'Ein Satz', thoughts: [mitte, danach] })

    // Act
    const result = buildReflection([a, b], [], 'week', new Date(NOW))

    // Assert
    expect(result.thoughts.map((item) => item.text)).toEqual(['Sonntag spät', 'Mitte', 'Montag früh'])
    expect(result.thoughts[0]).toMatchObject({ quoteId: a.id, author: 'Seneca', work: 'Briefe', createdAt: sonntag.createdAt, fromNote: false })
    expect(result.thoughts[1]).toMatchObject({ quoteId: b.id, quoteText: 'Ein Satz' })
  })

  it('sammelt im Monat alle Gedanken vom Ersten bis zum Letzten', () => {
    // Arrange
    const q = makeQuote({
      thoughts: [
        thought('2026-02-28T23:59:00+01:00', 'Februar'),
        thought('2026-03-01T00:00:00+01:00', 'Erster'),
        thought('2026-03-31T23:59:00+02:00', 'Letzter'),
        thought('2026-04-01T00:00:00+02:00', 'April')
      ]
    })

    // Act
    const result = buildReflection([q], [], 'month', new Date(NOW))

    // Assert
    expect(result.thoughts.map((item) => item.text)).toEqual(['Letzter', 'Erster'])
  })

  it('markiert Gedanken aus einer früheren Notiz und nutzt den Buchtitel über bookId', () => {
    // Arrange
    const book = makeBook({ title: 'Walden', author: 'Thoreau' })
    const q = makeQuote({ bookId: book.id, thoughts: [thought('2026-03-10T09:00:00+01:00', 'alt', { fromNote: true })] })

    // Act
    const result = buildReflection([q], [book], 'week', new Date(NOW))

    // Assert
    expect(result.thoughts[0]).toMatchObject({ fromNote: true, work: 'Walden', author: 'Thoreau' })
  })

  it('zeigt Gedanken auch bei Alt-Einträgen ohne Aktivitätsprotokoll', () => {
    // Arrange
    const legacy = makeQuote({ thoughts: [thought('2026-03-10T09:00:00+01:00', 'legacy')] })

    // Act
    const result = buildReflection([legacy], [], 'week', new Date(NOW))

    // Assert
    expect(result.thoughts.map((item) => item.text)).toEqual(['legacy'])
    expect(result.totals).toEqual({ more: 0, less: 0, rest: 0, thoughts: 1 })
  })
})

describe('buildReflection – Gezeitenstreifen', () => {
  it('liefert sieben Tage Mo–So mit Zählern für öfter, seltener und ruhen', () => {
    // Arrange
    const a = makeQuote({
      activity: [
        event('2026-03-08T23:59:00+01:00', 'more'), // Vorwoche
        event('2026-03-09T00:00:00+01:00', 'more'),
        event('2026-03-09T12:00:00+01:00', 'less'),
        event('2026-03-11T09:00:00+01:00', 'rest'),
        event('2026-03-15T23:59:00+01:00', 'more'),
        event('2026-03-16T00:00:00+01:00', 'rest') // Folgewoche
      ]
    })
    const b = makeQuote({ activity: [event('2026-03-09T18:00:00+01:00', 'more'), event('2026-03-11T10:00:00+01:00', 'wake')] })

    // Act
    const { strip, totals } = buildReflection([a, b], [], 'week', new Date(NOW))

    // Assert
    expect(strip).toHaveLength(7)
    expect(strip[0].start.getTime()).toBe(new Date('2026-03-09T00:00:00+01:00').getTime())
    expect(strip[6].end.getTime()).toBe(new Date('2026-03-15T23:59:59.999+01:00').getTime())
    expect(strip.map((day) => day.more)).toEqual([2, 0, 0, 0, 0, 0, 1])
    expect(strip.map((day) => day.rest)).toEqual([0, 0, 1, 0, 0, 0, 0])
    expect(strip[0].less).toBe(1)
    expect(totals).toEqual({ more: 3, less: 1, rest: 1, thoughts: 0 })
  })

  it('markiert Tage, an denen ein Gedanke dazukam', () => {
    // Arrange
    const logged = makeQuote({ activity: [event('2026-03-10T09:00:00+01:00', 'thought')] })
    const legacy = makeQuote({ thoughts: [thought('2026-03-12T21:00:00+01:00')] })
    const adopted = makeQuote({ thoughts: [thought('2026-03-13T21:00:00+01:00', 'alt', { fromNote: true })] })

    // Act
    const { strip } = buildReflection([logged, legacy, adopted], [], 'week', new Date(NOW))

    // Assert
    expect(strip.map((day) => day.thought)).toEqual([false, true, false, true, false, false, false])
  })

  it('teilt den Monat in Wochen, an den Monatsgrenzen abgeschnitten', () => {
    // Arrange (März 2026: So 1. … Di 31.)
    const q = makeQuote({
      activity: [
        event('2026-03-01T10:00:00+01:00', 'more'),
        event('2026-03-02T10:00:00+01:00', 'rest'),
        event('2026-03-31T22:00:00+02:00', 'more')
      ]
    })

    // Act
    const { strip } = buildReflection([q], [], 'month', new Date(NOW))

    // Assert
    expect(strip.map((week) => week.start.getDate())).toEqual([1, 2, 9, 16, 23, 30])
    expect(strip[0].end.getTime()).toBe(new Date('2026-03-01T23:59:59.999+01:00').getTime())
    expect(strip[5].end.getTime()).toBe(new Date('2026-03-31T23:59:59.999+02:00').getTime())
    expect(strip.map((week) => [week.more, week.rest])).toEqual([[1, 0], [0, 1], [0, 0], [0, 0], [0, 0], [1, 0]])
  })

  it('lässt Alt-Einträge ohne Protokoll im Streifen leer', () => {
    // Arrange
    const legacy = makeQuote({ lastReviewedAt: '2026-03-10T09:00:00+01:00', reviewCount: 4 })

    // Act
    const { strip } = buildReflection([legacy], [], 'week', new Date(NOW))

    // Assert
    expect(strip.every((day) => day.more === 0 && day.rest === 0 && !day.thought)).toBe(true)
  })
})

describe('reflectionMarkdown', () => {
  it('enthält die Gedanken des Zeitraums mit Datum und zugehörigem Zitat', () => {
    // Arrange
    const q = makeQuote({
      text: 'Schweigen ist Gold',
      author: 'Autor',
      work: 'Werk',
      thoughts: [thought('2026-03-10T09:00:00+01:00', 'Mein Gedanke')]
    })
    const summary = buildReflection([q], [], 'week', new Date(NOW))

    // Act
    const md = reflectionMarkdown(summary, { title: 'Wochenrückblick', summary: '1 durfte ruhen', fromNote: 'aus früherer Notiz' })

    // Assert
    expect(md).toContain('# Wochenrückblick')
    expect(md).toContain('2026-03-09 - 2026-03-15')
    expect(md).toContain('1 durfte ruhen')
    expect(md).toContain('2026-03-10')
    expect(md).toContain('Mein Gedanke')
    expect(md).toContain('> Schweigen ist Gold')
    expect(md).toContain('Autor, Werk')
  })

  it('kennzeichnet Gedanken aus einer früheren Notiz', () => {
    // Arrange
    const q = makeQuote({ thoughts: [thought('2026-03-10T09:00:00+01:00', 'alt', { fromNote: true })] })
    const summary = buildReflection([q], [], 'week', new Date(NOW))

    // Act
    const md = reflectionMarkdown(summary, { title: 'T', summary: '', fromNote: 'aus früherer Notiz' })

    // Assert
    expect(md).toContain('aus früherer Notiz')
  })

  it('enthält keine Statistik-Abschnitte mehr', () => {
    // Arrange
    const q = makeQuote({ tags: ['stille'], work: 'Walden', locationName: 'Hannover', thoughts: [thought('2026-03-10T09:00:00+01:00')] })
    const summary = buildReflection([q], [], 'week', new Date(NOW))

    // Act
    const md = reflectionMarkdown(summary, { title: 'T', summary: '', fromNote: '' })

    // Assert
    expect(md).not.toMatch(/Signals:|Noise:|## Tags|## Books|Top signal/)
    expect(md).not.toContain('Hannover')
    expect(summary).not.toHaveProperty('topTags')
    expect(summary).not.toHaveProperty('topTime')
  })
})
