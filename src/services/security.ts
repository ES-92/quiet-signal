import type { Book } from '../types/book'
import type { Quote } from '../types/quote'

const pinStorageKey = 'quiet-signal-pin'
const encryptionStorageKey = 'quiet-signal-encryption'
// Staged version 2 record for a key rotation in progress; see unlockVault in database.ts.
const pendingEncryptionStorageKey = 'quiet-signal-encryption-pending'
const iterations = 180000
const verifierVersion = 2
const verifierContext = 'quiet-signal/vault-verifier/v2'
let activeEncryptionKey: CryptoKey | null = null

interface SecretRecord {
  salt: string
  hash: string
}

export interface EncryptionRecord extends SecretRecord {
  enabled: boolean
  /** 2: `hash` is a SHA-256 verifier of the derived bits. Missing: earlier record format. Other values are rejected. */
  version?: number
}

/** Salt, AES-GCM key and version 2 verifier derived from one password. */
export interface VaultKeyMaterial {
  salt: Uint8Array
  key: CryptoKey
  verifier: string
}

/**
 * Outcome of checking a password against the stored record:
 * - rejected: wrong password or unknown record version (nothing changed).
 * - unlocked: no vault, or a version 2 vault that is now unlocked.
 * - rotate: earlier-format vault with a correct password; the caller must re-encrypt every row from
 *   `currentKey` (or `stagedKey`, if a staged rotation exists) to `next.key`. Still locked.
 */
export type VaultUnlockPlan =
  | { kind: 'rejected' }
  | { kind: 'unlocked' }
  | { kind: 'rotate'; currentKey: CryptoKey; stagedKey: CryptoKey | null; next: VaultKeyMaterial }

export function notifySecurityChanged() {
  window.dispatchEvent(new Event('quiet-signal-security-changed'))
}

export function lockAppNow() {
  window.dispatchEvent(new Event('quiet-signal-lock-now'))
}

export function hasPinLock() {
  return Boolean(localStorage.getItem(pinStorageKey))
}

export async function setPinLock(pin: string) {
  localStorage.setItem(pinStorageKey, JSON.stringify(await hashSecret(pin)))
  notifySecurityChanged()
}

export async function verifyPin(pin: string) {
  const record = readSecretRecord(pinStorageKey)
  if (!record) return true
  return constantTimeEqual(await hashWithSalt(pin, base64ToBytes(record.salt)), record.hash)
}

export function clearPinLock() {
  localStorage.removeItem(pinStorageKey)
  notifySecurityChanged()
}

export function isEncryptionEnabled() {
  return readEncryptionRecord()?.enabled === true
}

export function isEncryptionUnlocked() {
  return !isEncryptionEnabled() || activeEncryptionKey !== null
}

export async function enableEncryption(password: string) {
  if (isEncryptionEnabled()) throw new Error('Encryption is already enabled.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await derivePasswordBits(password, salt)
  const key = await importAesKey(bits)
  writeEncryptionRecord(salt, await vaultVerifier(bits))
  activeEncryptionKey = key
  notifySecurityChanged()
}

/**
 * Internal: only for unlockVault (database.ts), which performs the rotation this may ask for.
 * Checks the password. Unlocks a version 2 vault directly; never writes rows.
 */
export async function planVaultUnlock(password: string): Promise<VaultUnlockPlan> {
  const record = readEncryptionRecord()
  if (!record?.enabled) return { kind: 'unlocked' }
  const salt = base64ToBytes(record.salt)
  const bits = await derivePasswordBits(password, salt)

  if (record.version === verifierVersion) {
    if (!constantTimeEqual(await vaultVerifier(bits), record.hash)) return { kind: 'rejected' }
    await dropObsoleteStagedRecord(password, record.salt)
    activateEncryptionKey(await importAesKey(bits))
    return { kind: 'unlocked' }
  }

  // Unknown record version: refuse to unlock and leave the record untouched.
  if (record.version !== undefined) return { kind: 'rejected' }

  // Earlier record format: compare against its stored value; the caller rotates to a version 2 record.
  if (!constantTimeEqual(bytesToBase64(bits), record.hash)) return { kind: 'rejected' }
  const currentKey = await importAesKey(bits)
  const staged = await readStagedMaterial(password, record.salt)
  if (staged) return { kind: 'rotate', currentKey, stagedKey: staged.key, next: staged }
  return { kind: 'rotate', currentKey, stagedKey: null, next: await deriveVaultKeyMaterial(password) }
}

/** Derives fresh material (new random salt) for the password. */
async function deriveVaultKeyMaterial(password: string): Promise<VaultKeyMaterial> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await derivePasswordBits(password, salt)
  return { salt, key: await importAesKey(bits), verifier: await vaultVerifier(bits) }
}

/** Saves the target record of a rotation under the staging key. Throws if storage fails. */
export function stageEncryptionRecord(material: VaultKeyMaterial) {
  localStorage.setItem(
    pendingEncryptionStorageKey,
    JSON.stringify(buildEncryptionRecord(material.salt, material.verifier))
  )
}

/** Makes the staged target the active record, then removes the staging key. Throws if storage fails. */
export function commitStagedEncryptionRecord(material: VaultKeyMaterial) {
  writeEncryptionRecord(material.salt, material.verifier)
  try {
    localStorage.removeItem(pendingEncryptionStorageKey)
  } catch {
    // A leftover staged record with the active salt is removed on the next unlock.
  }
}

export function activateEncryptionKey(key: CryptoKey) {
  activeEncryptionKey = key
  notifySecurityChanged()
}

/**
 * Staged record that matches the password, or null (missing, malformed, for another password, or with
 * the salt of the active record; staging always uses a fresh salt).
 */
async function readStagedMaterial(password: string, activeSalt: string): Promise<VaultKeyMaterial | null> {
  const staged = readRecord(pendingEncryptionStorageKey)
  if (!staged?.enabled || staged.version !== verifierVersion || typeof staged.salt !== 'string') return null
  if (staged.salt === activeSalt) return null
  try {
    const salt = base64ToBytes(staged.salt)
    const bits = await derivePasswordBits(password, salt)
    const verifier = await vaultVerifier(bits)
    if (!constantTimeEqual(verifier, staged.hash ?? '')) return null
    return { salt, key: await importAesKey(bits), verifier }
  } catch {
    return null
  }
}

/**
 * On a version 2 unlock a staged record is no longer needed if it carries the active salt (left over
 * from a finished rotation) or does not match the password.
 */
async function dropObsoleteStagedRecord(password: string, activeSalt: string) {
  try {
    const staged = readRecord(pendingEncryptionStorageKey)
    if (!staged) return
    const obsolete = staged.salt === activeSalt || !(await readStagedMaterial(password, activeSalt))
    if (obsolete) localStorage.removeItem(pendingEncryptionStorageKey)
  } catch {
    // Harmless: a staged record is only used together with an earlier-format record.
  }
}

export function lockEncryption() {
  activeEncryptionKey = null
  notifySecurityChanged()
}

export function disableEncryptionRecord() {
  localStorage.removeItem(encryptionStorageKey)
  localStorage.removeItem(pendingEncryptionStorageKey)
  activeEncryptionKey = null
  notifySecurityChanged()
}

export async function encryptQuoteForStorage(quote: Quote) {
  if (!isEncryptionEnabled()) return stripCryptoFields(quote)
  if (!activeEncryptionKey) throw new Error('Encryption is locked.')
  return encryptQuoteWithKey(quote, activeEncryptionKey)
}

export async function encryptQuoteWithKey(quote: Quote, key: CryptoKey) {
  const plaintextQuote = stripCryptoFields(quote)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(plaintextQuote))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, encoded)

  return {
    id: quote.id,
    text: '',
    tags: [],
    favorite: false,
    likes: 0,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
    reviewCount: quote.reviewCount,
    encrypted: true,
    encryptedPayload: bytesToBase64(new Uint8Array(encrypted)),
    encryptionIv: bytesToBase64(iv)
  } satisfies Quote
}

export async function decryptQuoteFromStorage(quote: Quote) {
  if (!quote.encrypted) return stripCryptoFields(quote)
  if (!activeEncryptionKey) return null
  return decryptQuoteWithKey(quote, activeEncryptionKey)
}

/** Plaintext rows are returned as they are; rejects if the key does not match. */
export async function decryptQuoteWithKey(quote: Quote, key: CryptoKey) {
  if (!quote.encrypted) return stripCryptoFields(quote)
  if (!quote.encryptedPayload || !quote.encryptionIv) return null

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(quote.encryptionIv)) },
    key,
    base64ToBytes(quote.encryptedPayload)
  )

  return JSON.parse(new TextDecoder().decode(decrypted)) as Quote
}

export async function encryptBookForStorage(book: Book) {
  if (!isEncryptionEnabled()) return stripBookCryptoFields(book)
  if (!activeEncryptionKey) throw new Error('Encryption is locked.')
  return encryptBookWithKey(book, activeEncryptionKey)
}

export async function encryptBookWithKey(book: Book, key: CryptoKey) {
  const plaintextBook = stripBookCryptoFields(book)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(plaintextBook))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, encoded)

  return {
    id: book.id,
    title: '',
    weight: book.weight,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    encrypted: true,
    encryptedPayload: bytesToBase64(new Uint8Array(encrypted)),
    encryptionIv: bytesToBase64(iv)
  } satisfies Book
}

export async function decryptBookFromStorage(book: Book) {
  if (!book.encrypted) return stripBookCryptoFields(book)
  if (!activeEncryptionKey) return null
  return decryptBookWithKey(book, activeEncryptionKey)
}

/** Plaintext rows are returned as they are; rejects if the key does not match. */
export async function decryptBookWithKey(book: Book, key: CryptoKey) {
  if (!book.encrypted) return stripBookCryptoFields(book)
  if (!book.encryptedPayload || !book.encryptionIv) return null

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(book.encryptionIv)) },
    key,
    base64ToBytes(book.encryptedPayload)
  )

  return JSON.parse(new TextDecoder().decode(decrypted)) as Book
}

function stripCryptoFields(quote: Quote): Quote {
  const { encrypted, encryptedPayload, encryptionIv, ...plain } = quote
  return plain
}

function stripBookCryptoFields(book: Book): Book {
  const { encrypted, encryptedPayload, encryptionIv, ...plain } = book
  return plain
}

function readSecretRecord(key: string) {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as SecretRecord) : null
  } catch {
    return null
  }
}

function readEncryptionRecord() {
  return readRecord(encryptionStorageKey)
}

function readRecord(storageKey: string) {
  try {
    const value = localStorage.getItem(storageKey)
    return value ? (JSON.parse(value) as EncryptionRecord) : null
  } catch {
    return null
  }
}

async function hashSecret(secret: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { salt: bytesToBase64(salt), hash: await hashWithSalt(secret, salt) }
}

async function hashWithSalt(secret: string, salt: Uint8Array) {
  return bytesToBase64(await derivePasswordBits(secret, salt))
}

function writeEncryptionRecord(salt: Uint8Array, verifier: string) {
  localStorage.setItem(encryptionStorageKey, JSON.stringify(buildEncryptionRecord(salt, verifier)))
}

function buildEncryptionRecord(salt: Uint8Array, verifier: string): EncryptionRecord {
  return { enabled: true, salt: bytesToBase64(salt), hash: verifier, version: verifierVersion }
}

/** PBKDF2-SHA-256 (256 bits); the vault key and the verifier are both derived from these bits. */
async function derivePasswordBits(secret: string, salt: Uint8Array) {
  const key = await deriveBitsKey(secret)
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations, hash: 'SHA-256' },
    key,
    256
  )
  return new Uint8Array(bits)
}

/** Imports the derived bits as a non-extractable AES-GCM-256 key. */
function importAesKey(bits: Uint8Array) {
  return crypto.subtle.importKey('raw', toArrayBuffer(bits), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/** Verifier is a one-way hash of the derived bits with a fixed context prefix: SHA-256(context || bits). */
async function vaultVerifier(bits: Uint8Array) {
  const context = new TextEncoder().encode(verifierContext)
  const input = new Uint8Array(context.length + bits.length)
  input.set(context)
  input.set(bits, context.length)
  return bytesToBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', input)))
}

function deriveBitsKey(secret: string) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits'])
}

// Spreading a large array into String.fromCharCode overflows the call stack (photos, voice notes),
// so the bytes are converted in slices.
const base64ChunkSize = 0x8000

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += base64ChunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(offset, offset + base64ChunkSize)))
  }
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let result = 0
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return result === 0
}
