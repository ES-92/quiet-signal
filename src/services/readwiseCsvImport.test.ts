import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeQuote, readFixture, resetFactories } from '../test/factories'
import { buildReadwiseCsvImport } from './readwiseCsvImport'

beforeEach(() => {
  resetFactories()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-02-02T12:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('buildReadwiseCsvImport', () => {
  it('importiert die Standard-Datei und zählt Importe, Übersprungene und Bücher', () => {
    // Arrange
    const content = readFixture('readwise-standard.csv')

    // Act
    const plan = buildReadwiseCsvImport(content, [], [])

    // Assert
    expect(plan.importedCount).toBe(3)
    expect(plan.skippedCount).toBe(2) // Duplikat + Zeile ohne Titel
    expect(plan.bookCount).toBe(2)
    expect(plan.newBooks.map((b) => b.title)).toEqual(['The Art of Quiet', 'Notes on Signal'])
    expect(plan.newBooks[0]).toMatchObject({ author: 'Jane Doe', source: 'readwise' })
    expect(plan.newBooks[0].weight).toBeUndefined()
    expect(plan.newQuotes[0]).toMatchObject({
      text: 'Silence is not the absence of sound.',
      author: 'Jane Doe',
      work: 'The Art of Quiet',
      source: 'The Art of Quiet',
      bookId: plan.newBooks[0].id,
      status: 'signal',
      createdAt: '2025-03-03T09:15:00.000Z',
      updatedAt: '2025-03-03T09:15:00.000Z'
    })
    expect(plan.newQuotes[0].note).toBe('Guter Gedanke\nReadwise location: 42\nhttps://example.com/art-of-quiet')
    expect(plan.newQuotes[1].text).toBe('Attention is a "scarce" resource.')
    expect(plan.newQuotes[1].bookId).toBe(plan.newBooks[0].id)
  })

  it('splittet Tags, trimmt, macht klein, entfernt Duplikate und ergänzt readwise sowie Kategorie', () => {
    // Arrange
    const content = readFixture('readwise-standard.csv')

    // Act
    const plan = buildReadwiseCsvImport(content, [], [])

    // Assert
    expect(plan.newQuotes[0].tags).toEqual(['readwise', 'books', 'ruhe', 'fokus'])
    expect(plan.newQuotes[1].tags).toEqual(['readwise', 'books'])
  })

  it('erkennt alternative Header (Groß-/Kleinschreibung, Bindestrich) und trennt Tags auch an Semikolons', () => {
    // Arrange
    const content = readFixture('readwise-header-variants.csv')

    // Act
    const plan = buildReadwiseCsvImport(content, [], [])

    // Assert
    expect(plan.importedCount).toBe(1)
    expect(plan.newBooks[0]).toMatchObject({ title: 'Leise Zeichen', author: 'Erika Mustermann' })
    expect(plan.newQuotes[0]).toMatchObject({
      text: 'Weniger ist mehr.',
      createdAt: '2025-06-01T10:00:00.000Z'
    })
    expect(plan.newQuotes[0].tags).toEqual(['readwise', 'books', 'minimalismus', 'klarheit'])
    expect(plan.newQuotes[0].note).toBe('Merken\nReadwise location: 7\nhttps://example.com/leise')
  })

  it('verwendet ein vorhandenes Buch über bookKey wieder, ohne ein neues anzulegen', () => {
    // Arrange
    const existing = makeBook({ title: 'the art of quiet ', author: 'JANE DOE' })
    const content = readFixture('readwise-standard.csv')

    // Act
    const plan = buildReadwiseCsvImport(content, [existing], [])

    // Assert
    expect(plan.newBooks.map((b) => b.title)).toEqual(['Notes on Signal'])
    expect(plan.newQuotes[0].bookId).toBe(existing.id)
    expect(plan.newQuotes[1].bookId).toBe(existing.id)
    expect(plan.bookCount).toBe(2)
  })

  it('überspringt Duplikate gegenüber vorhandenen Zitaten (normalisiert nach Whitespace und Case)', () => {
    // Arrange
    const book = makeBook({ title: 'The Art of Quiet', author: 'Jane Doe' })
    const existingQuote = makeQuote({ text: 'silence is not the  absence of sound.', bookId: book.id })
    const content = readFixture('readwise-standard.csv')

    // Act
    const plan = buildReadwiseCsvImport(content, [book], [existingQuote])

    // Assert
    expect(plan.importedCount).toBe(2)
    expect(plan.skippedCount).toBe(3)
    expect(plan.newQuotes.map((q) => q.text)).toEqual(['Attention is a "scarce" resource.', 'Signal beats noise.'])
  })

  it('erkennt vorhandene Zitate ohne bookId über work und Autor als Duplikat', () => {
    // Arrange
    const existingQuote = makeQuote({
      text: 'Signal beats noise.',
      work: 'Notes on Signal',
      author: 'Richard Roe'
    })
    const content = readFixture('readwise-standard.csv')

    // Act
    const plan = buildReadwiseCsvImport(content, [], [existingQuote])

    // Assert
    expect(plan.newQuotes.map((q) => q.text)).not.toContain('Signal beats noise.')
    expect(plan.importedCount).toBe(2)
  })

  it('wirft bei ungültigem Datum nicht und fällt auf den Importzeitpunkt zurück', () => {
    // Arrange
    const content = readFixture('readwise-standard.csv')

    // Act
    const plan = buildReadwiseCsvImport(content, [], [])

    // Assert
    const invalid = plan.newQuotes.find((q) => q.text === 'Signal beats noise.')!
    expect(invalid.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(invalid.createdAt).toBe('2026-02-02T12:00:00.000Z')
    expect(invalid.updatedAt).toBe(invalid.createdAt)
  })

  it('liefert 0 Importe bei Datei mit nur Kopfzeile', () => {
    // Arrange
    const content = 'Highlight,Book Title,Book Author\n'

    // Act
    const plan = buildReadwiseCsvImport(content, [], [])

    // Assert
    expect(plan).toEqual({ newBooks: [], newQuotes: [], importedCount: 0, skippedCount: 0, bookCount: 0 })
  })

  it('liefert 0 Importe bei leerer Datei', () => {
    // Arrange
    const content = ''

    // Act
    const plan = buildReadwiseCsvImport(content, [], [])

    // Assert
    expect(plan.importedCount).toBe(0)
    expect(plan.newBooks).toEqual([])
  })
})
