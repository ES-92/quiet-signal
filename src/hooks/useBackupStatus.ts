import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { backupAgeDays, backupState, downloadBackup, getLastBackupAt } from '../services/backup'
import type { Book } from '../types/book'
import type { Quote } from '../types/quote'

export function useBackupStatus(quotes: Quote[], books: Book[]) {
  const { t, locale } = useI18n()
  const [, setVersion] = useState(0)
  const [message, setMessage] = useState('')

  function createBackup() {
    const timestamp = downloadBackup(quotes, books)
    setVersion((value) => value + 1)
    setMessage(t('backupCreated', { date: formatDateTime(timestamp, locale) }))
  }

  const lastBackupAt = getLastBackupAt()
  return {
    lastBackupAt,
    age: backupAgeDays(lastBackupAt),
    state: backupState(quotes.length + books.length, lastBackupAt),
    message,
    createBackup
  }
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}
