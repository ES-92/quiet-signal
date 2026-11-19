import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeQuote, resetFactories } from '../test/factories'
import type { SignalStrength } from '../types/quote'
import { applyReview, nextMorningISO, nextReviewDate, selectDailyStack } from './review'

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

describe('nextReviewDate – Intervall-Tabelle', () => {
  const cases: {
    reviewCount: number
    strength: SignalStrength
    favorite: boolean
    days: number
  }[] = [
    // reviewCount 0
    { reviewCount: 0, strength: 'normal', favorite: false, days: 1 },
    { reviewCount: 0, strength: 'strong', favorite: false, days: 1 },
    { reviewCount: 0, strength: 'quiet', favorite: false, days: 2 },
    // reviewCount 1
    { reviewCount: 1, strength: 'strong', favorite: false, days: 2 },
    { reviewCount: 1, strength: 'normal', favorite: false, days: 3 },
    { reviewCount: 1, strength: 'quiet', favorite: false, days: 5 },
    // reviewCount >= 2, Basis 7
    { reviewCount: 2, strength: 'strong', favorite: false, days: 5 },
    { reviewCount: 2, strength: 'normal', favorite: false, days: 7 },
    { reviewCount: 2, strength: 'quiet', favorite: false, days: 11 },
    { reviewCount: 9, strength: 'normal', favorite: false, days: 7 },
    // reviewCount >= 2, Favorit: Basis 5
    { reviewCount: 2, strength: 'strong', favorite: true, days: 3 },
    { reviewCount: 2, strength: 'normal', favorite: true, days: 5 },
    { reviewCount: 2, strength: 'quiet', favorite: true, days: 9 },
    // Favorit wirkt erst ab reviewCount 2
    { reviewCount: 0, strength: 'normal', favorite: true, days: 1 },
    { reviewCount: 1, strength: 'normal', favorite: true, days: 3 }
  ]

  it.each(cases)(
    'reviewCount $reviewCount, $strength, Favorit $favorite → $days Tage',
    ({ reviewCount, strength, favorite, days }) => {
      // Arrange
      const quote = makeQuote({ reviewCount, signalStrength: strength, favorite })

      // Act
      const result = nextReviewDate(quote, 'read')

      // Assert
      expect(result).toBe(inDays(days))
    }
  )

  it('behandelt fehlende signalStrength wie normal', () => {
    // Arrange
    const quote = makeQuote({ reviewCount: 1, signalStrength: undefined })

    // Act
    const result = nextReviewDate(quote, 'read')

    // Assert
    expect(result).toBe(inDays(3))
  })

  it("verschiebt bei 'later' um 6 Stunden, unabhängig von reviewCount und Stärke", () => {
    // Arrange
    const quote = makeQuote({ reviewCount: 5, signalStrength: 'quiet' })

    // Act
    const result = nextReviewDate(quote, 'later')

    // Assert
    expect(result).toBe(new Date(new Date(NOW).getTime() + 6 * hour).toISOString())
  })
})

describe('applyReview', () => {
  it("'later' setzt nur nextReviewAt (+6 h) und updatedAt, reviewCount bleibt unverändert", () => {
    // Arrange
    const quote = makeQuote({ reviewCount: 3 })

    // Act
    const patch = applyReview(quote, 'later')

    // Assert
    expect(patch.nextReviewAt).toBe('2026-03-10T15:00:00.000Z')
    expect(patch.updatedAt).toBe('2026-03-10T09:00:00.000Z')
    expect(patch).not.toHaveProperty('reviewCount')
    expect(patch).not.toHaveProperty('lastReviewedAt')
  })

  it("'read' erhöht reviewCount, setzt lastReviewedAt und plant die nächste Wiederholung", () => {
    // Arrange
    const quote = makeQuote({ reviewCount: 1, signalStrength: 'normal' })

    // Act
    const patch = applyReview(quote, 'read')

    // Assert
    expect(patch.reviewCount).toBe(2)
    expect(patch.lastReviewedAt).toBe('2026-03-10T09:00:00.000Z')
    expect(patch.updatedAt).toBe('2026-03-10T09:00:00.000Z')
    expect(patch.nextReviewAt).toBe(inDays(3))
  })

  it('verändert das übergebene Zitat nicht', () => {
    // Arrange
    const quote = makeQuote({ reviewCount: 1 })

    // Act
    applyReview(quote, 'read')

    // Assert
    expect(quote.reviewCount).toBe(1)
    expect(quote.lastReviewedAt).toBeUndefined()
  })
})

describe('selectDailyStack – Filter', () => {
  const options = { limit: 10, mode: 'balanced' } as const

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

describe('selectDailyStack – Fälligkeit und Backlog', () => {
  it('stellt fällige Zitate vor den Backlog, auch bei niedrigerem Score', () => {
    // Arrange
    // Fällig, aber 20 Tage alt gelesen: Score ca. 200 (+ Zufall < 180)
    const due = makeQuote({ lastReviewedAt: inDays(-20), nextReviewAt: inDays(-1) })
    // Backlog, nie gelesen: Score ab 1000
    const backlog = makeQuote({ nextReviewAt: inDays(3) })

    // Act
    const result = ids(selectDailyStack([backlog, due], { limit: 5, mode: 'balanced' }))

    // Assert
    expect(result).toEqual([due.id, backlog.id])
  })

  it('füllt mit Backlog auf, wenn weniger Zitate fällig sind als limit', () => {
    // Arrange
    const due = makeQuote({ lastReviewedAt: inDays(-20), nextReviewAt: inDays(-1) })
    const backlogA = makeQuote({ nextReviewAt: inDays(2) })
    const backlogB = makeQuote({ nextReviewAt: inDays(4) })
    const backlogC = makeQuote({ nextReviewAt: inDays(6) })

    // Act
    const result = ids(selectDailyStack([due, backlogA, backlogB, backlogC], { limit: 3, mode: 'balanced' }))

    // Assert
    expect(result).toHaveLength(3)
    expect(result[0]).toBe(due.id)
  })

  it('hält limit ein, auch wenn mehr Zitate fällig sind', () => {
    // Arrange
    const quotes = Array.from({ length: 8 }, () => makeQuote())

    // Act
    const result = selectDailyStack(quotes, { limit: 3, mode: 'balanced' })

    // Assert
    expect(result).toHaveLength(3)
  })

  it('behandelt Zitate ohne nextReviewAt als fällig', () => {
    // Arrange
    const quote = makeQuote({ nextReviewAt: undefined })

    // Act
    const result = ids(selectDailyStack([quote], { limit: 5, mode: 'balanced' }))

    // Assert
    expect(result).toEqual([quote.id])
  })

  it('nimmt heute noch fällige, aber nicht fällige Zitate (z. B. nach later) nicht in den Backlog', () => {
    // Arrange
    // 16:00 Ortszeit heute: noch nicht fällig, aber vor Tagesende
    const laterToday = makeQuote({ nextReviewAt: '2026-03-10T16:00:00+01:00' })
    const due = makeQuote({ nextReviewAt: inDays(-1) })

    // Act
    const result = ids(selectDailyStack([laterToday, due], { limit: 5, mode: 'balanced' }))

    // Assert
    expect(result).toEqual([due.id])
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
    const options = { limit: 5, mode: 'balanced', date } as const

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
    const result = ids(selectDailyStack(quotes, { limit: 5, mode: 'balanced', date: otherDate }))

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
    const result = ids(selectDailyStack([first, second, other], { limit: 2, mode: 'balanced' }))

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
        mode: 'balanced',
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
    const result = ids(selectDailyStack([first, second], { limit: 2, mode: 'balanced' }))

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
    const result = ids(selectDailyStack([readEveningBefore, unread], { limit: 5, mode: 'balanced' }))

    // Assert
    expect(result).toHaveLength(2)
    expect(result).toEqual(expect.arrayContaining([readEveningBefore.id, unread.id]))
  })

  it('wechselt den Tages-Seed um Mitternacht Ortszeit (00:30 anderer Seed als am Vorabend)', () => {
    // Arrange
    const quotes = Array.from({ length: 8 }, () => makeQuote())
    const options = { limit: 5, mode: 'balanced' } as const
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
    const result = selectDailyStack([readMorning], { limit: 5, mode: 'balanced' })

    // Assert
    expect(result).toEqual([])
  })
})
