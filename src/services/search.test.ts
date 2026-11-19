import { beforeEach, describe, expect, it } from 'vitest'
import { makeQuote, resetFactories } from '../test/factories'
import type { QuoteFilters } from '../types/quote'
import { emptyFilters, filterQuotes, getFilterOptions } from './search'

function filters(overrides: Partial<QuoteFilters>): QuoteFilters {
  return { ...emptyFilters, ...overrides }
}

beforeEach(() => {
  resetFactories()
})

describe('filterQuotes', () => {
  it('liefert alle Zitate bei leeren Filtern', () => {
    // Arrange
    const quotes = [makeQuote(), makeQuote()]

    // Act
    const result = filterQuotes(quotes, emptyFilters)

    // Assert
    expect(result).toHaveLength(2)
  })

  it('sucht Text ohne Beachtung von Groß-/Kleinschreibung und Leerraum', () => {
    // Arrange
    const treffer = makeQuote({ text: 'Die STILLE ist laut' })
    const keiner = makeQuote({ text: 'Lärm' })

    // Act
    const result = filterQuotes([treffer, keiner], filters({ query: '  stille ' }))

    // Assert
    expect(result).toEqual([treffer])
  })

  it('durchsucht Autor, Werk, Notiz, Personen, Ort und Tags', () => {
    // Arrange
    const quotes = [
      makeQuote({ author: 'Rilke' }),
      makeQuote({ work: 'Rilke-Briefe' }),
      makeQuote({ note: 'rilke' }),
      makeQuote({ people: ['Rilke'] }),
      makeQuote({ locationName: 'Rilkestraße' }),
      makeQuote({ tags: ['rilke'] }),
      makeQuote({ author: 'Kafka' })
    ]

    // Act
    const result = filterQuotes(quotes, filters({ query: 'rilke' }))

    // Assert
    expect(result).toHaveLength(6)
  })

  it('filtert nach Tag exakt', () => {
    // Arrange
    const a = makeQuote({ tags: ['stille', 'nacht'] })
    const b = makeQuote({ tags: ['stilleben'] })

    // Act
    const result = filterQuotes([a, b], filters({ tag: 'stille' }))

    // Assert
    expect(result).toEqual([a])
  })

  it('filtert nach Autor exakt (Groß-/Kleinschreibung relevant)', () => {
    // Arrange
    const a = makeQuote({ author: 'Kafka' })
    const b = makeQuote({ author: 'kafka' })

    // Act
    const result = filterQuotes([a, b], filters({ author: 'Kafka' }))

    // Assert
    expect(result).toEqual([a])
  })

  it('filtert nach Buch-ID und Quelle', () => {
    // Arrange
    const a = makeQuote({ bookId: 'b-1', source: 'Kindle' })
    const b = makeQuote({ bookId: 'b-2', source: 'Kindle' })
    const c = makeQuote({ bookId: 'b-1', source: 'Web' })

    // Act
    const byBook = filterQuotes([a, b, c], filters({ book: 'b-1' }))
    const bySource = filterQuotes([a, b, c], filters({ source: 'Kindle' }))

    // Assert
    expect(byBook).toEqual([a, c])
    expect(bySource).toEqual([a, b])
  })

  it('zeigt mit favoritesOnly nur Favoriten', () => {
    // Arrange
    const fav = makeQuote({ favorite: true })
    const normal = makeQuote()

    // Act
    const result = filterQuotes([fav, normal], filters({ favoritesOnly: true }))

    // Assert
    expect(result).toEqual([fav])
  })

  it('kombiniert alle Filter mit UND', () => {
    // Arrange
    const treffer = makeQuote({ text: 'Schweigen', tags: ['stille'], author: 'Kafka', bookId: 'b-1', favorite: true })
    const nurText = makeQuote({ text: 'Schweigen' })
    const keinFavorit = makeQuote({ text: 'Schweigen', tags: ['stille'], author: 'Kafka', bookId: 'b-1' })

    // Act
    const result = filterQuotes(
      [treffer, nurText, keinFavorit],
      filters({ query: 'schwei', tag: 'stille', author: 'Kafka', book: 'b-1', favoritesOnly: true })
    )

    // Assert
    expect(result).toEqual([treffer])
  })

  it('liefert leer, wenn nichts passt', () => {
    // Arrange
    const quotes = [makeQuote({ text: 'a' })]

    // Act
    const result = filterQuotes(quotes, filters({ query: 'zzz' }))

    // Assert
    expect(result).toEqual([])
  })
})

describe('getFilterOptions', () => {
  it('liefert eindeutige, sortierte Tags, Autoren und Quellen ohne leere Werte', () => {
    // Arrange
    const quotes = [
      makeQuote({ tags: ['b', 'a'], author: 'Zola', source: 'Web' }),
      makeQuote({ tags: ['a'], author: 'Adorno', source: '' }),
      makeQuote({ tags: [], author: undefined, source: 'Buch' })
    ]

    // Act
    const options = getFilterOptions(quotes)

    // Assert
    expect(options).toEqual({ tags: ['a', 'b'], authors: ['Adorno', 'Zola'], sources: ['Buch', 'Web'] })
  })
})
