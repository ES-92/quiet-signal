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

describe('Aktivitätsprotokoll im Import/Export', () => {
  it('reicht activity im JSON-Rundlauf durch', () => {
    // Arrange
    const activity = [
      { at: '2026-01-05T09:00:00.000Z', type: 'more' as const },
      { at: '2026-01-06T09:00:00.000Z', type: 'thought' as const }
    ]
    const quote = makeQuote({ activity })

    // Act
    const [result] = parseJsonImport(exportJson([quote]))

    // Assert
    expect(result.activity).toEqual(activity)
  })

  it('verwirft ungültige Ereignisse und normalisiert Daten auf ISO', () => {
    // Arrange
    const content = JSON.stringify([
      {
        text: 'x',
        activity: [
          { at: '2026-01-05T10:00:00+01:00', type: 'rest' },
          { at: 'nie', type: 'more' },
          { at: '2026-01-05T10:00:00Z', type: 'like' },
          'more'
        ]
      }
    ])

    // Act
    const [result] = parseJsonImport(content)

    // Assert
    expect(result.activity).toEqual([{ at: '2026-01-05T09:00:00.000Z', type: 'rest' }])
  })

  it('begrenzt importierte Protokolle auf die letzten 200 Ereignisse', () => {
    // Arrange
    const activity = Array.from({ length: 205 }, (_, index) => ({ at: new Date(Date.UTC(2026, 0, 1, index)).toISOString(), type: 'less' }))

    // Act
    const [result] = parseJsonImport(JSON.stringify([{ text: 'x', activity }]))

    // Assert
    expect(result.activity).toHaveLength(200)
    expect(result.activity?.[0].at).toBe(activity[5].at)
  })

  it('lässt activity im CSV-Export weg und ignoriert eine CSV-Spalte', () => {
    // Arrange
    const quote = makeQuote({ activity: [{ at: '2026-01-05T09:00:00.000Z', type: 'more' }] })

    // Act
    const csv = exportCsv([quote])
    const [result] = parseCsvImport('text,activity\nZitat,more')

    // Assert
    expect(csv).not.toContain('activity')
    expect(result.activity).toBeUndefined()
  })
})

describe('Stille und Gedanken im Import/Export', () => {
  const thought = { id: 'th-1', text: 'Noch ein Gedanke', createdAt: '2026-01-05T09:00:00.000Z', fromNote: true }

  it('übersteht einen JSON-Roundtrip mit Status, Abstand und Gedanken', () => {
    // Arrange
    const quote = makeQuote({ status: 'rest', reviewIntervalDays: 8, thoughts: [thought] })

    // Act
    const [result] = parseJsonImport(exportJson([quote]))

    // Assert
    expect(result).toMatchObject({ status: 'rest', reviewIntervalDays: 8, thoughts: [thought] })
  })

  it('übersteht einen CSV-Roundtrip für Status und Abstand und exportiert Gedanken lesbar', () => {
    // Arrange
    const second = { id: 'th-2', text: 'Zweiter', createdAt: '2026-01-06T09:00:00.000Z' }
    const quote = makeQuote({ status: 'rest', reviewIntervalDays: 8, thoughts: [thought, second] })

    // Act
    const csv = exportCsv([quote])
    const [result] = parseCsvImport(csv)

    // Assert
    expect(result).toMatchObject({ status: 'rest', reviewIntervalDays: 8 })
    expect(csv).toContain(`${thought.createdAt} ${thought.text}\n${second.createdAt} ${second.text}`)
    expect(result.thoughts).toEqual([
      { id: expect.stringMatching(uuidPattern), text: thought.text, createdAt: thought.createdAt },
      { id: expect.stringMatching(uuidPattern), text: second.text, createdAt: second.createdAt }
    ])
  })

  it('liest CSV-Gedanken mit Leerzeichen und Anführungszeichen zurück und überspringt Zeilen ohne Datum oder Text', () => {
    // Arrange
    const field = [
      '2026-01-05T09:00:00.000Z Ein Gedanke, mit ""Zitat""',
      'ohne Datum',
      '2026-01-06T09:00:00.000Z   ',
      '2026-01-07T09:00:00.000Z Letzter'
    ].join('\n')
    const content = `text,thoughts\nZitat,"${field}"`

    // Act
    const [result] = parseCsvImport(content)

    // Assert
    expect(result.thoughts?.map((item) => [item.createdAt, item.text])).toEqual([
      ['2026-01-05T09:00:00.000Z', 'Ein Gedanke, mit "Zitat"\nohne Datum'],
      ['2026-01-07T09:00:00.000Z', 'Letzter']
    ])
  })

  it('behält mehrzeilige Gedanken mit Zahlenzeilen im Roundtrip exakt bei', () => {
    // Arrange
    const multiline = { id: 'th-9', text: 'Drei Dinge:\n1. Punkt\n2024\n3.\n\n1/2 Rest', createdAt: '2026-01-05T09:00:00.000Z' }
    const next = { id: 'th-10', text: 'Danach', createdAt: '2026-01-06T09:00:00.000Z' }
    const quote = makeQuote({ thoughts: [multiline, next] })

    // Act
    const [result] = parseCsvImport(exportCsv([quote]))

    // Assert
    expect(result.thoughts?.map((item) => [item.createdAt, item.text])).toEqual([
      [multiline.createdAt, multiline.text],
      [next.createdAt, next.text]
    ])
  })

  it('wendet auf CSV-Gedanken dieselbe Obergrenze an wie beim JSON-Import', () => {
    // Arrange
    const many = Array.from({ length: 600 }, (_, index) => {
      const day = new Date(Date.UTC(2026, 0, 1) + index * 86_400_000).toISOString()
      return `${day} g${index}`
    }).join('\n')

    // Act
    const [result] = parseCsvImport(`text,thoughts\nx,"${many}"`)

    // Assert
    expect(result.thoughts).toHaveLength(500)
  })

  it('behält Gedanken im Roundtrip exportCsv und parseCsvImport (Text und createdAt)', () => {
    // Arrange
    const quote = makeQuote({ thoughts: [thought] })

    // Act
    const [result] = parseCsvImport(exportCsv([quote]))

    // Assert
    expect(result.thoughts).toMatchObject([{ text: thought.text, createdAt: thought.createdAt }])
  })

  it('fällt bei unbekanntem Status auf signal zurück', () => {
    // Arrange
    const content = JSON.stringify([{ text: 'x', status: 'archived' }])

    // Act
    const [result] = parseJsonImport(content)

    // Assert
    expect(result.status).toBe('signal')
  })

  it.each([0, -3, Number.NaN, 366, 2.5, 'abc', true, [7]])('lässt ungültiges reviewIntervalDays %s weg', (value) => {
    // Arrange
    const content = JSON.stringify([{ text: 'x', reviewIntervalDays: value }])

    // Act
    const [result] = parseJsonImport(content)

    // Assert
    expect(result.reviewIntervalDays).toBeUndefined()
  })

  it('übernimmt nur gültige Gedanken, vergibt fehlende IDs und behält fromNote nur bei true', () => {
    // Arrange
    const content = JSON.stringify([
      {
        text: 'x',
        thoughts: [
          { id: 'ok-1', text: 'Gültig', createdAt: '2026-01-05T09:00:00.000Z', fromNote: false },
          { text: 'Ohne ID', createdAt: '2026-01-06T09:00:00.000Z', fromNote: true },
          { id: 'bad-1', text: 42, createdAt: '2026-01-07T09:00:00.000Z' },
          { id: 'bad-2', text: 'Ohne Datum' },
          'kein Objekt'
        ]
      }
    ])

    // Act
    const [result] = parseJsonImport(content)

    // Assert
    expect(result.thoughts).toHaveLength(2)
    expect(result.thoughts?.[0]).toEqual({ id: 'ok-1', text: 'Gültig', createdAt: '2026-01-05T09:00:00.000Z' })
    expect(result.thoughts?.[1].id).toMatch(uuidPattern)
    expect(result.thoughts?.[1]).toMatchObject({ text: 'Ohne ID', fromNote: true })
  })

  it('speichert das Datum eines Gedankens als ISO-String', () => {
    // Arrange
    const content = JSON.stringify([{ text: 'x', thoughts: [{ id: 't', text: 'Gedanke', createdAt: 'Jan 1 2026 10:00 UTC' }] }])

    // Act
    const [result] = parseJsonImport(content)

    // Assert
    expect(result.thoughts?.[0].createdAt).toBe('2026-01-01T10:00:00.000Z')
  })

  it('verwirft leere Texte und unparsbare Daten, kürzt Texte und vergibt doppelte IDs neu', () => {
    // Arrange
    const content = JSON.stringify([
      {
        text: 'x',
        thoughts: [
          { id: 'dup', text: '   ', createdAt: '2026-01-05T09:00:00.000Z' },
          { id: 'a', text: 'Kein Datum', createdAt: 'gestern' },
          { id: 'dup', text: 'L'.repeat(10_050), createdAt: '2026-01-06T09:00:00.000Z' },
          { id: 'dup', text: 'Zweiter', createdAt: '2026-01-07T09:00:00.000Z' }
        ]
      }
    ])

    // Act
    const [result] = parseJsonImport(content)

    // Assert
    expect(result.thoughts).toHaveLength(2)
    expect(result.thoughts?.[0].id).toBe('dup')
    expect(result.thoughts?.[0].text).toHaveLength(10_000)
    expect(result.thoughts?.[1].id).toMatch(uuidPattern)
  })

  it('behält höchstens die 500 neuesten Gedanken', () => {
    // Arrange
    const thoughts = Array.from({ length: 502 }, (_, index) => ({
      id: `t-${index}`,
      text: `Gedanke ${index}`,
      createdAt: new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString()
    }))

    // Act
    const [result] = parseJsonImport(JSON.stringify([{ text: 'x', thoughts }]))

    // Assert
    expect(result.thoughts).toHaveLength(500)
    expect(result.thoughts?.some((thought) => thought.id === 't-0' || thought.id === 't-1')).toBe(false)
    expect(result.thoughts?.some((thought) => thought.id === 't-501')).toBe(true)
  })

  it('lässt thoughts weg, wenn kein Array geliefert wird', () => {
    // Arrange
    const content = JSON.stringify([{ text: 'x', thoughts: 'nope' }])

    // Act
    const [result] = parseJsonImport(content)

    // Assert
    expect(result.thoughts).toBeUndefined()
  })
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

  it('reicht Stärke, Art, Ort und Buchgewicht im JSON-Roundtrip unverändert durch', () => {
    // Arrange
    const book = makeBook({ title: 'The Art of Quiet', weight: 'rare', source: 'kindle' })
    const quotes = [
      makeQuote({
        bookId: book.id,
        signalStrength: 'quiet',
        entryType: 'observation',
        locationName: 'Eilenriede',
        locationLatitude: 52.38,
        locationLongitude: 9.76,
        people: []
      }),
      makeQuote({ signalStrength: 'normal', entryType: 'note', people: [] }),
      makeQuote({ people: [] })
    ]

    // Act
    const result = parseJsonImportBundle(exportJson(quotes, [book]))

    // Assert
    expect(result.quotes).toEqual(quotes)
    expect(result.books).toEqual([book])
    expect(result.quotes[2]).not.toHaveProperty('signalStrength', 'normal')
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
    expect(books[0]).toMatchObject({ id: 'b-legacy-1', title: 'Alte Notizen', source: 'manual' })
    expect(books[0].weight).toBeUndefined()
  })

  it('ergänzt fehlende Felder (status, people, likes), erfindet aber keine Stärke und keine Art', () => {
    // Arrange
    const content = readFixture('backup-legacy.json')

    // Act
    const { quotes } = parseJsonImportBundle(content)

    // Assert
    // Der Parser setzt selbst schon die Defaults; Task 6 prüft zusätzlich upsertQuotes + listQuotes.
    expect(quotes[0]).toMatchObject({
      status: 'signal',
      people: [],
      likes: 0,
      favorite: false,
      reviewCount: 0,
      tags: ['alt']
    })
    expect(quotes[1]).toMatchObject({ status: 'signal', people: [], likes: 0, favorite: true, reviewCount: 3 })
    expect(quotes[0].signalStrength).toBeUndefined()
    expect(quotes[0].entryType).toBeUndefined()
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

  it('fällt bei nicht numerischem reviewCount auf 0 und bei audioDurationMs auf undefined zurück', () => {
    // Arrange
    const content = JSON.stringify({ quotes: [{ id: 'q-a', text: 't', reviewCount: 'x', audioDurationMs: 'abc' }] })

    // Act
    const { quotes } = parseJsonImportBundle(content)

    // Assert
    expect(quotes[0].reviewCount).toBe(0)
    expect(quotes[0].audioDurationMs).toBeUndefined()
  })

  it('macht aus null, leerem String und nicht numerischen Koordinaten undefined statt 0', () => {
    // Arrange
    const content = JSON.stringify({
      quotes: [
        { id: 'q-a', text: 't', locationLatitude: null, locationLongitude: '' },
        { id: 'q-b', text: 't', locationLatitude: 'abc', locationLongitude: '  ' }
      ]
    })

    // Act
    const { quotes } = parseJsonImportBundle(content)

    // Assert
    expect(quotes[0].locationLatitude).toBeUndefined()
    expect(quotes[0].locationLongitude).toBeUndefined()
    expect(quotes[1].locationLatitude).toBeUndefined()
    expect(quotes[1].locationLongitude).toBeUndefined()
  })

  it('behält ausdrücklich angegebene Nullwerte (Zahl 0 und "0") bei Koordinaten und Audiodauer', () => {
    // Arrange
    const content = JSON.stringify({
      quotes: [
        { id: 'q-a', text: 't', locationLatitude: 0, locationLongitude: 0, audioDurationMs: 0 },
        { id: 'q-b', text: 't', locationLatitude: '0', locationLongitude: '0', audioDurationMs: '0' }
      ]
    })

    // Act
    const { quotes } = parseJsonImportBundle(content)

    // Assert
    for (const quote of quotes) {
      expect(quote.locationLatitude).toBe(0)
      expect(quote.locationLongitude).toBe(0)
      expect(quote.audioDurationMs).toBe(0)
    }
  })

  it('übersteht den JSON-Roundtrip eines Zitats mit Breiten- und Längengrad 0', () => {
    // Arrange
    const quote = makeQuote({ locationLatitude: 0, locationLongitude: 0 })

    // Act
    const { quotes } = parseJsonImportBundle(exportJson([quote]))

    // Assert
    expect(quotes[0].locationLatitude).toBe(0)
    expect(quotes[0].locationLongitude).toBe(0)
  })

  it('übersteht den CSV-Roundtrip eines Zitats mit Breiten- und Längengrad 0', () => {
    // Arrange
    const quote = makeQuote({ locationLatitude: 0, locationLongitude: 0 })

    // Act
    const [imported] = parseCsvImport(exportCsv([quote]))

    // Assert
    expect(imported.locationLatitude).toBe(0)
    expect(imported.locationLongitude).toBe(0)
  })

  it('ersetzt ein unlesbares createdAt durch den aktuellen Zeitpunkt', () => {
    // Arrange
    const content = JSON.stringify({ quotes: [{ id: 'q-a', text: 't', createdAt: 'gestern' }] })

    // Act
    const { quotes } = parseJsonImportBundle(content)

    // Assert
    expect(quotes[0].createdAt).toBe('2026-02-02T12:00:00.000Z')
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

describe('Datumsfelder im Import', () => {
  const now = '2026-02-02T12:00:00.000Z'
  const invalidDates: unknown[] = ['foo', '', '   ', 12345, 0, null, true, {}, '2026-13-45', '+999999-01-01T00:00:00Z', 'Invalid Date']

  it.each(invalidDates)('fällt bei ungültigem createdAt/updatedAt %j auf jetzt zurück', (value) => {
    // Arrange
    const content = JSON.stringify({ quotes: [{ id: 'q', text: 'x', createdAt: value, updatedAt: value }] })

    // Act
    const [quote] = parseJsonImportBundle(content).quotes

    // Assert
    expect(quote.createdAt).toBe(now)
    expect(quote.updatedAt).toBe(now)
  })

  it.each(invalidDates)('verwirft ungültige optionale Review-Daten %j', (value) => {
    // Arrange
    const content = JSON.stringify({ quotes: [{ id: 'q', text: 'x', lastReviewedAt: value, nextReviewAt: value }] })

    // Act
    const [quote] = parseJsonImportBundle(content).quotes

    // Assert
    expect(quote.lastReviewedAt).toBeUndefined()
    expect(quote.nextReviewAt).toBeUndefined()
  })

  it('normalisiert gültige Daten auf ISO', () => {
    // Arrange
    const content = JSON.stringify({
      quotes: [
        {
          id: 'q',
          text: 'x',
          createdAt: '2025-01-05T10:00:00+01:00',
          updatedAt: '2025-01-06',
          lastReviewedAt: ' 2025-01-07T08:00:00.000Z ',
          nextReviewAt: '2025-02-01T05:00:00Z'
        }
      ]
    })

    // Act
    const [quote] = parseJsonImportBundle(content).quotes

    // Assert
    expect(quote.createdAt).toBe('2025-01-05T09:00:00.000Z')
    expect(quote.updatedAt).toBe('2025-01-06T00:00:00.000Z')
    expect(quote.lastReviewedAt).toBe('2025-01-07T08:00:00.000Z')
    expect(quote.nextReviewAt).toBe('2025-02-01T05:00:00.000Z')
  })

  it('übernimmt keine Papierkorb- oder Schlummer-Daten aus dem Import', () => {
    // Arrange
    const content = JSON.stringify({ quotes: [{ id: 'q', text: 'x', snoozedUntil: 'foo', deletedAt: 'foo' }] })

    // Act
    const [quote] = parseJsonImportBundle(content).quotes

    // Assert
    expect(quote.snoozedUntil).toBeUndefined()
    expect(quote.deletedAt).toBeUndefined()
  })

  it('validiert Datumsfelder auch im CSV-Import', () => {
    // Arrange
    const content = 'text,createdAt,nextReviewAt\nHallo,foo,bar'

    // Act
    const [quote] = parseCsvImport(content)

    // Assert
    expect(quote.createdAt).toBe(now)
    expect(quote.nextReviewAt).toBeUndefined()
  })

  it.each(invalidDates)('fällt bei Büchern mit ungültigem Datum %j auf jetzt zurück', (value) => {
    // Arrange
    const content = JSON.stringify({ quotes: [], books: [{ id: 'b', title: 'B', createdAt: value, updatedAt: value }] })

    // Act
    const [book] = parseJsonImportBundle(content).books

    // Assert
    expect(book.createdAt).toBe(now)
    expect(book.updatedAt).toBe(now)
  })
})
