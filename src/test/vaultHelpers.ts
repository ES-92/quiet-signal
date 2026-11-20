// SYNTHETIC – built from the format in the code: helpers to inspect vault records and to build rows
// encrypted with the current (version 2) key derivation.
import type { Quote } from '../types/quote'
import { bytesToBase64, derivePasswordBits, encryptionStorageKey } from './legacyVault'

export const pendingEncryptionStorageKey = 'quiet-signal-encryption-pending'

export interface StoredVaultRecord {
  enabled: boolean
  salt: string
  hash: string
  version?: number
}

export function readStoredRecord() {
  return JSON.parse(localStorage.getItem(encryptionStorageKey) ?? 'null') as StoredVaultRecord | null
}

export function readPendingRecord() {
  return JSON.parse(localStorage.getItem(pendingEncryptionStorageKey) ?? 'null') as StoredVaultRecord | null
}

export async function expectedVerifier(bits: Uint8Array) {
  const prefix = new TextEncoder().encode('quiet-signal/vault-verifier/v2')
  const input = new Uint8Array(prefix.length + bits.length)
  input.set(prefix)
  input.set(bits, prefix.length)
  return bytesToBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', input)))
}

/** Writes a staged version 2 record for the password under the pending key and returns its salt. */
export async function writePendingRecord(password: string, options: { verifier?: string } = {}) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await derivePasswordBits(password, salt)
  const hash = options.verifier ?? (await expectedVerifier(bits))
  localStorage.setItem(
    pendingEncryptionStorageKey,
    JSON.stringify({ enabled: true, salt: bytesToBase64(salt), hash, version: 2 })
  )
  return { salt, bits }
}

/** Encrypts a quote in the app's storage format with an AES-GCM key imported from the given bits. */
export async function encryptQuoteWithBits(quote: Quote, bits: Uint8Array): Promise<Quote> {
  const { encrypted, encryptedPayload, encryptionIv, ...plain } = quote
  const key = await crypto.subtle.importKey('raw', bits.slice().buffer, 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const payload = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
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
