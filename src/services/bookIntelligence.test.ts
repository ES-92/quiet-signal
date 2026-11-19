import { beforeEach, describe, expect, it } from 'vitest'
import { makeBook, makeQuote, resetFactories } from '../test/factories'
import { findBookMergeSuggestions, normalizedBookKey, shouldUpdateSourceToBookTitle } from './bookIntelligence'

beforeEach(() => {
  resetFactories()
})

describe('normalizedBookKey', () => {
  it('ignoriert Groß-/Kleinschreibung, Akzente und Satzzeichen', () => {
    // Arrange
    const a = { title: 'Café Noir!', author: 'Jean-Luc' }
    const b = { title: 'cafe noir', author: 'jean luc' }

    // Act / Assert
    expect(normalizedBookKey(a)).toBe(normalizedBookKey(b))
  })

  it('wandelt & in and und entfernt Apostrophe', () => {
    // Arrange
    const book = { title: "Pride & Prejudice's", author: undefined }

    // Act
    const key = normalizedBookKey(book)

    // Assert
    expect(key).toBe('pride and prejudices::')
  })

  it('entfernt ß ersatzlos aus dem Schlüssel', () => {
    // Arrange
    const book = { title: 'Der Prozeß', author: 'Kafka' }

    // Act
    const key = normalizedBookKey(book)

    // Assert
    // CHARACTERIZATION: vermutlich Bug, siehe Task 10 (ß verschwindet: 'Prozeß' -> 'proze', nicht 'prozess')
    expect(key).toBe('der proze::kafka')
  })
})

describe('findBookMergeSuggestions', () => {
  it('schlägt Dubletten mit gleichem normalisiertem Schlüssel vor', () => {
    // Arrange
    const a = makeBook({ title: 'Der Prozess', author: 'Kafka' })
    const b = makeBook({ title: 'der prozess', author: 'Kafka' })
    const other = makeBook({ title: 'Das Schloss', author: 'Kafka' })

    // Act
    const result = findBookMergeSuggestions([a, b, other], [])

    // Assert
    expect(result).toHaveLength(1)
    expect(result[0].books.map((x) => x.id).sort()).toEqual([a.id, b.id].sort())
  })

  it('erkennt Der Prozess und Der Prozeß (Kafka) nicht als Dublette', () => {
    // Arrange
    const a = makeBook({ title: 'Der Prozess', author: 'Kafka' })
    const b = makeBook({ title: 'Der Prozeß (Kafka)', author: 'Kafka' })

    // Act
    const result = findBookMergeSuggestions([a, b], [])

    // Assert
    // CHARACTERIZATION: vermutlich Bug, siehe Task 10 (ß und Titelzusatz verhindern den Treffer)
    expect(result).toEqual([])
  })

  it('liefert keine Vorschläge ohne Dubletten', () => {
    // Arrange
    const books = [makeBook(), makeBook()]

    // Act
    const result = findBookMergeSuggestions(books, [])

    // Assert
    expect(result).toEqual([])
  })

  it('wählt als Primärbuch das mit Autor, Quelle und mehr Zitaten, Rest sind Duplikate', () => {
    // Arrange
    const schwach = makeBook({ title: 'Walden' })
    const stark = makeBook({ title: 'walden', author: 'Thoreau' })
    const schwach2 = makeBook({ title: 'Walden', author: 'Thoreau', createdAt: '2026-02-01T00:00:00.000Z' })
    const quotes = [
      makeQuote({ bookId: schwach2.id }),
      makeQuote({ bookId: schwach2.id }),
      makeQuote({ bookId: stark.id })
    ]

    // Act
    const result = findBookMergeSuggestions([schwach, stark, schwach2], quotes)

    // Assert
    expect(result).toHaveLength(1)
    expect(result[0].primary.id).toBe(schwach2.id)
    expect(result[0].duplicates.map((d) => d.id)).toEqual([stark.id])
    expect(result[0].quoteCount).toBe(3)
  })

  it('bevorzugt bei Gleichstand das früher erstellte Buch', () => {
    // Arrange
    const spaeter = makeBook({ title: 'Walden', author: 'T', createdAt: '2026-02-01T00:00:00.000Z' })
    const frueher = makeBook({ title: 'Walden', author: 'T', createdAt: '2026-01-01T00:00:00.000Z' })

    // Act
    const result = findBookMergeSuggestions([spaeter, frueher], [])

    // Assert
    expect(result[0].primary.id).toBe(frueher.id)
  })

  it('sortiert Vorschläge nach Zitatanzahl absteigend', () => {
    // Arrange
    const a1 = makeBook({ title: 'A', author: 'x' })
    const a2 = makeBook({ title: 'a', author: 'x' })
    const b1 = makeBook({ title: 'B', author: 'x' })
    const b2 = makeBook({ title: 'b', author: 'x' })
    const quotes = [makeQuote({ bookId: b1.id }), makeQuote({ bookId: b2.id }), makeQuote({ bookId: a1.id })]

    // Act
    const result = findBookMergeSuggestions([a1, a2, b1, b2], quotes)

    // Assert
    expect(result.map((s) => s.key)).toEqual(['b::x', 'a::x'])
  })
})

describe('shouldUpdateSourceToBookTitle', () => {
  it('aktualisiert bei leerer Quelle, Quelle gleich Werk oder Dublettentitel', () => {
    // Arrange
    const duplicate = makeBook({ title: 'Walden' })

    // Act / Assert
    expect(shouldUpdateSourceToBookTitle(makeQuote({ source: undefined }), duplicate)).toBe(true)
    expect(shouldUpdateSourceToBookTitle(makeQuote({ source: 'X', work: 'X' }), duplicate)).toBe(true)
    expect(shouldUpdateSourceToBookTitle(makeQuote({ source: 'Walden' }), duplicate)).toBe(true)
    expect(shouldUpdateSourceToBookTitle(makeQuote({ source: 'Blog', work: 'Walden' }), duplicate)).toBe(false)
  })
})
