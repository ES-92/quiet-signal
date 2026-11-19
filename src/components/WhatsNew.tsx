import { Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { TranslationKey } from '../i18n/translations'
import { useI18n } from '../i18n/useI18n'
import { ensureVersionInitialized, lastSeenVersion, markVersionSeen, notesSince, shouldShowWhatsNew } from '../services/release'

export function WhatsNew({ onSupport }: { onSupport: () => void }) {
  const { t } = useI18n()
  // Release-note keys are captured once on mount; null means nothing to show.
  const [pendingKeys, setPendingKeys] = useState<TranslationKey[] | null>(() =>
    shouldShowWhatsNew() ? notesSince(lastSeenVersion()).flatMap((note) => note.items) : null
  )

  useEffect(() => {
    if (!shouldShowWhatsNew()) ensureVersionInitialized()
  }, [])

  if (!pendingKeys) return null
  const notes = pendingKeys.map((key) => t(key))

  function dismiss() {
    markVersionSeen()
    setPendingKeys(null)
  }

  return (
    <div
      className="quiet-fade fixed inset-0 z-40 flex items-end bg-ink/15 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:justify-center"
      onClick={dismiss}
    >
      <section className="quiet-sheet classical-panel relative w-full max-w-md rounded-md p-5 sm:p-6" onClick={(event) => event.stopPropagation()}>
        <button className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-graphite" onClick={dismiss} aria-label={t('close')}>
          <X size={16} />
        </button>
        <div className="flex items-center gap-3 pr-10">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-ink text-paper">
            <Sparkles size={18} />
          </span>
          <h2 className="font-serif text-2xl">{t('whatsNewTitle')}</h2>
        </div>
        <ul className="mt-4 grid gap-2">
          {notes.map((line) => (
            <li key={line} className="flex gap-2 text-sm leading-6 text-graphite">
              <span className="text-clay">·</span>
              {line}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-5 min-h-[46px] w-full rounded-md border border-line px-4 py-2 text-sm text-ink hover:border-ink/40"
          onClick={() => {
            dismiss()
            onSupport()
          }}
        >
          {t('whatsNewSupportLine')}
        </button>
      </section>
    </div>
  )
}
