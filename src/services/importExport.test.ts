import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeBook, makeQuote, readFixture, resetFactories } from '../test/factories'
import { exportCsv, exportJson, exportMarkdown, parseCsvImport, parseJsonImport, parseJsonImportBundle } from './importExport'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

beforeEach(() => {
  resetFactories()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-02-02T12:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('exportJson und parseJsonImportBundle', () => {
  it('erzeugt einen Envelope mit App-Name, Version und Exportzeitpunkt', () => {
    // Arrange
    const quotes = [makeQuote()]

    // Act
    const envelope = JSON.parse(exportJson(quotes))

    // Assert
    expect(envelope).toMatchObject({ app: 'Quiet Signal', version: 1, exportedAt: '2026-02-02T12:00:00.000Z', books: [] })
    expect(envelope.quotes).toHaveLength(1)
  })

  it('übersteht einen Roundtrip mit Texten, Tags und Buch-IDs', () => {
    // Arrange
    const book = makeBook({ title: 'The Art of Quiet', author: 'Jane Doe', weight: 'often', source: 'readwise' })
    const quotes = [
      makeQuote({ text: 'Erstes Zitat', tags: ['stille', 'fokus'], bookId: book.id, author: 'Jane Doe', favorite: true, likes: 3 }),
      makeQuote({ text: 'Zweites Zitat', tags: ['alltag'], status: 'inbox', signalStrength: 'strong', entryType: 'idea' })
    ]

    // Act
    const result = parseJsonImportBundle(exportJson(quotes, [book]))

    // Assert
    expect(result.quotes.map((q) => q.text)).toEqual(['Erstes Zitat', 'Zweites Zitat'])
    expect(result.quotes.map((q) => q.tags)).toEqual([['stille', 'fokus'], ['alltag']])
    expect(result.quotes.map((q) => q.id)).toEqual(['q-1', 'q-2'])
    expect(result.quotes[0]).toMatchObject({ bookId: 'b-1', author: 'Jane Doe', favorite: true, likes: 3 })
    expect(result.quotes[1]).toMatchObject({ status: 'inbox', signalStrength: 'strong', entryType: 'idea' })
    expect(result.books).toEqual([book])
  })

  it('importiert das aktuelle Backup inklusive Buch, Tags und Bild-Data-URL', () => {
    // Arrange
    const content = readFixture('backup-current.json')

    // Act
    const { quotes, books } = parseJsonImportBundle(content)

    // Assert
    expect(books).toHaveLength(1)
    expect(books[0]).toMatchObject({ id: 'b-1', title: 'The Art of Quiet', weight: 'often', source: 'readwise' })
    expect(quotes.map((q) => q.id)).toEqual(['q-1', 'q-2', 'q-3'])
    expect(quotes[0]).toMatchObject({ bookId: 'b-1', tags: ['stille', 'fokus'], entryType: 'book_quote', signalStrength: 'strong' })
    expect(quotes[1]).toMatchObject({ people: ['Anna', 'Ben'], locationLatitude: 52.38, status: 'inbox' })
    expect(quotes[2].imageDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(quotes[2].imageMimeType).toBe('image/png')
  })

  it('akzeptiert ein reines Array und liefert dann keine Bücher', () => {
    // Arrange
    const content = JSON.stringify([{ id: 'q-a', text: 'Nur ein Array' }])

    // Act
    const result = parseJsonImportBundle(content)

    // Assert
    expect(result.quotes.map((q) => q.text)).toEqual(['Nur ein Array'])
    expect(result.books).toEqual([])
  })

  it('parseJsonImport liefert nur die Einträge des Bundles', () => {
    // Arrange
    const content = readFixture('backup-current.json')

    // Act
    const quotes = parseJsonImport(content)

    // Assert
    expect(quotes).toHaveLength(3)
  })

  it('wirft bei einem Objekt ohne quotes-Array', () => {
    // Arrange
    const content = JSON.stringify({ books: [] })

    // Act
    const act = () => parseJsonImportBundle(content)

    // Assert
    expect(act).toThrow('JSON must be an array or an object with a quotes array.')
  })

  it('wirft bei ungültigem JSON', () => {
    // Arrange
    const content = '{ kaputt'

    // Act
    const act = () => parseJsonImportBundle(content)

    // Assert
    expect(act).toThrow(SyntaxError)
  })
})

describe('Legacy-Backup', () => {
  it('importiert ohne Fehler und lässt die Datenbank-Defaults unberührt', () => {
    // Arrange
    const content = readFixture('backup-legacy.json')

    // Act
    const { quotes, books } = parseJsonImportBundle(content)

    // Assert
    expect(quotes).toHaveLength(2)
    expect(books).toHaveLength(1)
    expect(books[0]).toMatchObject({ id: 'b-legacy-1', title: 'Alte Notizen', weight: 'normal', source: 'manual' })
  })

  it('hält die Ist-Werte der fehlenden Felder fest (status, signalStrength, entryType, people, likes)', () => {
    // Arrange
    const content = readFixture('backup-legacy.json')

    // Act
    const { quotes } = parseJsonImportBundle(content)

    // Assert
    // Der Parser setzt selbst schon die Defaults; Task 6 prüft zusätzlich upsertQuotes + listQuotes.
    expect(quotes[0]).toMatchObject({
      status: 'signal',
      signalStrength: 'normal',
      entryType: 'note',
      people: [],
      likes: 0,
      favorite: false,
      reviewCount: 0,
      tags: ['alt']
    })
    expect(quotes[1]).toMatchObject({ status: 'signal', signalStrength: 'normal', entryType: 'note', people: [], likes: 0, favorite: true, reviewCount: 3 })
  })

  it('setzt fehlende Zeitstempel auf den aktuellen Zeitpunkt', () => {
    // Arrange
    const content = JSON.stringify({ quotes: [{ id: 'q-x', text: 'ohne Zeit' }] })

    // Act
    const { quotes } = parseJsonImportBundle(content)

    // Assert
    expect(quotes[0].createdAt).toBe('2026-02-02T12:00:00.000Z')
    expect(quotes[0].updatedAt).toBe('2026-02-02T12:00:00.000Z')
  })
})

describe('präparierte Backups', () => {
  it('verwirft unerlaubte Media-URLs und ersetzt unsichere IDs', () => {
    // Arrange
    const content = readFixture('backup-malicious.json')

    // Act
    const { quotes, books } = parseJsonImportBundle(content)

    // Assert
    const [htmlImage, jsAudio, svgImage] = quotes
    expect(htmlImage.imageDataUrl).toBeUndefined()
    expect(htmlImage.imageMimeType).toBeUndefined()
    expect(htmlImage.id).not.toBe('../../x')
    expect(htmlImage.id).toMatch(uuidPattern)
    expect(htmlImage.bookId).toBeUndefined()
    expect(jsAudio.audioDataUrl).toBeUndefined()
    expect(jsAudio.id).toBe('q-ok')
    expect(svgImage.imageDataUrl).toBeUndefined()
    expect(books[0].id).not.toBe('../../b')
    expect(books[0].id).toMatch(uuidPattern)
  })

  it('übernimmt den Fallback-MIME-Typ audio/webm auch ohne gültige Audio-Data-URL', () => {
    // Arrange
    const content = readFixture('backup-malicious.json')

    // Act
    const { quotes } = parseJsonImportBundle(content)

    // Assert
    // Ist-Verhalten: audioDataUrl wird verworfen, der erlaubte Fallback-Typ bleibt als Metadatum stehen (harmlos, aber verwaist).
    expect(quotes[1].audioDataUrl).toBeUndefined()
    expect(quotes[1].audioMimeType).toBe('audio/webm')
  })

  it.each([
    ['Pfadzeichen', '../../x'],
    ['Slash', 'a/b'],
    ['Leerzeichen', 'a b'],
    ['leer', ''],
    ['zu lang (81 Zeichen)', 'a'.repeat(81)]
  ])('ersetzt eine ID mit %s durch eine UUID', (_name, id) => {
    // Arrange
    const content = JSON.stringify({ quotes: [{ id, text: 't' }] })

    // Act
    const { quotes } = parseJsonImportBundle(content)

    // Assert
    expect(quotes[0].id).toMatch(uuidPattern)
  })

  it('behält sichere IDs mit Buchstaben, Ziffern, Unterstrich und Bindestrich', () => {
    // Arrange
    const id = 'Ab_9-z'.padEnd(80, 'x')
    const content = JSON.stringify({ quotes: [{ id, text: 't' }] })

    // Act
    const { quotes } = parseJsonImportBundle(content)

    // Assert
    expect(quotes[0].id).toBe(id)
  })

  it('akzeptiert erlaubte Bild-Data-URLs mit Groß-/Kleinschreibung im MIME-Typ', () => {
    // Arrange
    const url = 'data:IMAGE/JPEG;base64,AAAA'
    const content = JSON.stringify({ quotes: [{ id: 'q-a', text: 't', imageDataUrl: url }] })

    // Act
    const { quotes } = parseJsonImportBundle(content)

    // Assert
    expect(quotes[0].imageDataUrl).toBe(url)
    expect(quotes[0].imageMimeType).toBe('image/jpeg')
  })

  it('verwirft Data-URLs ohne base64-Kennzeichnung und Audio-Typen im Bildfeld', () => {
    // Arrange
    const content = JSON.stringify({
      quotes: [
        { id: 'q-a', text: 't', imageDataUrl: 'data:image/png,AAAA' },
        { id: 'q-b', text: 't', imageDataUrl: 'data:audio/webm;base64,AAAA' },
        { id: 'q-c', text: 't', audioDataUrl: 'https://example.com/a.webm' }
      ]
    })

    // Act
    const { quotes } = parseJsonImportBundle(content)

    // Assert
    expect(quotes.map((q) => q.imageDataUrl)).toEqual([undefined, undefined, undefined])
    expect(quotes[2].audioDataUrl).toBeUndefined()
  })

  it('verwirft Media-Daten über dem Größenlimit von 8 Mio. Zeichen', () => {
    // Arrange
    const huge = `data:image/png;base64,${'A'.repeat(8_000_000)}`
    const content = JSON.stringify({ quotes: [{ id: 'q-a', text: 't', imageDataUrl: huge }] })

    // Act
    const { quotes } = parseJsonImportBundle(content)

    // Assert
    expect(quotes[0].imageDataUrl).toBeUndefined()
  })
})

describe('unvalidierte Felder (Ist-Verhalten)', () => {
  it('übernimmt eine Data-URL mit erlaubtem MIME-Typ ohne den Base64-Inhalt zu prüfen', () => {
    // Arrange
    const url = 'data:image/png;base64,<script>alert(1)</script>'
    const content = JSON.stringify({ quotes: [{ id: 'q-a', text: 't', imageDataUrl: url }] })

    // Act
    const { quotes } = parseJsonImportBundle(content)

    // Assert
    // Nur Präfix und Länge werden geprüft; als <img src> bleibt das wirkungslos, daher kein Sicherheitsbefund.
    expect(quotes[0].imageDataUrl).toBe(url)
  })

  it('erzeugt NaN bei nicht numerischem reviewCount und audioDurationMs', () => {
    // Arrange
    const content = JSON.stringify({ quotes: [{ id: 'q-a', text: 't', reviewCount: 'x', audioDurationMs: 'abc' }] })

    // Act
    const { quotes } = parseJsonImportBundle(content)

    // Assert
    // CHARACTERIZATION: vermutlich Bug, siehe Task 10
    expect(quotes[0].reviewCount).toBeNaN()
    expect(quotes[0].audioDurationMs).toBeNaN()
  })

  it('macht aus einem null-Breitengrad den Wert 0 statt undefined', () => {
    // Arrange
    const content = JSON.stringify({ quotes: [{ id: 'q-a', text: 't', locationLatitude: null, locationLongitude: '' }] })

    // Act
    const { quotes } = parseJsonImportBundle(content)

    // Assert
    // CHARACTERIZATION: vermutlich Bug, siehe Task 10
    expect(quotes[0].locationLatitude).toBe(0)
    expect(quotes[0].locationLongitude).toBe(0)
  })

  it('übernimmt createdAt ungeprüft als beliebigen String', () => {
    // Arrange
    const content = JSON.stringify({ quotes: [{ id: 'q-a', text: 't', createdAt: 'gestern' }] })

    // Act
    const { quotes } = parseJsonImportBundle(content)

    // Assert
    // CHARACTERIZATION: vermutlich Bug, siehe Task 10
    expect(quotes[0].createdAt).toBe('gestern')
  })
})

describe('exportCsv und parseCsvImport', () => {
  it('übersteht einen Roundtrip mit Komma, Anführungszeichen und Zeilenumbruch im Text', () => {
    // Arrange
    const text = 'Erstens, zweitens "drittens"\nund eine neue Zeile'
    const quote = makeQuote({ text, author: 'Müller, Anna', tags: ['a', 'b'], note: 'Notiz "mit" Komma, ok' })

    // Act
    const [imported] = parseCsvImport(exportCsv([quote]))

    // Assert
    expect(imported.text).toBe(text)
    expect(imported.author).toBe('Müller, Anna')
    expect(imported.tags).toEqual(['a', 'b'])
    expect(imported.note).toBe('Notiz "mit" Komma, ok')
  })

  it('übernimmt Status, Typ, Personen und Ort im Roundtrip', () => {
    // Arrange
    const quote = makeQuote({
      text: 'Spaziergang',
      status: 'inbox',
      signalStrength: 'quiet',
      entryType: 'conversation',
      people: ['Anna', 'Ben'],
      locationName: 'Eilenriede',
      locationLatitude: 52.38,
      locationLongitude: 9.76,
      favorite: true,
      likes: 4
    })

    // Act
    const [imported] = parseCsvImport(exportCsv([quote]))

    // Assert
    expect(imported).toMatchObject({
      status: 'inbox',
      signalStrength: 'quiet',
      entryType: 'conversation',
      people: ['Anna', 'Ben'],
      locationName: 'Eilenriede',
      locationLatitude: 52.38,
      locationLongitude: 9.76,
      favorite: true,
      likes: 4
    })
  })

  it('exportiert nur die Kopfzeile bei leerer Liste und importiert daraus nichts', () => {
    // Arrange
    const csv = exportCsv([])

    // Act
    const imported = parseCsvImport(csv)

    // Assert
    expect(csv.split('\n')).toHaveLength(1)
    expect(imported).toEqual([])
  })

  it('vergibt beim CSV-Import neue IDs, weil die Spalte id nicht exportiert wird', () => {
    // Arrange
    const quote = makeQuote({ text: 'Hallo' })

    // Act
    const [imported] = parseCsvImport(exportCsv([quote]))

    // Assert
    expect(imported.id).not.toBe(quote.id)
    expect(imported.id).toMatch(uuidPattern)
  })

  it('verwirft Media-URLs auch in CSV-Spalten', () => {
    // Arrange
    const csv = 'text,imageDataUrl,audioDataUrl\nHallo,"data:text/html;base64,AAAA",javascript:alert(1)'

    // Act
    const [imported] = parseCsvImport(csv)

    // Assert
    expect(imported.imageDataUrl).toBeUndefined()
    expect(imported.audioDataUrl).toBeUndefined()
  })
})

describe('exportMarkdown', () => {
  it('rendert Text als Zitatblock mit Autor, Werk, Jahr, Tags und Notiz', () => {
    // Arrange
    const quotes = [
      makeQuote({ text: 'Silence is not the absence of sound.', author: 'Jane Doe', work: 'The Art of Quiet', year: '2019', tags: ['stille', 'fokus'], note: 'Kapitel 3' }),
      makeQuote({ text: 'Ein Gespräch', entryType: 'conversation', occurredAt: '2026-01-20', people: ['Anna'], locationName: 'Eilenriede' })
    ]

    // Act
    const markdown = exportMarkdown(quotes)

    // Assert
    expect(markdown).toContain('> Silence is not the absence of sound.')
    expect(markdown).toContain('- Jane Doe, The Art of Quiet, 2019')
    expect(markdown).toMatchInlineSnapshot(`
      "> Silence is not the absence of sound.

      - Jane Doe, The Art of Quiet, 2019

      Type: note

      Tags: #stille #fokus

      Note: Kapitel 3

      ---

      > Ein Gespräch



      Type: conversation
      Date: 2026-01-20
      People: Anna
      Location: Eilenriede"
    `)
  })

  it('beschriftet Einträge ohne Text als Foto- bzw. Sprachnotiz', () => {
    // Arrange
    const quotes = [
      makeQuote({ text: '', imageDataUrl: 'data:image/png;base64,AAAA', entryType: 'observation' }),
      makeQuote({ text: '', audioDataUrl: 'data:audio/webm;base64,AAAA' })
    ]

    // Act
    const markdown = exportMarkdown(quotes)

    // Assert
    expect(markdown).toContain('[Photo note]')
    expect(markdown).toContain('[Voice note]')
  })

  it('liefert für eine leere Liste einen leeren String', () => {
    // Arrange / Act
    const markdown = exportMarkdown([])

    // Assert
    expect(markdown).toBe('')
  })
})
