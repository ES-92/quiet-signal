import Dexie, { type Table } from 'dexie'
import {
  activateEncryptionKey,
  commitStagedEncryptionRecord,
  decryptBookFromStorage,
  decryptBookWithKey,
  decryptQuoteFromStorage,
  decryptQuoteWithKey,
  disableEncryptionRecord,
  encryptBookForStorage,
  encryptBookWithKey,
  encryptQuoteForStorage,
  encryptQuoteWithKey,
  isEncryptionUnlocked,
  planVaultUnlock,
  stageEncryptionRecord,
  type VaultKeyMaterial
} from '../services/security'
import type { Book, BookInput } from '../types/book'
import type { Quote, QuoteInput } from '../types/quote'

class QuietSignalDatabase extends Dexie {
  quotes!: Table<Quote, string>
  books!: Table<Book, string>

  constructor() {
    super('quiet-signal')
    this.version(1).stores({
      quotes: 'id, author, source, favorite, createdAt, updatedAt, nextReviewAt, *tags'
    })
    this.version(2).stores({
      books: 'id, title, weight, createdAt, updatedAt'
    })
    this.version(3).stores({
      quotes: 'id, author, source, favorite, status, signalStrength, createdAt, updatedAt, nextReviewAt, *tags',
      books: 'id, title, weight, createdAt, updatedAt'
    })
    this.version(4).stores({
      quotes: 'id, author, source, favorite, status, signalStrength, entryType, createdAt, updatedAt, nextReviewAt, *tags',
      books: 'id, title, weight, createdAt, updatedAt'
    })
    this.version(5).stores({
      quotes: 'id, author, source, favorite, status, signalStrength, entryType, snoozedUntil, deletedAt, createdAt, updatedAt, nextReviewAt, *tags',
      books: 'id, title, weight, createdAt, updatedAt'
    })
  }
}

export const db = new QuietSignalDatabase()

const now = () => new Date().toISOString()

const rewriteAbortMessage = 'Some entries could not be decrypted; aborting to avoid data loss.'

// Bulk rewrites (encrypt-all, decrypt-all, key rotation) load every row, rewrite it and commit it in one
// transaction. A single write that overlaps with one would either be overwritten by the rewrite or be
// stored in a format the rewrite is about to leave behind. Single writes therefore wait while a bulk rewrite
// is pending, and a bulk rewrite waits for the single writes already in flight. Only within a single tab.
// A bulk rewrite must never call one of the guarded write functions itself (it would wait for itself).
let bulkRewrite: Promise<void> | null = null
const writesInFlight = new Set<Promise<unknown>>()

async function guardedWrite<T>(write: () => Promise<T>): Promise<T> {
  while (bulkRewrite) await bulkRewrite
  const run = write()
  writesInFlight.add(run)
  const settle = () => writesInFlight.delete(run)
  run.then(settle, settle)
  return run
}

function runBulkRewrite<T>(rewrite: () => Promise<T>): Promise<T> {
  const previous = bulkRewrite ?? Promise.resolve()
  const run = previous.then(async () => {
    await Promise.allSettled([...writesInFlight])
    return rewrite()
  })
  const gate = run.then(
    () => undefined,
    () => undefined
  )
  bulkRewrite = gate
  void gate.then(() => {
    if (bulkRewrite === gate) bulkRewrite = null
  })
  return run
}

/**
 * Decrypts one stored row. A row that cannot be decrypted (corrupt payload, wrong key)
 * is reported with a single warning and treated like an unreadable row (null), so one
 * bad row cannot make the whole library unreadable.
 */
async function safeDecryptQuote(row: Quote) {
  try {
    return await decryptQuoteFromStorage(row)
  } catch {
    console.warn(`Quiet Signal: could not decrypt quote ${row.id}; skipping it.`)
    return null
  }
}

async function safeDecryptBook(row: Book) {
  try {
    return await decryptBookFromStorage(row)
  } catch {
    console.warn(`Quiet Signal: could not decrypt book ${row.id}; skipping it.`)
    return null
  }
}

/**
 * Loads every row decrypted for a bulk rewrite (encrypt-all / decrypt-all). These clear
 * the tables before rewriting, so any row that cannot be read must abort the operation
 * instead of being silently dropped.
 */
async function loadAllForRewrite() {
  if (!isEncryptionUnlocked()) throw new Error('Encryption is locked.')
  const quoteRows = await db.quotes.toArray()
  const bookRows = await db.books.toArray()
  let quotes: (Quote | null)[]
  let books: (Book | null)[]
  try {
    quotes = await Promise.all(quoteRows.map((row) => decryptQuoteFromStorage(row)))
    books = await Promise.all(bookRows.map((row) => decryptBookFromStorage(row)))
  } catch {
    throw new Error(rewriteAbortMessage)
  }
  if (quotes.some((quote) => !quote) || books.some((book) => !book)) throw new Error(rewriteAbortMessage)
  return {
    quotes: quotes.filter((quote): quote is Quote => Boolean(quote)).map(withQuoteDefaults),
    books: books.filter((book): book is Book => Boolean(book))
  }
}

function withQuoteDefaults(quote: Quote): Quote {
  return {
    ...quote,
    likes: quote.likes ?? 0,
    status: quote.status ?? 'signal',
    signalStrength: quote.signalStrength ?? 'normal',
    entryType: quote.entryType ?? 'note',
    people: quote.people ?? []
  }
}

export async function listQuotes() {
  const rows = await db.quotes.orderBy('createdAt').reverse().toArray()
  const quotes = await Promise.all(rows.map((quote) => safeDecryptQuote(quote)))
  return quotes
    .filter((quote): quote is Quote => Boolean(quote))
    .filter((quote) => !quote.deletedAt)
    .map(withQuoteDefaults)
}

export async function listTrashed() {
  const rows = await db.quotes.toArray()
  const quotes = await Promise.all(rows.map((quote) => safeDecryptQuote(quote)))
  return quotes
    .filter((quote): quote is Quote => Boolean(quote))
    .filter((quote) => Boolean(quote.deletedAt))
    .map(withQuoteDefaults)
    .sort((a, b) => (b.deletedAt as string).localeCompare(a.deletedAt as string))
}

export function emptyTrash() {
  return guardedWrite(async () => {
    const trashed = await listTrashed()
    await db.quotes.bulkDelete(trashed.map((quote) => quote.id))
  })
}

export async function getQuote(id: string) {
  const quote = await db.quotes.get(id)
  if (!quote) return undefined
  const decrypted = await safeDecryptQuote(quote)
  return decrypted ? withQuoteDefaults(decrypted) : undefined
}

export function createQuote(input: QuoteInput) {
  return guardedWrite(() => insertQuote(input))
}

async function insertQuote(input: QuoteInput) {
  const timestamp = now()
  const quote: Quote = {
    ...input,
    id: crypto.randomUUID(),
    tags: normalizeTags(input.tags),
    favorite: input.favorite ?? false,
    likes: 0,
    status: input.status ?? 'signal',
    signalStrength: input.signalStrength ?? 'normal',
    entryType: input.entryType ?? 'note',
    people: input.people ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
    reviewCount: 0
  }

  await db.quotes.add(await encryptQuoteForStorage(quote))
  return quote
}

export function upsertQuotes(quotes: Quote[]) {
  return guardedWrite(async () => {
    await db.quotes.bulkPut(
      await Promise.all(
        quotes.map((quote) =>
          encryptQuoteForStorage({
            ...withQuoteDefaults(quote),
            tags: normalizeTags(quote.tags),
            people: normalizePeople(quote.people)
          })
        )
      )
    )
  })
}

// Updates are read-modify-write with async WebCrypto in between, so they cannot run inside one Dexie
// transaction (it would auto-commit on the non-Dexie await). Serialize them per quote id instead, so
// concurrent patches on the same row (e.g. like + review) never overwrite each other's fields.
// Limits: only updateQuote goes through this queue (other writes and bulk rewrites bypass it; bulk rewrites
// are kept apart by the bulk-rewrite lock above), and it only serializes within a single tab.
const quoteUpdateQueue = new Map<string, Promise<unknown>>()

export function updateQuote(id: string, patch: Partial<Quote>): Promise<Quote | undefined> {
  const previous = quoteUpdateQueue.get(id) ?? Promise.resolve()
  const run = previous.catch(() => undefined).then(() => guardedWrite(() => applyQuoteUpdate(id, patch)))
  quoteUpdateQueue.set(id, run)
  const cleanup = () => {
    if (quoteUpdateQueue.get(id) === run) quoteUpdateQueue.delete(id)
  }
  run.then(cleanup, cleanup)
  return run
}

async function applyQuoteUpdate(id: string, patch: Partial<Quote>) {
  const timestamp = now()
  const current = await getQuote(id)
  if (!current) return undefined
  const nextQuote = {
    ...current,
    ...patch,
    tags: patch.tags ? normalizeTags(patch.tags) : current.tags,
    people: patch.people ? normalizePeople(patch.people) : current.people,
    updatedAt: timestamp
  }
  await db.quotes.put(await encryptQuoteForStorage(nextQuote))
  return getQuote(id)
}

export function normalizePeople(people: string[] = []) {
  return Array.from(
    new Set(
      people
        .flatMap((person) => person.split(','))
        .map((person) => person.trim())
        .filter(Boolean)
    )
  )
}

export function deleteQuote(id: string) {
  return guardedWrite(() => db.quotes.delete(id))
}

export function clearQuotes() {
  return guardedWrite(() => db.quotes.clear())
}

export function clearBooks() {
  return guardedWrite(() => db.books.clear())
}

export function encryptAllQuotes() {
  return runBulkRewrite(encryptAllRows)
}

async function encryptAllRows() {
  const { quotes, books } = await loadAllForRewrite()
  // All WebCrypto work happens before the transaction (no non-Dexie awaits inside it);
  // the loaded rows are rewritten atomically, so a failure keeps the old rows. bulkPut
  // replaces rows by id without clearing the tables, so rows created after loading survive.
  const encryptedQuotes = await Promise.all(quotes.map((quote) => encryptQuoteForStorage(quote)))
  const encryptedBooks = await Promise.all(books.map((book) => encryptBookForStorage(book)))
  await db.transaction('rw', db.quotes, db.books, async () => {
    await db.quotes.bulkPut(encryptedQuotes)
    await db.books.bulkPut(encryptedBooks)
  })
}

export function decryptAllQuotesAndDisable() {
  return runBulkRewrite(decryptAllRowsAndDisable)
}

async function decryptAllRowsAndDisable() {
  const { quotes, books } = await loadAllForRewrite()
  const plainQuotes = quotes.map((quote) => ({ ...quote, tags: normalizeTags(quote.tags) }))
  await db.transaction('rw', db.quotes, db.books, async () => {
    await db.quotes.bulkPut(plainQuotes)
    await db.books.bulkPut(books)
  })
  // Only after the plaintext rows are committed may the encryption record be removed.
  disableEncryptionRecord()
}

export async function listBooks() {
  const rows = await db.books.toArray()
  const books = await Promise.all(rows.map((book) => safeDecryptBook(book)))
  return books
    .filter((book): book is Book => Boolean(book))
    .sort((a, b) => a.title.localeCompare(b.title))
}

export async function getBook(id: string) {
  const book = await db.books.get(id)
  return book ? (await safeDecryptBook(book)) ?? undefined : undefined
}

export function createBook(input: BookInput) {
  return guardedWrite(() => insertBook(input))
}

async function insertBook(input: BookInput) {
  const timestamp = now()
  const book: Book = {
    ...input,
    id: crypto.randomUUID(),
    title: input.title.trim(),
    author: input.author?.trim() || undefined,
    weight: input.weight ?? 'normal',
    createdAt: timestamp,
    updatedAt: timestamp
  }

  await db.books.add(await encryptBookForStorage(book))
  return book
}

export function updateBook(id: string, patch: Partial<Book>) {
  return guardedWrite(() => applyBookUpdate(id, patch))
}

async function applyBookUpdate(id: string, patch: Partial<Book>) {
  const current = await getBook(id)
  if (!current) return undefined
  const nextBook: Book = { ...current, ...patch, updatedAt: now() }
  await db.books.put(await encryptBookForStorage(nextBook))
  return getBook(id)
}

export function deleteBook(id: string) {
  return guardedWrite(() => db.books.delete(id))
}

export function upsertBooks(books: Book[]) {
  return guardedWrite(async () => {
    await db.books.bulkPut(await Promise.all(books.map((book) => encryptBookForStorage(book))))
  })
}

export function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .flatMap((tag) => tag.split(','))
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    )
  )
}

/**
 * Unlocks the vault. An earlier-format vault is moved to a fresh salt and key on a correct password:
 * every row is re-encrypted, then the version 2 record is saved. Resolves true for a correct password
 * even if that rotation fails (it is retried on the next unlock); false for a wrong password.
 * Runs under the bulk-rewrite lock, so overlapping unlocks and single writes wait for it.
 */
export function unlockVault(password: string) {
  return runBulkRewrite(async () => {
    const plan = await planVaultUnlock(password)
    if (plan.kind === 'rejected') return false
    if (plan.kind === 'rotate') await rotateVaultKey(plan.currentKey, plan.stagedKey, plan.next)
    return true
  })
}

const rotationFailedMessage =
  'Quiet Signal: could not re-encrypt the vault with a new key; keeping the current key and retrying on the next unlock.'
const rotationRecordMessage =
  'Quiet Signal: the vault was re-encrypted, but its record could not be saved; finishing on the next unlock.'

// Order, chosen so that every stored row stays decryptable with the password at every step:
// 1. Re-encrypt every row in memory (no writes). Rows are read with the current key, or with the staged
//    key if a staged record from an interrupted rotation exists.
// 2. Stage the target record (salt + verifier) under a separate key, unless it is already staged.
// 3. Write all rows in one transaction.
// 4. Make the staged record the active one, then switch the in-memory key.
// Fails in 1-3: nothing was committed, the active record and the old key stay; a staged record is
// harmless and is reused as the target next time. Fails in 4: rows use the staged key and the staged
// record describes it; the next unlock reads rows with either key and finishes the rotation.
async function rotateVaultKey(currentKey: CryptoKey, stagedKey: CryptoKey | null, next: VaultKeyMaterial) {
  const reencrypted = await reencryptAllRows(currentKey, stagedKey, next.key)
  try {
    if (!reencrypted.ok) throw new Error(rewriteAbortMessage)
    if (!stagedKey) stageEncryptionRecord(next)
    await db.transaction('rw', db.quotes, db.books, async () => {
      await db.quotes.bulkPut(reencrypted.quotes)
      await db.books.bulkPut(reencrypted.books)
    })
  } catch {
    console.warn(rotationFailedMessage)
    activateEncryptionKey(reencrypted.readKey)
    return
  }
  try {
    commitStagedEncryptionRecord(next)
  } catch {
    console.warn(rotationRecordMessage)
  }
  activateEncryptionKey(next.key)
}

type ReencryptedRows =
  | { ok: true; quotes: Quote[]; books: Book[]; readKey: CryptoKey }
  | { ok: false; readKey: CryptoKey }

/**
 * Decrypts every row (including trashed quotes) and encrypts it with `targetKey`, all before any write.
 * Any row that cannot be read with either key, or a failing encryption, aborts the rotation; `readKey`
 * is then the key that reads most rows, for use until the next unlock.
 */
async function reencryptAllRows(
  currentKey: CryptoKey,
  stagedKey: CryptoKey | null,
  targetKey: CryptoKey
): Promise<ReencryptedRows> {
  const quoteRows = await db.quotes.toArray()
  const bookRows = await db.books.toArray()
  const usage = { current: 0, staged: 0, failed: false }

  async function decryptWithEither<T>(row: T, decrypt: (row: T, key: CryptoKey) => Promise<T | null>) {
    for (const [key, slot] of [
      [currentKey, 'current'],
      [stagedKey, 'staged']
    ] as const) {
      if (!key) continue
      try {
        const value = await decrypt(row, key)
        if (value) {
          usage[slot] += 1
          return value
        }
      } catch {
        // Try the next key.
      }
    }
    usage.failed = true
    return null
  }

  const quotes = await Promise.all(quoteRows.map((row) => decryptWithEither(row, decryptQuoteWithKey)))
  const books = await Promise.all(bookRows.map((row) => decryptWithEither(row, decryptBookWithKey)))
  const readKey = stagedKey && usage.staged > usage.current ? stagedKey : currentKey
  if (usage.failed) return { ok: false, readKey }
  try {
    return {
      ok: true,
      readKey,
      quotes: await Promise.all(quotes.map((quote) => encryptQuoteWithKey(quote as Quote, targetKey))),
      books: await Promise.all(books.map((book) => encryptBookWithKey(book as Book, targetKey)))
    }
  } catch {
    return { ok: false, readKey }
  }
}
