// SYNTHETISCH – nach Format im Code gebaut: erzeugt Tresor-Daten im Format vor Prüfdatensatz-Version 2
// (Datensatz ohne `version`, Zeilen mit einem per PBKDF2-deriveKey abgeleiteten AES-GCM-Schlüssel).
import type { Quote } from '../types/quote'

// Constants and derivation below are intentionally frozen to the earlier format; do not sync them with security.ts.
export const encryptionStorageKey = 'quiet-signal-encryption'
const iterations = 180000

export function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
}

export function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}

function passwordKey(password: string) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
    'deriveKey'
  ])
}

/** PBKDF2-SHA-256, 256 Bit, mit denselben Parametern wie die App. */
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

/** Schreibt einen Datensatz wie frühere Versionen: { enabled, salt, hash } ohne `version`. */
export async function writeLegacyEncryptionRecord(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = bytesToBase64(await derivePasswordBits(password, salt))
  const raw = JSON.stringify({ enabled: true, salt: bytesToBase64(salt), hash })
  localStorage.setItem(encryptionStorageKey, raw)
  return { salt, hash, raw }
}

/** Verschlüsselt ein Quote im Speicherformat der App, Schlüssel über den früheren deriveKey-Weg. */
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
