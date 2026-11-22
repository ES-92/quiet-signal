// SYNTHETIC – built from the format in the code: creates vault data in the format before record version 2
// (record without `version`, rows encrypted with an AES-GCM key derived via PBKDF2 deriveKey).
import type { Book } from '../types/book'
import type { Quote } from '../types/quote'

// Constants and derivation below are intentionally frozen to the earlier format; do not sync them with security.ts.
export const encryptionStorageKey = 'quiet-signal-encryption'
const iterations = 180000

// Spreading a large array into String.fromCharCode overflows the call stack (photos, voice notes),
// so the bytes are converted in slices.
const base64ChunkSize = 0x8000

export function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += base64ChunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(offset, offset + base64ChunkSize)))
  }
  return btoa(binary)
}

export function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function passwordKey(password: string) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
    'deriveKey'
  ])
}

/** PBKDF2-SHA-256, 256 bits, with the same parameters as the app. */
export async function derivePasswordBits(password: string, salt: Uint8Array) {
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt.slice().buffer, iterations, hash: 'SHA-256' },
    await passwordKey(password),
    256
  )
  return new Uint8Array(bits)
}

async function legacyAesKey(password: string, salt: Uint8Array) {
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.slice().buffer, iterations, hash: 'SHA-256' },
    await passwordKey(password),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/** Writes a record in the earlier format: { enabled, salt, hash } without `version`. */
export async function writeLegacyEncryptionRecord(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = bytesToBase64(await derivePasswordBits(password, salt))
  const raw = JSON.stringify({ enabled: true, salt: bytesToBase64(salt), hash })
  localStorage.setItem(encryptionStorageKey, raw)
  return { salt, hash, raw }
}

/** Encrypts a quote in the app's storage format, with the key derived the earlier deriveKey way. */
export async function encryptQuoteLegacy(quote: Quote, password: string, salt: Uint8Array): Promise<Quote> {
  const { encrypted, encryptedPayload, encryptionIv, ...plain } = quote
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const payload = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await legacyAesKey(password, salt),
    new TextEncoder().encode(JSON.stringify(plain))
  )
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
    encryptedPayload: bytesToBase64(new Uint8Array(payload)),
    encryptionIv: bytesToBase64(iv)
  }
}

/** Encrypts a book in the app's storage format, with the key derived the earlier deriveKey way. */
export async function encryptBookLegacy(book: Book, password: string, salt: Uint8Array): Promise<Book> {
  const { encrypted, encryptedPayload, encryptionIv, ...plain } = book
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const payload = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await legacyAesKey(password, salt),
    new TextEncoder().encode(JSON.stringify(plain))
  )
  return {
    id: book.id,
    title: '',
    weight: book.weight,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    encrypted: true,
    encryptedPayload: bytesToBase64(new Uint8Array(payload)),
    encryptionIv: bytesToBase64(iv)
  }
}
