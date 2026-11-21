import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseJsonImportBundle } from '../services/importExport'
import {
  disableEncryptionRecord,
  enableEncryption,
  encryptQuoteForStorage,
  isEncryptionEnabled,
  lockEncryption
} from '../services/security'
import { makeBook, makeQuote, readFixture, resetFactories } from '../test/factories'
import {
  bytesToBase64,
  derivePasswordBits,
  encryptBookLegacy,
  encryptQuoteLegacy,
  writeLegacyEncryptionRecord
} from '../test/legacyVault'
import {
  encryptQuoteWithBits,
  expectedVerifier,
  pendingEncryptionStorageKey,
  readPendingRecord,
  readStoredRecord,
  writePendingRecord
} from '../test/vaultHelpers'
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
  getBook,
  getQuote,
  listBooks,
  listQuotes,
  listTrashed,
  normalizePeople,
  normalizeTags,
  updateBook,
  updateQuote,
  unlockVault,
  upsertQuotes,
  upsertBooks
} from './database'

const encryptionStorageKey = 'quiet-signal-encryption'

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
  vi.restoreAllMocks()
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

  it('verliert bei gleichzeitigen Updates derselben ID keine Felder', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1', likes: 0, reviewCount: 0 })])

    // Act
    await Promise.all([
      updateQuote('q1', { likes: 1 }),
      updateQuote('q1', { reviewCount: 1, lastReviewedAt: '2026-02-01T10:00:00.000Z' })
    ])

    // Assert
    const stored = await getQuote('q1')
    expect(stored?.likes).toBe(1)
    expect(stored?.reviewCount).toBe(1)
    expect(stored?.lastReviewedAt).toBe('2026-02-01T10:00:00.000Z')
  })

  it('verliert bei gleichzeitigen Updates auch mit aktiver Verschlüsselung keine Felder', async () => {
    // Arrange
    await enableEncryption('geheim-pin')
    await upsertQuotes([makeQuote({ id: 'q1', likes: 0, reviewCount: 0 })])

    // Act
    await Promise.all([updateQuote('q1', { likes: 1 }), updateQuote('q1', { reviewCount: 1 })])

    // Assert
    const stored = await getQuote('q1')
    expect(stored?.likes).toBe(1)
    expect(stored?.reviewCount).toBe(1)
  })

  it('liefert undefined beim Aktualisieren einer unbekannten ID', async () => {
    // Arrange / Act
    const result = await updateQuote('gibt-es-nicht', { text: 'x' })

    // Assert
    expect(result).toBeUndefined()
    expect(await getQuote('gibt-es-nicht')).toBeUndefined()
  })

  it('wirft bei einem Updater auf eine unbekannte ID, statt Erfolg zu melden', async () => {
    // Arrange / Act
    const attempt = updateQuote('gibt-es-nicht', () => ({ text: 'x' }))

    // Assert
    await expect(attempt).rejects.toThrow('Quote not found or unreadable')
  })

  it('schreibt bei einem Updater, der null liefert, nichts und meldet trotzdem Erfolg', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1', text: 'Alt' })])

    // Act
    const result = await updateQuote('q1', () => null)

    // Assert
    expect(result?.text).toBe('Alt')
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

describe('updateQuote updater form', () => {
  it('passes the freshly read row to the updater and writes its patch', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1', likes: 1 })])
    await updateQuote('q1', { likes: 5 })

    // Act
    const updated = await updateQuote('q1', (current) => ({ likes: current.likes + 1 }))

    // Assert
    expect(updated?.likes).toBe(6)
    expect((await getQuote('q1'))?.likes).toBe(6)
  })

  it('writes nothing and returns the current row when the updater returns null', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1', text: 'Same' })])
    const before = (await getQuote('q1'))?.updatedAt

    // Act
    const result = await updateQuote('q1', () => null)

    // Assert
    expect(result?.text).toBe('Same')
    expect((await getQuote('q1'))?.updatedAt).toBe(before)
  })

  it('does not call the updater for a missing row', async () => {
    // Arrange
    const updater = vi.fn(() => ({ likes: 1 }))

    // Act
    const attempt = updateQuote('missing', updater)

    // Assert
    await expect(attempt).rejects.toThrow('Quote not found or unreadable')
    expect(updater).not.toHaveBeenCalled()
  })

  it('serializes concurrent updaters so no increment is lost', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1', likes: 0 })])

    // Act
    await Promise.all([
      updateQuote('q1', (current) => ({ likes: current.likes + 1 })),
      updateQuote('q1', (current) => ({ likes: current.likes + 1 }))
    ])

    // Assert
    expect((await getQuote('q1'))?.likes).toBe(2)
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

// Inserts rows right before the rewrite transaction starts, i.e. after the rows were loaded.
function insertBeforeRewriteTransaction(insert: () => Promise<void>) {
  const originalTransaction = db.transaction.bind(db) as (...args: unknown[]) => Promise<unknown>
  vi.spyOn(db, 'transaction').mockImplementationOnce((async (...args: unknown[]) => {
    await insert()
    return originalTransaction(...args)
  }) as never)
}

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
    expect(await unlockVault('passwort-123')).toBe(true)
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

  const corruptQuoteRow = (id: string) => ({
    ...makeQuote({ id }),
    text: '',
    encrypted: true,
    encryptedPayload: 'AAAA',
    encryptionIv: 'AAAAAAAAAAAAAAAA'
  })
  const corruptBookRow = (id: string) => ({
    ...makeBook({ id }),
    title: '',
    encrypted: true,
    encryptedPayload: 'AAAA',
    encryptionIv: 'AAAAAAAAAAAAAAAA'
  })

  it('überspringt eine beschädigte verschlüsselte Zeile in listQuotes und lädt die übrigen', async () => {
    // Arrange
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await upsertQuotes([makeQuote({ id: 'gut-1', text: 'Gut 1' }), makeQuote({ id: 'gut-2', text: 'Gut 2' })])
    await enableEncryption('passwort-123')
    await encryptAllQuotes()
    await db.quotes.put(corruptQuoteRow('kaputt'))

    // Act
    const quotes = await listQuotes()

    // Assert
    expect(quotes.map((quote) => quote.id).sort()).toEqual(['gut-1', 'gut-2'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0].join(' ')).toContain('kaputt')
  })

  it('überspringt eine beschädigte Zeile auch in listTrashed und getQuote', async () => {
    // Arrange
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await enableEncryption('passwort-123')
    await upsertQuotes([makeQuote({ id: 'gut', deletedAt: '2026-02-01T10:00:00.000Z' })])
    await db.quotes.put(corruptQuoteRow('kaputt'))

    // Act
    const trashed = await listTrashed()
    const broken = await getQuote('kaputt')

    // Assert
    expect(trashed.map((quote) => quote.id)).toEqual(['gut'])
    expect(broken).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('überspringt eine beschädigte verschlüsselte Zeile in listBooks und getBook', async () => {
    // Arrange
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await upsertBooks([makeBook({ id: 'b1', title: 'Alpha' }), makeBook({ id: 'b2', title: 'Beta' })])
    await enableEncryption('passwort-123')
    await encryptAllQuotes()
    await db.books.put(corruptBookRow('kaputt'))

    // Act
    const books = await listBooks()
    const broken = await getBook('kaputt')

    // Assert
    expect(books.map((book) => book.id)).toEqual(['b1', 'b2'])
    expect(broken).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('encryptAllQuotes bricht bei beschädigter Zeile ab und löscht keine Daten', async () => {
    // Arrange
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await upsertQuotes([makeQuote({ id: 'gut', text: 'Gut' })])
    await enableEncryption('passwort-123')
    await encryptAllQuotes()
    await db.quotes.put(corruptQuoteRow('kaputt'))

    // Act
    const action = encryptAllQuotes()

    // Assert
    await expect(action).rejects.toThrow('Some entries could not be decrypted; aborting to avoid data loss.')
    expect(warn).not.toHaveBeenCalled()
    expect(await db.quotes.count()).toBe(2)
  })

  it('decryptAllQuotesAndDisable bricht bei beschädigter Zeile ab, löscht nichts und lässt die Verschlüsselung aktiv', async () => {
    // Arrange
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await upsertQuotes([makeQuote({ id: 'gut', text: 'Gut' })])
    await enableEncryption('passwort-123')
    await encryptAllQuotes()
    await db.quotes.put(corruptQuoteRow('kaputt'))

    // Act
    const action = decryptAllQuotesAndDisable()

    // Assert
    await expect(action).rejects.toThrow('Some entries could not be decrypted; aborting to avoid data loss.')
    expect(warn).not.toHaveBeenCalled()
    expect(isEncryptionEnabled()).toBe(true)
    expect(await db.quotes.count()).toBe(2)
  })

  it('liest Zeilen eines Tresors im früheren Format nach dem Entsperren und entschlüsselt sie vollständig', async () => {
    // Arrange
    const password = 'altes-passwort'
    const legacy = await writeLegacyEncryptionRecord(password)
    await db.quotes.put(
      await encryptQuoteLegacy(makeQuote({ id: 'alt', text: 'Alter Eintrag' }), password, legacy.salt)
    )
    const lockedList = await listQuotes()

    // Act
    const unlocked = await unlockVault(password)
    const list = await listQuotes()
    await decryptAllQuotesAndDisable()

    // Assert
    expect(lockedList).toEqual([])
    expect(unlocked).toBe(true)
    expect(list.map((quote) => quote.text)).toEqual(['Alter Eintrag'])
    expect(isEncryptionEnabled()).toBe(false)
    const row = await db.quotes.get('alt')
    expect(row?.encrypted).toBeUndefined()
    expect(row?.text).toBe('Alter Eintrag')
  })

  it('lehnt ein zweites enableEncryption ab und lässt Schlüssel, Salt und Zeilen unverändert', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1', text: 'Geheim' })])
    await enableEncryption('passwort-eins')
    await encryptAllQuotes()
    const recordBefore = localStorage.getItem(encryptionStorageKey)
    const rowBefore = await db.quotes.get('q1')

    // Act
    const action = enableEncryption('passwort-zwei')

    // Assert
    await expect(action).rejects.toThrow('Encryption is already enabled.')
    expect(localStorage.getItem(encryptionStorageKey)).toBe(recordBefore)
    expect(await db.quotes.get('q1')).toEqual(rowBefore)
    expect((await listQuotes())[0].text).toBe('Geheim')
    lockEncryption()
    expect(await unlockVault('passwort-zwei')).toBe(false)
    expect(await unlockVault('passwort-eins')).toBe(true)
    expect((await listQuotes())[0].text).toBe('Geheim')
  })

  it('behält Papierkorb-Einträge beim Aktivieren der Verschlüsselung und kann sie wiederherstellen', async () => {
    // Arrange
    await upsertQuotes([
      makeQuote({ id: 'aktiv', text: 'Aktiv' }),
      makeQuote({ id: 'papierkorb', text: 'Weg', deletedAt: '2026-02-01T10:00:00.000Z' })
    ])
    await enableEncryption('passwort-123')

    // Act
    await encryptAllQuotes()
    const trashed = await listTrashed()
    await updateQuote('papierkorb', { deletedAt: undefined })

    // Assert
    expect(trashed.map((quote) => quote.id)).toEqual(['papierkorb'])
    expect((await listQuotes()).map((quote) => quote.id).sort()).toEqual(['aktiv', 'papierkorb'])
  })

  it('behält Papierkorb-Einträge beim Deaktivieren der Verschlüsselung und kann sie wiederherstellen', async () => {
    // Arrange
    await enableEncryption('passwort-123')
    await upsertQuotes([
      makeQuote({ id: 'aktiv', text: 'Aktiv' }),
      makeQuote({ id: 'papierkorb', text: 'Weg', deletedAt: '2026-02-01T10:00:00.000Z' })
    ])

    // Act
    await decryptAllQuotesAndDisable()
    const trashed = await listTrashed()
    await updateQuote('papierkorb', { deletedAt: undefined })

    // Assert
    expect(isEncryptionEnabled()).toBe(false)
    expect(trashed.map((quote) => quote.id)).toEqual(['papierkorb'])
    expect((await listQuotes()).map((quote) => quote.id).sort()).toEqual(['aktiv', 'papierkorb'])
  })

  it('encryptAllQuotes lässt bei fehlschlagendem Schreiben alle Originalzeilen unverändert', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1', text: 'Eins' })])
    await upsertBooks([makeBook({ id: 'b1', title: 'Buch' })])
    await enableEncryption('passwort-123')
    vi.spyOn(db.books, 'bulkPut').mockRejectedValueOnce(new Error('Quota'))

    // Act
    const action = encryptAllQuotes()

    // Assert
    await expect(action).rejects.toThrow('Quota')
    expect((await db.quotes.get('q1'))?.text).toBe('Eins')
    expect((await db.books.get('b1'))?.title).toBe('Buch')
    expect((await listQuotes()).map((quote) => quote.id)).toEqual(['q1'])
  })

  it('decryptAllQuotesAndDisable lässt bei fehlschlagendem Schreiben Zeilen verschlüsselt und Verschlüsselung aktiv', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1', text: 'Eins' })])
    await upsertBooks([makeBook({ id: 'b1', title: 'Buch' })])
    await enableEncryption('passwort-123')
    await encryptAllQuotes()
    vi.spyOn(db.books, 'bulkPut').mockRejectedValueOnce(new Error('Quota'))

    // Act
    const action = decryptAllQuotesAndDisable()

    // Assert
    await expect(action).rejects.toThrow('Quota')
    expect(isEncryptionEnabled()).toBe(true)
    expect((await db.quotes.get('q1'))?.encrypted).toBe(true)
    expect((await db.books.get('b1'))?.encrypted).toBe(true)
    expect((await listQuotes())[0].text).toBe('Eins')
    expect((await listBooks())[0].title).toBe('Buch')
  })

  it('encryptAllQuotes behält Zeilen, die nach dem Laden und vor dem Umschreiben entstanden sind', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'alt', text: 'Alt' })])
    await upsertBooks([makeBook({ id: 'b-alt', title: 'Altes Buch' })])
    await enableEncryption('passwort-123')
    insertBeforeRewriteTransaction(async () => {
      await db.quotes.put(await encryptQuoteForStorage(makeQuote({ id: 'neu', text: 'Neu' })))
      await db.books.put(makeBook({ id: 'b-neu', title: 'Neues Buch' }))
    })

    // Act
    await encryptAllQuotes()

    // Assert
    expect((await listQuotes()).map((quote) => quote.text).sort()).toEqual(['Alt', 'Neu'])
    expect((await db.books.toArray()).map((book) => book.id).sort()).toEqual(['b-alt', 'b-neu'])
  })

  it('decryptAllQuotesAndDisable behält Zeilen, die nach dem Laden und vor dem Umschreiben entstanden sind', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'alt', text: 'Alt' })])
    await enableEncryption('passwort-123')
    await encryptAllQuotes()
    insertBeforeRewriteTransaction(async () => {
      await db.quotes.put(makeQuote({ id: 'neu', text: 'Neu' }))
    })

    // Act
    await decryptAllQuotesAndDisable()

    // Assert
    expect(isEncryptionEnabled()).toBe(false)
    expect((await listQuotes()).map((quote) => quote.text).sort()).toEqual(['Alt', 'Neu'])
  })

  it('wirft bei gesperrtem Tresor in encryptAllQuotes und decryptAllQuotesAndDisable und lässt die Tabellen unberührt', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1', text: 'Eins' })])
    await enableEncryption('passwort-123')
    await encryptAllQuotes()
    const rowBefore = await db.quotes.get('q1')
    lockEncryption()

    // Act
    const encryptAction = encryptAllQuotes()
    const decryptAction = decryptAllQuotesAndDisable()

    // Assert
    await expect(encryptAction).rejects.toThrow('Encryption is locked.')
    await expect(decryptAction).rejects.toThrow('Encryption is locked.')
    expect(isEncryptionEnabled()).toBe(true)
    expect(await db.quotes.get('q1')).toEqual(rowBefore)
  })
})

// Starts a write right before the rewrite transaction begins and gives it time to finish if nothing blocks it.
function startBeforeRewriteTransaction<T>(start: () => Promise<T>) {
  const started: { promise: Promise<T> | null } = { promise: null }
  const originalTransaction = db.transaction.bind(db) as (...args: unknown[]) => Promise<unknown>
  vi.spyOn(db, 'transaction').mockImplementationOnce((async (...args: unknown[]) => {
    const promise = start()
    promise.catch(() => undefined)
    started.promise = promise
    await Promise.race([promise, new Promise((resolve) => setTimeout(resolve, 100))])
    return originalTransaction(...args)
  }) as never)
  return started
}

describe('Schreibsperre während des Umschreibens aller Zeilen', () => {
  it('legt einen während decryptAllQuotesAndDisable begonnenen Eintrag lesbar im Klartext an', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'alt', text: 'Alt' })])
    await enableEncryption('passwort-123')
    await encryptAllQuotes()
    const started = startBeforeRewriteTransaction(() => createQuote({ text: 'Neu', tags: [] } as never))

    // Act
    await decryptAllQuotesAndDisable()
    const created = await started.promise!

    // Assert
    const row = await db.quotes.get(created.id)
    expect(isEncryptionEnabled()).toBe(false)
    expect(row?.encrypted).toBeUndefined()
    expect(row?.text).toBe('Neu')
    expect((await listQuotes()).map((quote) => quote.text).sort()).toEqual(['Alt', 'Neu'])
  })

  it('legt einen während encryptAllQuotes begonnenen Eintrag verschlüsselt und lesbar an', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'alt', text: 'Alt' })])
    await enableEncryption('passwort-123')
    const started = startBeforeRewriteTransaction(() => createQuote({ text: 'Neu', tags: [] } as never))

    // Act
    await encryptAllQuotes()
    const created = await started.promise!

    // Assert
    expect((await db.quotes.get(created.id))?.encrypted).toBe(true)
    expect((await listQuotes()).map((quote) => quote.text).sort()).toEqual(['Alt', 'Neu'])
  })

  it('verliert eine während encryptAllQuotes begonnene Änderung nicht', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1', text: 'Vorher' })])
    await enableEncryption('passwort-123')
    const started = startBeforeRewriteTransaction(() => updateQuote('q1', { text: 'Nachher' }))

    // Act
    await encryptAllQuotes()
    await started.promise

    // Assert
    expect((await db.quotes.get('q1'))?.encrypted).toBe(true)
    expect((await getQuote('q1'))?.text).toBe('Nachher')
  })

  it('stellt einen während decryptAllQuotesAndDisable gelöschten Eintrag nicht wieder her', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'weg', text: 'Weg' }), makeQuote({ id: 'bleibt', text: 'Bleibt' })])
    await enableEncryption('passwort-123')
    await encryptAllQuotes()
    const started = startBeforeRewriteTransaction(() => deleteQuote('weg'))

    // Act
    await decryptAllQuotesAndDisable()
    await started.promise

    // Assert
    expect(await db.quotes.get('weg')).toBeUndefined()
    expect((await listQuotes()).map((quote) => quote.text)).toEqual(['Bleibt'])
  })

  it('wartet mit decryptAllQuotesAndDisable auf einen bereits laufenden Schreibvorgang', async () => {
    // Arrange
    await enableEncryption('passwort-123')
    const created = createQuote({ text: 'Unterwegs', tags: [] } as never)

    // Act
    await decryptAllQuotesAndDisable()
    const quote = await created

    // Assert
    const row = await db.quotes.get(quote.id)
    expect(isEncryptionEnabled()).toBe(false)
    expect(row?.encrypted).toBeUndefined()
    expect(row?.text).toBe('Unterwegs')
  })
})

const rotationWarning = /re-encrypt/

// Earlier-format vault with an active quote, a trashed quote and a book, all encrypted the earlier way.
async function seedLegacyVault(password: string) {
  const legacy = await writeLegacyEncryptionRecord(password)
  await db.quotes.bulkPut([
    await encryptQuoteLegacy(makeQuote({ id: 'aktiv', text: 'Aktiv' }), password, legacy.salt),
    await encryptQuoteLegacy(
      makeQuote({ id: 'papierkorb', text: 'Papierkorb', deletedAt: '2026-02-01T10:00:00.000Z' }),
      password,
      legacy.salt
    )
  ])
  await db.books.put(await encryptBookLegacy(makeBook({ id: 'b1', title: 'Buch' }), password, legacy.salt))
  return legacy
}

async function snapshotRows() {
  return { quotes: await db.quotes.toArray(), books: await db.books.toArray() }
}

function failSetItemFor(storageKey: string) {
  const originalSetItem = Storage.prototype.setItem
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === storageKey) throw new Error('QuotaExceededError')
    originalSetItem.call(this, key, value)
  })
}

describe('Schlüsselrotation beim Entsperren eines Tresors im früheren Format', () => {
  it('erzeugt ein neues Salt, verschlüsselt alle Zeilen samt Papierkorb und Büchern neu und bleibt lesbar', async () => {
    // Arrange
    const password = 'altes-passwort'
    const legacy = await seedLegacyVault(password)
    const before = await snapshotRows()
    const notify = vi.fn()
    window.addEventListener('quiet-signal-security-changed', notify)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Act
    const unlocked = await unlockVault(password)

    // Assert
    window.removeEventListener('quiet-signal-security-changed', notify)
    expect(unlocked).toBe(true)
    const record = readStoredRecord()!
    expect(record.version).toBe(2)
    expect(record.salt).not.toBe(bytesToBase64(legacy.salt))
    expect(record.hash).toBe(await expectedVerifier(await derivePasswordBits(password, base64ToSalt(record.salt))))
    expect(Object.keys(record).sort()).toEqual(['enabled', 'hash', 'salt', 'version'])
    expect(readPendingRecord()).toBeNull()
    const after = await snapshotRows()
    expect([...after.quotes, ...after.books].every((row) => row.encrypted === true)).toBe(true)
    for (const row of [...after.quotes, ...after.books]) {
      const old = [...before.quotes, ...before.books].find((candidate) => candidate.id === row.id)
      expect(row.encryptedPayload).not.toBe(old?.encryptedPayload)
    }
    expect((await listQuotes()).map((quote) => quote.text)).toEqual(['Aktiv'])
    expect((await listTrashed()).map((quote) => quote.id)).toEqual(['papierkorb'])
    expect((await listBooks()).map((book) => book.title)).toEqual(['Buch'])
    expect(notify).toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  it('entsperrt nach der Rotation nur mit dem richtigen Passwort und rotiert Version 2 nicht erneut', async () => {
    // Arrange
    const password = 'altes-passwort'
    await seedLegacyVault(password)
    await unlockVault(password)
    lockEncryption()
    const recordBefore = localStorage.getItem(encryptionStorageKey)
    const rowsBefore = await snapshotRows()
    const transaction = vi.spyOn(db, 'transaction')

    // Act
    const falsch = await unlockVault('falsch')
    const richtig = await unlockVault(password)

    // Assert
    expect(falsch).toBe(false)
    expect(richtig).toBe(true)
    expect(transaction).not.toHaveBeenCalled()
    expect(localStorage.getItem(encryptionStorageKey)).toBe(recordBefore)
    expect(await snapshotRows()).toEqual(rowsBefore)
    expect((await listQuotes()).map((quote) => quote.text)).toEqual(['Aktiv'])
    expect((await listBooks()).map((book) => book.title)).toEqual(['Buch'])
  })

  it('schreibt beim Entsperren eines Tresors mit Version 2 keine Zeilen und keinen Datensatz neu', async () => {
    // Arrange
    await upsertQuotes([makeQuote({ id: 'q1', text: 'Eins' })])
    await enableEncryption('passwort-123')
    await encryptAllQuotes()
    lockEncryption()
    const recordBefore = localStorage.getItem(encryptionStorageKey)
    const rowsBefore = await snapshotRows()
    const transaction = vi.spyOn(db, 'transaction')

    // Act
    const unlocked = await unlockVault('passwort-123')

    // Assert
    expect(unlocked).toBe(true)
    expect(transaction).not.toHaveBeenCalled()
    expect(localStorage.getItem(encryptionStorageKey)).toBe(recordBefore)
    expect(await snapshotRows()).toEqual(rowsBefore)
    expect((await listQuotes())[0].text).toBe('Eins')
  })

  it('behält bei einem nicht entschlüsselbaren Eintrag Datensatz, Zeilen und alten Schlüssel und rotiert beim nächsten Entsperren', async () => {
    // Arrange
    const password = 'altes-passwort'
    const legacy = await seedLegacyVault(password)
    await db.quotes.put(await encryptQuoteLegacy(makeQuote({ id: 'kaputt', text: 'Kaputt' }), 'anderes', legacy.salt))
    const rowsBefore = await snapshotRows()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Act
    const unlocked = await unlockVault(password)

    // Assert
    expect(unlocked).toBe(true)
    expect(localStorage.getItem(encryptionStorageKey)).toBe(legacy.raw)
    expect(await snapshotRows()).toEqual(rowsBefore)
    expect((await listQuotes()).map((quote) => quote.text)).toEqual(['Aktiv'])
    const rotationWarnings = warn.mock.calls.filter((call) => rotationWarning.test(call.join(' ')))
    expect(rotationWarnings).toHaveLength(1)
    expect(warn.mock.calls.flat().join(' ')).not.toContain(password)

    // Act: nach Entfernen des kaputten Eintrags erneut entsperren
    await db.quotes.delete('kaputt')
    lockEncryption()
    const retried = await unlockVault(password)

    // Assert
    expect(retried).toBe(true)
    expect(readStoredRecord()!.version).toBe(2)
    expect(readStoredRecord()!.salt).not.toBe(bytesToBase64(legacy.salt))
    expect((await listQuotes()).map((quote) => quote.text)).toEqual(['Aktiv'])
  })

  it('behält bei einem Fehler der Schreibtransaktion Datensatz, Zeilen und alten Schlüssel und rotiert beim nächsten Entsperren', async () => {
    // Arrange
    const password = 'altes-passwort'
    const legacy = await seedLegacyVault(password)
    const rowsBefore = await snapshotRows()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('AbortError'))

    // Act
    const unlocked = await unlockVault(password)

    // Assert
    expect(unlocked).toBe(true)
    expect(localStorage.getItem(encryptionStorageKey)).toBe(legacy.raw)
    expect(await snapshotRows()).toEqual(rowsBefore)
    expect((await listQuotes()).map((quote) => quote.text)).toEqual(['Aktiv'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0].join(' ')).toMatch(rotationWarning)

    // Act: erneut entsperren
    lockEncryption()
    const retried = await unlockVault(password)

    // Assert
    expect(retried).toBe(true)
    expect(readStoredRecord()!.salt).not.toBe(bytesToBase64(legacy.salt))
    expect((await listBooks()).map((book) => book.title)).toEqual(['Buch'])
    expect(readPendingRecord()).toBeNull()
  })

  it('behält bei einem Fehler beim Verschlüsseln Datensatz, Zeilen und alten Schlüssel', async () => {
    // Arrange
    const password = 'altes-passwort'
    const legacy = await seedLegacyVault(password)
    const rowsBefore = await snapshotRows()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(crypto.subtle, 'encrypt').mockRejectedValueOnce(new Error('OperationError'))

    // Act
    const unlocked = await unlockVault(password)

    // Assert
    expect(unlocked).toBe(true)
    expect(localStorage.getItem(encryptionStorageKey)).toBe(legacy.raw)
    expect(await snapshotRows()).toEqual(rowsBefore)
    expect((await listQuotes()).map((quote) => quote.text)).toEqual(['Aktiv'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0].join(' ')).toMatch(rotationWarning)
  })

  it('rotiert nicht, wenn der vorgemerkte Datensatz nicht gespeichert werden kann, und entsperrt mit dem alten Schlüssel', async () => {
    // Arrange
    const password = 'altes-passwort'
    const legacy = await seedLegacyVault(password)
    const rowsBefore = await snapshotRows()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const setItem = failSetItemFor(pendingEncryptionStorageKey)

    // Act
    const unlocked = await unlockVault(password)

    // Assert
    setItem.mockRestore()
    expect(unlocked).toBe(true)
    expect(localStorage.getItem(encryptionStorageKey)).toBe(legacy.raw)
    expect(readPendingRecord()).toBeNull()
    expect(await snapshotRows()).toEqual(rowsBefore)
    expect((await listQuotes()).map((quote) => quote.text)).toEqual(['Aktiv'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0].join(' ')).toMatch(rotationWarning)
  })

  it('bleibt lesbar, wenn der neue Datensatz nach dem Umschreiben nicht gespeichert werden kann, und schließt die Rotation beim nächsten Entsperren ab', async () => {
    // Arrange
    const password = 'altes-passwort'
    const legacy = await seedLegacyVault(password)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const setItem = failSetItemFor(encryptionStorageKey)

    // Act
    const unlocked = await unlockVault(password)
    const listInSession = await listQuotes()

    // Assert
    setItem.mockRestore()
    expect(unlocked).toBe(true)
    expect(listInSession.map((quote) => quote.text)).toEqual(['Aktiv'])
    expect(localStorage.getItem(encryptionStorageKey)).toBe(legacy.raw)
    const pending = readPendingRecord()!
    expect(pending.version).toBe(2)
    expect(pending.salt).not.toBe(bytesToBase64(legacy.salt))
    expect(warn).toHaveBeenCalledTimes(1)

    // Act: Sitzung endet, danach erneut entsperren
    lockEncryption()
    const pendingRaw = localStorage.getItem(pendingEncryptionStorageKey)
    const falsch = await unlockVault('falsch')
    const pendingAfterWrongPassword = localStorage.getItem(pendingEncryptionStorageKey)
    const richtig = await unlockVault(password)

    // Assert
    expect(falsch).toBe(false)
    expect(pendingAfterWrongPassword).toBe(pendingRaw)
    expect(richtig).toBe(true)
    expect(readStoredRecord()).toEqual(pending)
    expect(readPendingRecord()).toBeNull()
    expect((await listQuotes()).map((quote) => quote.text)).toEqual(['Aktiv'])
    expect((await listTrashed()).map((quote) => quote.id)).toEqual(['papierkorb'])
    expect((await listBooks()).map((book) => book.title)).toEqual(['Buch'])
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('schließt eine unterbrochene Rotation ab, auch wenn Zeilen mit altem und vorgemerktem Schlüssel gemischt sind', async () => {
    // Arrange
    const password = 'altes-passwort'
    const legacy = await writeLegacyEncryptionRecord(password)
    const pending = await writePendingRecord(password)
    await db.quotes.bulkPut([
      await encryptQuoteLegacy(makeQuote({ id: 'alt', text: 'Alter Schlüssel' }), password, legacy.salt),
      await encryptQuoteWithBits(makeQuote({ id: 'neu', text: 'Vorgemerkter Schlüssel' }), pending.bits)
    ])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Act
    const unlocked = await unlockVault(password)

    // Assert
    expect(unlocked).toBe(true)
    expect(readStoredRecord()!.salt).toBe(bytesToBase64(pending.salt))
    expect(readStoredRecord()!.version).toBe(2)
    expect(readPendingRecord()).toBeNull()
    expect((await listQuotes()).map((quote) => quote.text).sort()).toEqual([
      'Alter Schlüssel',
      'Vorgemerkter Schlüssel'
    ])
    expect(warn).not.toHaveBeenCalled()
  })

  it('ignoriert einen vorgemerkten Datensatz, der nicht zum Passwort passt', async () => {
    // Arrange
    const password = 'altes-passwort'
    const legacy = await seedLegacyVault(password)
    const stale = await writePendingRecord(password, { verifier: 'AAAA' })

    // Act
    const unlocked = await unlockVault(password)

    // Assert
    expect(unlocked).toBe(true)
    const record = readStoredRecord()!
    expect(record.salt).not.toBe(bytesToBase64(stale.salt))
    expect(record.salt).not.toBe(bytesToBase64(legacy.salt))
    expect(readPendingRecord()).toBeNull()
    expect((await listQuotes()).map((quote) => quote.text)).toEqual(['Aktiv'])
  })

  it('ignoriert einen vorgemerkten Datensatz mit dem Salt des aktiven Datensatzes', async () => {
    // Arrange
    const password = 'altes-passwort'
    const legacy = await seedLegacyVault(password)
    const planted = JSON.stringify({
      enabled: true,
      salt: bytesToBase64(legacy.salt),
      hash: await expectedVerifier(base64ToSalt(legacy.hash)),
      version: 2
    })
    localStorage.setItem(pendingEncryptionStorageKey, planted)

    // Act
    const unlocked = await unlockVault(password)

    // Assert
    expect(unlocked).toBe(true)
    const record = readStoredRecord()!
    expect(record.version).toBe(2)
    expect(record.salt).not.toBe(bytesToBase64(legacy.salt))
    expect(readPendingRecord()).toBeNull()
    expect((await listQuotes()).map((quote) => quote.text)).toEqual(['Aktiv'])
    expect((await listBooks()).map((book) => book.title)).toEqual(['Buch'])
  })

  it('entsperrt trotzdem und lässt alles unverändert, wenn das Laden der Zeilen für die Rotation fehlschlägt', async () => {
    // Arrange
    const password = 'altes-passwort'
    const legacy = await seedLegacyVault(password)
    const rowsBefore = await snapshotRows()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(db.quotes, 'toArray').mockRejectedValueOnce(new Error('UnknownError'))

    // Act
    const unlocked = await unlockVault(password)

    // Assert
    expect(unlocked).toBe(true)
    expect(localStorage.getItem(encryptionStorageKey)).toBe(legacy.raw)
    expect(readPendingRecord()).toBeNull()
    expect(await snapshotRows()).toEqual(rowsBefore)
    expect((await listQuotes()).map((quote) => quote.text)).toEqual(['Aktiv'])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0].join(' ')).toMatch(rotationWarning)
  })

  it('entfernt beim Entsperren mit Version 2 einen vorgemerkten Datensatz, der nicht zum Passwort passt', async () => {
    // Arrange
    await enableEncryption('passwort-123')
    await writePendingRecord('passwort-123', { verifier: 'AAAA' })
    lockEncryption()

    // Act
    const unlocked = await unlockVault('passwort-123')

    // Assert
    expect(unlocked).toBe(true)
    expect(readPendingRecord()).toBeNull()
  })

  it('lässt bei falschem Passwort Datensatz und Zeilen unverändert und merkt nichts vor', async () => {
    // Arrange
    const legacy = await seedLegacyVault('altes-passwort')
    const rowsBefore = await snapshotRows()

    // Act
    const unlocked = await unlockVault('falsch')

    // Assert
    expect(unlocked).toBe(false)
    expect(localStorage.getItem(encryptionStorageKey)).toBe(legacy.raw)
    expect(readPendingRecord()).toBeNull()
    expect(await snapshotRows()).toEqual(rowsBefore)
  })

  it('legt einen während der Rotation begonnenen Eintrag lesbar mit dem neuen Schlüssel an', async () => {
    // Arrange
    const password = 'altes-passwort'
    await seedLegacyVault(password)
    const started = startBeforeRewriteTransaction(() => createQuote({ text: 'Währenddessen', tags: [] } as never))

    // Act
    await unlockVault(password)
    const created = await started.promise!
    lockEncryption()
    await unlockVault(password)

    // Assert
    expect((await db.quotes.get(created.id))?.encrypted).toBe(true)
    expect((await listQuotes()).map((quote) => quote.text).sort()).toEqual(['Aktiv', 'Währenddessen'])
  })

  it('entfernt beim Entsperren mit Version 2 einen übrig gebliebenen vorgemerkten Datensatz mit gleichem Salt', async () => {
    // Arrange
    await enableEncryption('passwort-123')
    localStorage.setItem(pendingEncryptionStorageKey, localStorage.getItem(encryptionStorageKey)!)
    lockEncryption()

    // Act
    const unlocked = await unlockVault('passwort-123')

    // Assert
    expect(unlocked).toBe(true)
    expect(readPendingRecord()).toBeNull()
  })

  it('entfernt beim Abschalten der Verschlüsselung auch einen vorgemerkten Datensatz', async () => {
    // Arrange
    await writeLegacyEncryptionRecord('altes-passwort')
    await writePendingRecord('altes-passwort')

    // Act
    disableEncryptionRecord()

    // Assert
    expect(localStorage.getItem(encryptionStorageKey)).toBeNull()
    expect(readPendingRecord()).toBeNull()
  })
})

function base64ToSalt(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}
