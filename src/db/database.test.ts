import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseJsonImportBundle } from '../services/importExport'
import {
  disableEncryptionRecord,
  enableEncryption,
  isEncryptionEnabled,
  lockEncryption,
  unlockEncryption
} from '../services/security'
import { makeBook, makeQuote, readFixture, resetFactories } from '../test/factories'
import {
  clearQuotes,
  createBook,
  createQuote,
  db,
  decryptAllQuotesAndDisable,
  deleteBook,
  deleteQuote,
  emptyTrash,
  encryptAllQuotes,
  getQuote,
  listBooks,
  listQuotes,
  listTrashed,
  normalizePeople,
  normalizeTags,
  updateBook,
  updateQuote,
  upsertQuotes,
  upsertBooks
} from './database'

// PBKDF2 ist langsam; Timeout nur für diese Datei erhöhen.
vi.setConfig({ testTimeout: 30000 })

// Isolation: fake-indexeddb/auto teilt eine IndexedDB-Instanz über alle Tests einer Datei.
// Vor jedem Test wird die Datenbank gelöscht (db.delete() schließt die Verbindung und
// entfernt die DB) und neu geöffnet; das Schema entsteht dabei frisch aus den Versionen 1-5.
beforeEach(async () => {
  resetFactories()
  await db.delete()
  await db.open()
})

afterEach(() => {
  vi.useRealTimers()
  lockEncryption()
  disableEncryptionRecord()
})

describe('Normalisierung', () => {
  it('normalisiert Tags (Komma-Listen, Leerzeichen, Duplikate, Kleinschreibung)', () => {
    // Arrange
    const tags = [' Fokus, Ruhe ', 'fokus', '', 'Ruhe']

    // Act
    const result = normalizeTags(tags)

    // Assert
    expect(result).toEqual(['fokus', 'ruhe'])
  })

  it('normalisiert Personen ohne Kleinschreibung', () => {
    // Arrange
    const people = [' Anna, Ben ', 'Anna', '']

    // Act
    const result = normalizePeople(people)

    // Assert
    expect(result).toEqual(['Anna', 'Ben'])
  })
})

describe('Quotes: Anlegen und Aktualisieren', () => {
  it('legt ein Zitat mit Standardwerten an und listet es', async () => {
    // Arrange
    const input = { text: 'Hallo', tags: ['A, b'], favorite: false }

    // Act
    const created = await createQuote(input as never)
    const list = await listQuotes()

    // Assert
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      id: created.id,
      likes: 0,
      status: 'signal',
      signalStrength: 'normal',
      entryType: 'note',
      people: [],
      tags: ['a', 'b'],
      reviewCount: 0
    })
  })

  it('normalisiert tags und people beim Aktualisieren', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1' })])

    // Act
    const updated = await updateQuote('q1', {
      tags: [' Eins, zwei ', 'EINS'],
      people: [' Anna, Ben ', 'Anna']
    })

    // Assert
    expect(updated?.tags).toEqual(['eins', 'zwei'])
    expect(updated?.people).toEqual(['Anna', 'Ben'])
  })

  it('liefert undefined beim Aktualisieren einer unbekannten ID', async () => {
    // Arrange / Act
    const result = await updateQuote('gibt-es-nicht', { text: 'x' })

    // Assert
    expect(result).toBeUndefined()
    expect(await getQuote('gibt-es-nicht')).toBeUndefined()
  })

  it('entfernt Zitate einzeln und per clearQuotes', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'a' }), makeQuote({ id: 'b' }), makeQuote({ id: 'c' })])

    // Act
    await deleteQuote('a')
    const nachEinzel = (await listQuotes()).map((q) => q.id).sort()
    await clearQuotes()

    // Assert
    expect(nachEinzel).toEqual(['b', 'c'])
    expect(await listQuotes()).toEqual([])
  })

  it('sortiert listQuotes nach createdAt absteigend', async () => {
    // Arrange
    await upsertQuotes([
      makeQuote({ id: 'alt', createdAt: '2026-01-01T00:00:00.000Z' }),
      makeQuote({ id: 'neu', createdAt: '2026-03-01T00:00:00.000Z' })
    ])

    // Act
    const ids = (await listQuotes()).map((q) => q.id)

    // Assert
    expect(ids).toEqual(['neu', 'alt'])
  })
})

describe('Papierkorb (Soft-Delete)', () => {
  it('blendet gelöschte Zitate aus listQuotes aus und zeigt sie in listTrashed (neueste zuerst)', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'a' }), makeQuote({ id: 'b' }), makeQuote({ id: 'c' })])

    // Act
    await updateQuote('a', { deletedAt: '2026-02-01T10:00:00.000Z' })
    await updateQuote('b', { deletedAt: '2026-02-03T10:00:00.000Z' })

    // Assert
    expect((await listQuotes()).map((q) => q.id)).toEqual(['c'])
    expect((await listTrashed()).map((q) => q.id)).toEqual(['b', 'a'])
  })

  it('emptyTrash entfernt nur Papierkorb-Einträge', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'a' }), makeQuote({ id: 'b', deletedAt: '2026-02-01T10:00:00.000Z' })])

    // Act
    await emptyTrash()

    // Assert
    expect(await listTrashed()).toEqual([])
    expect((await listQuotes()).map((q) => q.id)).toEqual(['a'])
    expect(await db.quotes.count()).toBe(1)
  })
})

describe('Bücher', () => {
  it('legt Bücher an, aktualisiert, sortiert nach Titel und löscht', async () => {
    // Arrange / Act
    const b = await createBook({ title: '  Zebra  ', author: '  ' } as never)
    await createBook({ title: 'Apfel' } as never)
    const updated = await updateBook(b.id, { title: 'Zebra 2' })
    const sortiert = (await listBooks()).map((x) => x.title)
    await deleteBook(b.id)

    // Assert
    expect(b.title).toBe('Zebra')
    expect(b.author).toBeUndefined()
    expect(b.weight).toBe('normal')
    expect(updated?.title).toBe('Zebra 2')
    expect(sortiert).toEqual(['Apfel', 'Zebra 2'])
    expect((await listBooks()).map((x) => x.title)).toEqual(['Apfel'])
  })

  it('liefert undefined beim Aktualisieren eines unbekannten Buchs', async () => {
    // Arrange / Act
    const result = await updateBook('nope', { title: 'x' })

    // Assert
    expect(result).toBeUndefined()
  })
})

describe('Legacy-Daten', () => {
  it('ergänzt beim Import eines alten Backups die Standardwerte', async () => {
    // Arrange
    const bundle = parseJsonImportBundle(readFixture('backup-legacy.json'))

    // Act
    await upsertQuotes(bundle.quotes)
    const list = await listQuotes()

    // Assert
    expect(list).toHaveLength(2)
    for (const quote of list) {
      expect(quote).toMatchObject({ status: 'signal', signalStrength: 'normal', entryType: 'note', likes: 0 })
      expect(quote.people).toEqual([])
    }
  })

  it('migriert eine Version-1-Datenbank und liefert Standardwerte für Legacy-Zeilen', async () => {
    // Arrange: App-DB schließen und löschen, dann eine reine v1-DB 'quiet-signal' anlegen.
    await db.delete()
    const legacy = new Dexie('quiet-signal')
    legacy.version(1).stores({ quotes: 'id, author, source, favorite, createdAt, updatedAt, nextReviewAt, *tags' })
    await legacy.open()
    await legacy.table('quotes').put({
      id: 'legacy-row',
      text: 'Altes Zitat',
      tags: ['alt'],
      favorite: false,
      createdAt: '2025-01-01T09:00:00.000Z',
      updatedAt: '2025-01-01T09:00:00.000Z',
      reviewCount: 0
    })
    legacy.close()

    // Act: App-db öffnen führt das Upgrade v1 -> v5 aus.
    await db.open()
    const list = await listQuotes()

    // Assert
    expect(db.verno).toBe(5)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      id: 'legacy-row',
      text: 'Altes Zitat',
      status: 'signal',
      signalStrength: 'normal',
      entryType: 'note',
      likes: 0,
      people: []
    })
  })
})

describe('Verschlüsselung', () => {
  it('verschlüsselt alle Zeilen, liefert Klartext, sperrt und entschlüsselt wieder', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1', text: 'Geheim' }), makeQuote({ id: 'q2', text: 'Auch geheim' })])
    await upsertBooks([makeBook({ id: 'b1', title: 'Geheimbuch' })])

    // Act
    await enableEncryption('passwort-123')
    await encryptAllQuotes()
    const raw = await db.quotes.toArray()
    const rawBooks = await db.books.toArray()
    const entsperrt = await listQuotes()
    lockEncryption()
    const gesperrt = await listQuotes()

    // Assert
    expect(raw).toHaveLength(2)
    expect(raw.every((row) => row.encrypted === true && row.text === '')).toBe(true)
    expect(rawBooks[0].encrypted).toBe(true)
    expect(entsperrt.map((q) => q.text).sort()).toEqual(['Auch geheim', 'Geheim'])
    expect(gesperrt).toEqual([])

    // Act: wieder entsperren und Verschlüsselung abschalten
    expect(await unlockEncryption('passwort-123')).toBe(true)
    await decryptAllQuotesAndDisable()
    const klar = await db.quotes.toArray()

    // Assert
    expect(isEncryptionEnabled()).toBe(false)
    expect(klar.every((row) => !row.encrypted && row.text !== '')).toBe(true)
    expect((await listQuotes()).map((q) => q.text).sort()).toEqual(['Auch geheim', 'Geheim'])
    expect((await listBooks())[0].title).toBe('Geheimbuch')
  })

  it('wirft beim Schreiben im gesperrten Zustand "Encryption is locked."', async () => {
    // Arrange
    await enableEncryption('passwort-123')
    lockEncryption()

    // Act
    const action = createQuote({ text: 'x', tags: [], favorite: false } as never)

    // Assert
    await expect(action).rejects.toThrow('Encryption is locked.')
  })

  it('hält gesperrt auch getQuote und listTrashed leer', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1', deletedAt: '2026-02-01T10:00:00.000Z' })])
    await enableEncryption('passwort-123')
    await encryptAllQuotes()
    lockEncryption()

    // Act
    const quote = await getQuote('q1')
    const trashed = await listTrashed()

    // Assert
    expect(quote).toBeUndefined()
    expect(trashed).toEqual([])
  })

  it('CHARACTERIZATION: beschädigte verschlüsselte Zeile lässt listQuotes ablehnen', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'gut', text: 'Gut' })])
    await enableEncryption('passwort-123')
    await encryptAllQuotes()
    await db.quotes.put({
      ...makeQuote({ id: 'kaputt' }),
      text: '',
      encrypted: true,
      encryptedPayload: 'AAAA',
      encryptionIv: 'AAAAAAAAAAAAAAAA'
    })

    // Act
    const action = listQuotes()

    // Assert
    // CHARACTERIZATION: vermutlich Bug, siehe Task 10
    // Eine einzige defekte Zeile lässt die komplette Bibliothek unlesbar werden (Promise.all rejected).
    await expect(action).rejects.toBeDefined()
  })

  it('CHARACTERIZATION: zweites enableEncryption macht bestehende verschlüsselte Zeilen unlesbar', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1', text: 'Geheim' })])
    await enableEncryption('passwort-eins')
    await encryptAllQuotes()
    expect((await listQuotes())[0].text).toBe('Geheim')

    // Act: erneut aktivieren überschreibt Salt und Schlüssel, ohne umzuschlüsseln
    await enableEncryption('passwort-zwei')
    const action = listQuotes()

    // Assert
    // CHARACTERIZATION: vermutlich Bug, siehe Task 10
    // Die alten Zeilen sind mit dem alten Schlüssel verschlüsselt; Entschlüsselung schlägt fehl (Datenverlust-Risiko).
    await expect(action).rejects.toBeDefined()
  })
})
