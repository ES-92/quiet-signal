import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { copyShortcutUrl, shortcutUrl } from '../services/shortcuts'

export function useShortcutCopy() {
  const { t } = useI18n()
  const [message, setMessage] = useState('')

  // Falls back to showing the link when the clipboard is not available.
  async function copy(mode: 'text' | 'photo' | 'audio') {
    try {
      await copyShortcutUrl(mode)
      setMessage(t('shortcutCopied'))
    } catch {
      setMessage(shortcutUrl(mode))
    }
  }

  return { message, copy }
}
