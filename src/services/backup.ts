import type { Book } from '../types/book'
import type { Quote } from '../types/quote'
import { downloadText, exportJson } from './importExport'

const backupKey = 'quiet-signal-last-backup-at'
const staleAfterDays = 14
const dueAfterDays = 7

export type BackupState = 'empty' | 'fresh' | 'due' | 'stale'

export function getLastBackupAt() {
  return localStorage.getItem(backupKey) || undefined
}

export function markBackupNow() {
  const timestamp = new Date().toISOString()
  localStorage.setItem(backupKey, timestamp)
  return timestamp
}

export function backupAgeDays(timestamp?: string) {
  if (!timestamp) return undefined
  const then = new Date(timestamp).getTime()
  if (Number.isNaN(then)) return undefined
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000))
}

export function backupState(totalEntries: number, timestamp = getLastBackupAt()): BackupState {
  if (!totalEntries) return 'empty'
  const age = backupAgeDays(timestamp)
  if (age === undefined) return 'stale'
  if (age >= staleAfterDays) return 'stale'
  if (age >= dueAfterDays) return 'due'
  return 'fresh'
}

export function backupFilename() {
  return `quiet-signal-backup-${new Date().toISOString().slice(0, 10)}.json`
}

export function downloadBackup(quotes: Quote[], books: Book[]) {
  downloadText(backupFilename(), exportJson(quotes, books), 'application/json')
  return markBackupNow()
}
