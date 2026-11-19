import { beforeEach, describe, expect, it } from 'vitest'
import { readFixture, resetFactories } from '../test/factories'
import { buildKindleImport, parseKindleClippings } from './kindleImport'

beforeEach(() => {
  resetFactories()
})

describe('parseKindleClippings', () => {
  it('liefert Titel, Autor ohne Klammern, Text und addedAt als ISO-String', () => {
    // Arrange
    const content = readFixture('kindle-en.txt')

    // Act
    const clippings = parseKindleClippings(content)

    // Assert
    expect(clippings).toHaveLength(5)
    expect(clippings[0].title).toBe('The Art of Quiet')
    expect(clippings[0].author).toBe('Jane Doe')
    expect(clippings[0].text).toBe('Silence is not the absence of sound.')
    expect(clippings[0].addedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(clippings[0].addedAt).toBe('2025-03-03T09:15:00.000Z') // 10:15 Europe/Berlin (MEZ)
    expect(clippings[4].title).toBe('Notes on Signal')
    expect(clippings[4].author).toBe('Richard Roe')
  })

  it('ignoriert die BOM und liest die deutsche „Hinzugefügt am“-Zeile', () => {
    // Arrange
    const content = readFixture('kindle-de-bom.txt')

    // Act
    const clippings = parseKindleClippings(content)

    // Assert
    expect(content.charCodeAt(0)).toBe(0xfeff)
    expect(clippings).toHaveLength(1)
    expect(clippings[0].title.startsWith('﻿')).toBe(false)
    expect(clippings[0].title).toBe('Leise Zeichen')
    expect(clippings[0].text).toBe('Weniger ist mehr.')
    // CHARACTERIZATION: vermutlich Bug, siehe Task 10
    // Ist-Zustand: "3. März 2025" (deutsches Datumsformat) wird von Date.parse nicht erkannt -> kein addedAt.
    expect(clippings[0].addedAt).toBeUndefined()
  })

  it('liefert bei Windows-Zeilenenden (CRLF) Titel und Texte ohne \\r', () => {
    // Arrange
    const content = readFixture('kindle-crlf.txt')

    // Act
    const clippings = parseKindleClippings(content)

    // Assert
    expect(clippings).toHaveLength(5)
    for (const clipping of clippings) {
      expect(clipping.title.endsWith('\r')).toBe(false)
      expect(clipping.text.endsWith('\r')).toBe(false)
      expect(clipping.title).not.toContain('\r')
      expect(clipping.text).not.toContain('\r')
    }
  })

  it('liefert bei CRLF exakt dieselben Clippings (inkl. addedAt) wie bei LF', () => {
    // Arrange
    const lf = parseKindleClippings(readFixture('kindle-en.txt'))

    // Act
    const crlf = parseKindleClippings(readFixture('kindle-crlf.txt'))

    // Assert
    expect(crlf).toEqual(lf)
    expect(crlf.every((c) => c.addedAt !== undefined)).toBe(true)
  })

  it('liefert für einen leeren String keine Clippings und wirft nicht', () => {
    // Arrange
    const content = ''

    // Act
    const act = () => parseKindleClippings(content)

    // Assert
    expect(act).not.toThrow()
    expect(act()).toEqual([])
  })
})

describe('buildKindleImport', () => {
  it('zählt importierte, übersprungene Markierungen und Bücher', () => {
    // Arrange
    const content = readFixture('kindle-en.txt')

    // Act
    const plan = buildKindleImport(content, [], [])

    // Assert
    expect(plan.bookCount).toBe(2)
    expect(plan.newBooks).toHaveLength(2)
    // 5 Clippings: 1 exaktes Duplikat wird übersprungen.
    expect(plan.skippedCount).toBe(1)
    // CHARACTERIZATION: vermutlich Bug, siehe Task 10
    // Die kürzere Markierung steht zuerst und wird schon importiert; die überholte (längere)
    // Fassung wird zusätzlich importiert, die kürzere nicht entfernt -> beide landen in newQuotes.
    expect(plan.importedCount).toBe(4)
    expect(plan.newQuotes.map((q) => q.text)).toEqual([
      'Silence is not the absence of sound.',
      'Attention is the rarest form of generosity',
      'Attention is the rarest form of generosity, and the most underrated.',
      'Keep what resonates.'
    ])
  })

  it('überspringt eine kürzere Markierung, wenn die längere zuerst kommt', () => {
    // Arrange
    const content = [
      'Buch (Autor, Eva)',
      '- Your Highlight | Added on Monday, March 3, 2025 10:15:00 AM',
      '',
      'Lang genug, um den Kurztext zu enthalten.',
      '==========',
      'Buch (Autor, Eva)',
      '- Your Highlight | Added on Monday, March 3, 2025 10:16:00 AM',
      '',
      'Lang genug',
      '=========='
    ].join('\n')

    // Act
    const plan = buildKindleImport(content, [], [])

    // Assert
    expect(plan.importedCount).toBe(1)
    expect(plan.skippedCount).toBe(1)
  })

  it('importiert beim erneuten Import mit den Ergebnissen als Bestand nichts', () => {
    // Arrange
    const content = readFixture('kindle-en.txt')
    const first = buildKindleImport(content, [], [])

    // Act
    const second = buildKindleImport(content, first.newBooks, first.newQuotes)

    // Assert
    expect(second.importedCount).toBe(0)
    expect(second.newBooks).toHaveLength(0)
    expect(second.newQuotes).toHaveLength(0)
    expect(second.bookCount).toBe(2)
  })

  it('liefert für einen leeren String einen leeren Plan ohne Throw', () => {
    // Arrange
    const content = ''

    // Act
    const plan = buildKindleImport(content, [], [])

    // Assert
    expect(plan).toEqual({
      newBooks: [],
      newQuotes: [],
      importedCount: 0,
      skippedCount: 0,
      bookCount: 0
    })
  })
})
