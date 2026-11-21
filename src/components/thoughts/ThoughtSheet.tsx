import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import type { Thought } from '../../types/quote'
import { ThoughtList } from './ThoughtList'

interface ThoughtSheetProps {
  thoughts: Thought[]
  onSave: (text: string) => void | Promise<void>
  onClose: () => void
}

// Bottom sheet to add a thought to the top card; existing thoughts are listed above the field.
export function ThoughtSheet({ thoughts, onSave, onClose }: ThoughtSheetProps) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const sorted = [...thoughts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const canSave = text.trim().length > 0 && !saving

  // Captured during the first render, before autoFocus moves focus into the sheet.
  const [previouslyFocused] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null))

  // Restore focus to whatever opened the sheet once it closes.
  useEffect(() => () => previouslyFocused?.focus(), [previouslyFocused])

  async function submit() {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave(text.trim())
    } catch {
      // The caller reports failures; the sheet just keeps the text and re-enables saving.
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/15 p-3 backdrop-blur-[2px] sm:items-center sm:justify-center" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={t('thoughtsTitle')}
        className="grid max-h-[85dvh] w-full gap-3 overflow-y-auto rounded-md border border-line bg-paper p-4 shadow-[0_24px_80px_rgba(31,30,28,0.2)] sm:max-w-md"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <h2 className="font-serif text-2xl">{t('thoughtsTitle')}</h2>
        {sorted.length > 0 && <ThoughtList thoughts={sorted} />}
        <textarea
          className="min-h-24 rounded-md border border-line bg-paper px-3 py-2 text-ink"
          placeholder={t('thoughtPlaceholder')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          autoFocus
        />
        <div className="grid gap-2 sm:flex sm:justify-end">
          <button type="button" className="rounded-md border border-line px-4 py-2 text-sm text-graphite" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm text-paper disabled:opacity-40" disabled={!canSave}>
            {t('save')}
          </button>
        </div>
      </form>
    </div>
  )
}
