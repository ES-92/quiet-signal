import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeQuote, resetFactories } from '../test/factories'
import { nextMorningISO, selectBrowseStack, selectDailyStack } from './review'

const NOW = '2026-03-10T10:00:00+01:00'
const hour = 60 * 60 * 1000
const day = 24 * hour

function inDays(days: number) {
  return new Date(new Date(NOW).getTime() + days * day).toISOString()
}

function ids(quotes: { id: string }[]) {
  return quotes.map((quote) => quote.id)
}

beforeEach(() => {
  resetFactories()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('nextMorningISO', () => {
  it('liefert den nächsten Tag um 06:00 Ortszeit', () => {
    // Arrange
    const now = new Date(NOW)

    // Act
    const result = nextMorningISO(now)

    // Assert
    expect(result).toBe('2026-03-11T05:00:00.000Z') // 06:00 Europe/Berlin (MEZ)
    expect(new Date(result).getHours()).toBe(6)
    expect(new Date(result).getDate()).toBe(11)
  })

  it('nutzt ohne Argument die aktuelle Uhr', () => {
    // Arrange
    // (Uhr steht per Fake-Timer auf NOW)

    // Act
    const result = nextMorningISO()

    // Assert
    expect(result).toBe('2026-03-11T05:00:00.000Z')
  })

  it('bleibt nach Mitternacht beim nächsten Kalendertag', () => {
    // Arrange
    const now = new Date('2026-03-10T00:30:00+01:00')

    // Act
    const result = nextMorningISO(now)

    // Assert
    expect(result).toBe('2026-03-11T05:00:00.000Z')
  })
})

describe('selectDailyStack – Filter', () => {
  const options = { limit: 10 }

  it('nimmt nur Zitate mit status signal auf', () => {
    // Arrange
    const signal = makeQuote({ status: 'signal' })
    const legacy = makeQuote({ status: undefined })
    const inbox = makeQuote({ status: 'inbox' })

    // Act
    const result = ids(selectDailyStack([signal, inbox, legacy], options))

    // Assert
    expect(result).toHaveLength(2)
    expect(result).toContain(signal.id)
    expect(result).toContain(legacy.id)
    expect(result).not.toContain(inbox.id)
  })

  it('lässt gelöschte Zitate aus', () => {
    // Arrange
    const kept = makeQuote()
    const deleted = makeQuote({ deletedAt: '2026-03-09T09:00:00.000Z' })

    // Act
    const result = ids(selectDailyStack([kept, deleted], options))

    // Assert
    expect(result).toEqual([kept.id])
  })

  it('lässt gesnoozte Zitate aus, bis die Snooze-Zeit abgelaufen ist', () => {
    // Arrange
    const snoozed = makeQuote({ snoozedUntil: inDays(0.5) })
    const expired = makeQuote({ snoozedUntil: inDays(-0.5) })

    // Act
    const result = ids(selectDailyStack([snoozed, expired], options))

    // Assert
    expect(result).toEqual([expired.id])
  })

  it('lässt heute gelesene Zitate aus, früher gelesene bleiben', () => {
    // Arrange
    const readToday = makeQuote({ lastReviewedAt: '2026-03-10T08:00:00+01:00' })
    const readYesterday = makeQuote({ lastReviewedAt: '2026-03-09T12:00:00+01:00' })

    // Act
    const result = ids(selectDailyStack([readToday, readYesterday], options))

    // Assert
    expect(result).toEqual([readYesterday.id])
  })

  it('liefert eine leere Liste ohne Zitate', () => {
    // Arrange
    const quotes: ReturnType<typeof makeQuote>[] = []

    // Act
    const result = selectDailyStack(quotes, options)

    // Assert
    expect(result).toEqual([])
  })
})

describe('selectDailyStack – Fälligkeit ohne Auffüllen', () => {
  it('returns only due signals and never fills from the backlog', () => {
    // Arrange
    const due = makeQuote({ nextReviewAt: inDays(-1) })
    const later = makeQuote({ nextReviewAt: inDays(5) })

    // Act
    const result = ids(selectDailyStack([due, later], { limit: 5 }))

    // Assert
    expect(result).toEqual([due.id])
  })

  it('returns an empty stack when nothing is due', () => {
    // Arrange
    const quotes = [makeQuote({ nextReviewAt: inDays(5) })]

    // Act
    const result = selectDailyStack(quotes, { limit: 5 })

    // Assert
    expect(result).toEqual([])
  })

  it('excludes rest and inbox', () => {
    // Arrange
    const quotes = [makeQuote({ status: 'rest' }), makeQuote({ status: 'inbox' })]

    // Act
    const result = selectDailyStack(quotes, { limit: 5 })

    // Assert
    expect(result).toEqual([])
  })

  it('still ranks due cards by score and caps at the limit', () => {
    // Arrange
    const stale = makeQuote({ lastReviewedAt: inDays(-20), nextReviewAt: inDays(-1) })
    const fresh = makeQuote({ nextReviewAt: inDays(-1) })
    const extra = Array.from({ length: 4 }, () => makeQuote({ lastReviewedAt: inDays(-20), nextReviewAt: inDays(-1) }))

    // Act
    const result = ids(selectDailyStack([stale, ...extra, fresh], { limit: 3 }))

    // Assert
    expect(result).toHaveLength(3)
    expect(result[0]).toBe(fresh.id) // never reviewed scores 1000+, reviewed 20 days ago about 200
  })

  it('treats quotes without nextReviewAt as due', () => {
    // Arrange
    const quote = makeQuote({ nextReviewAt: undefined })

    // Act
    const result = ids(selectDailyStack([quote], { limit: 5 }))

    // Assert
    expect(result).toEqual([quote.id])
  })

  it('excludes quotes that only become due later today', () => {
    // Arrange
    const laterToday = makeQuote({ nextReviewAt: '2026-03-10T16:00:00+01:00' })
    const due = makeQuote({ nextReviewAt: inDays(-1) })

    // Act
    const result = ids(selectDailyStack([laterToday, due], { limit: 5 }))

    // Assert
    expect(result).toEqual([due.id])
  })
})

describe('selectBrowseStack', () => {
  it('returns signals regardless of due date, deterministic per seed, without rest', () => {
    // Arrange
    const quotes = [makeQuote({ nextReviewAt: inDays(5) }), makeQuote({ status: 'rest' }), makeQuote()]

    // Act
    const first = selectBrowseStack(quotes, { limit: 5, seed: 's' })
    const second = selectBrowseStack(quotes, { limit: 5, seed: 's' })

    // Assert
    expect(first).toHaveLength(2)
    expect(second).toEqual(first)
  })

  it('ignores snooze and reviewed-today but excludes deleted and inbox', () => {
    // Arrange
    const snoozed = makeQuote({ snoozedUntil: inDays(0.5) })
    const readToday = makeQuote({ lastReviewedAt: '2026-03-10T08:00:00+01:00' })
    const deleted = makeQuote({ deletedAt: '2026-03-09T09:00:00.000Z' })
    const inbox = makeQuote({ status: 'inbox' })

    // Act
    const result = ids(selectBrowseStack([snoozed, readToday, deleted, inbox], { limit: 10, seed: 's' }))

    // Assert
    expect(result.sort()).toEqual([snoozed.id, readToday.id].sort())
  })

  it('caps at the limit and shuffles differently for another seed', () => {
    // Arrange
    const quotes = Array.from({ length: 12 }, () => makeQuote())

    // Act
    const a = ids(selectBrowseStack(quotes, { limit: 5, seed: 'a' }))
    const b = ids(selectBrowseStack(quotes, { limit: 5, seed: 'b' }))

    // Assert
    expect(a).toHaveLength(5)
    expect(new Set(a).size).toBe(5)
    expect(b).not.toEqual(a)
  })
})

describe('selectDailyStack – Determinismus', () => {
  function fixture() {
    return Array.from({ length: 8 }, (_, index) => makeQuote({ author: `Autor ${index}`, likes: index % 3 }))
  }

  it('liefert bei gleicher Eingabe und gleichem Datum identische Reihenfolge', () => {
    // Arrange
    const quotes = fixture()
    const date = new Date('2026-03-10T10:00:00+01:00')
    const options = { limit: 5, date } as const

    // Act
    const first = ids(selectDailyStack(quotes, options))
    const second = ids(selectDailyStack(quotes, options))

    // Assert
    expect(second).toEqual(first)
  })

  it('liefert für ein anderes Datum eine gültige Auswahl (Reihenfolge darf abweichen)', () => {
    // Arrange
    const quotes = fixture()
    const otherDate = new Date('2026-03-11T10:00:00+01:00')

    // Act
    const result = ids(selectDailyStack(quotes, { limit: 5, date: otherDate }))

    // Assert
    // Keine Ungleichheit behaupten: bei gleichem Score-Ranking könnte sie zufällig gleich sein.
    expect(result).toHaveLength(5)
    expect(new Set(result).size).toBe(5)
  })
})

describe('selectDailyStack – Autoren-Dedupe', () => {
  // strong (x1.38) und nie gelesen → Score ≥ 1380, normal ≤ 1180 (Zufall < 180): Reihenfolge ist deterministisch.
  it('nimmt pro Autor nur ein Zitat, solange genug Alternativen existieren', () => {
    // Arrange
    const first = makeQuote({ author: 'Seneca', signalStrength: 'strong' })
    const second = makeQuote({ author: 'seneca ', signalStrength: 'normal' })
    const other = makeQuote({ author: 'Epiktet', lastReviewedAt: inDays(-20), nextReviewAt: inDays(-1) })

    // Act
    const result = ids(selectDailyStack([first, second, other], { limit: 2 }))

    // Assert
    expect(result).toEqual([first.id, other.id])
  })

  it("erlaubt mehrere Zitate desselben Autors bei Buchgewicht 'often'", () => {
    // Arrange
    const first = makeQuote({ author: 'Seneca', signalStrength: 'strong', bookId: 'b-often' })
    const second = makeQuote({ author: 'Seneca', signalStrength: 'normal', bookId: 'b-often' })
    const other = makeQuote({ author: 'Epiktet', lastReviewedAt: inDays(-20), nextReviewAt: inDays(-1) })

    // Act
    const result = ids(
      selectDailyStack([first, second, other], {
        limit: 2,
        bookWeights: { 'b-often': 'often' }
      })
    )

    // Assert
    // Beide Seneca-Zitate liegen in einem 'often'-Buch und werden nicht dedupliziert.
    // Die Dedupe-Ausnahme gilt je Kandidat, nicht für den Autor insgesamt.
    expect(result).toEqual([first.id, second.id])
  })

  it('füllt mit Autoren-Duplikaten auf, wenn sonst das limit nicht erreicht würde', () => {
    // Arrange
    const first = makeQuote({ author: 'Seneca', signalStrength: 'strong' })
    const second = makeQuote({ author: 'Seneca' })

    // Act
    const result = ids(selectDailyStack([first, second], { limit: 2 }))

    // Assert
    expect(result).toEqual([first.id, second.id])
  })
})

describe('selectDailyStack – Zeitzone um Mitternacht', () => {
  it('behandelt ein um 20:00 am Vortag gelesenes Zitat um 00:30 nicht als heute gelesen', () => {
    // Arrange
    vi.setSystemTime(new Date('2026-03-10T00:30:00+01:00'))
    const readEveningBefore = makeQuote({ lastReviewedAt: '2026-03-09T20:00:00+01:00' })
    const unread = makeQuote()

    // Act
    const result = ids(selectDailyStack([readEveningBefore, unread], { limit: 5 }))

    // Assert
    expect(result).toHaveLength(2)
    expect(result).toEqual(expect.arrayContaining([readEveningBefore.id, unread.id]))
  })

  it('wechselt den Tages-Seed um Mitternacht Ortszeit (00:30 anderer Seed als am Vorabend)', () => {
    // Arrange
    const quotes = Array.from({ length: 8 }, () => makeQuote())
    const options = { limit: 5 } as const
    vi.setSystemTime(new Date('2026-03-09T20:00:00+01:00'))
    const evening = ids(selectDailyStack(quotes, options))

    // Act
    vi.setSystemTime(new Date('2026-03-10T00:30:00+01:00'))
    const afterMidnight = ids(selectDailyStack(quotes, options))

    // Assert
    expect(afterMidnight).not.toEqual(evening)
  })

  it('zählt um 10:00 Uhr am selben Tag das zuvor um 08:00 gelesene Zitat als heute gelesen', () => {
    // Arrange
    const readMorning = makeQuote({ lastReviewedAt: '2026-03-10T08:00:00+01:00' })

    // Act
    const result = selectDailyStack([readMorning], { limit: 5 })

    // Assert
    expect(result).toEqual([])
  })
})
