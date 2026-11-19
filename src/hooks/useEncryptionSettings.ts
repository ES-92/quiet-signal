import { useState } from 'react'
import { decryptAllQuotesAndDisable, encryptAllQuotes } from '../db/database'
import { useI18n } from '../i18n/useI18n'
import { enableEncryption, isEncryptionUnlocked, unlockEncryption } from '../services/security'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useToastStore } from '../store/useToastStore'

// Enabling and disabling the vault rewrites every stored row; failures keep the old rows and show a toast.
export function useEncryptionSettings(onMessage: (message: string) => void) {
  const { t } = useI18n()
  const loadQuotes = useQuoteStore((state) => state.loadQuotes)
  const loadBooks = useBookStore((state) => state.loadBooks)
  const showToast = useToastStore((state) => state.showToast)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function enable() {
    if (password.length < 8) {
      onMessage(t('passwordTooShort'))
      return
    }
    setBusy(true)
    try {
      await enableEncryption(password)
      await encryptAllQuotes()
      await loadQuotes()
      await loadBooks()
      setPassword('')
      onMessage(t('encryptionEnabled'))
    } catch {
      showToast({ message: t('encryptionEnableFailed') })
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      if (!isEncryptionUnlocked()) {
        if (!(await unlockEncryption(password))) {
          onMessage(t('wrongPassword'))
          return
        }
      }
      await decryptAllQuotesAndDisable()
      await loadQuotes()
      await loadBooks()
      setPassword('')
      onMessage(t('encryptionDisabled'))
    } catch {
      showToast({ message: t('encryptionDisableFailed') })
    } finally {
      setBusy(false)
    }
  }

  return { password, setPassword, busy, enable, disable }
}
