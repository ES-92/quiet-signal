import { RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { EmptyState } from '../components/EmptyState'
import { listTrashed } from '../db/database'
import { useI18n } from '../i18n/I18nProvider'
import { tapHaptic } from '../services/haptics'
import { useQuoteStore } from '../store/useQuoteStore'
import type { Quote } from '../types/quote'

export function TrashPage() {
  const { t } = useI18n()
  const { restoreQuote, emptyTrash } = useQuoteStore()
  const [trashed, setTrashed] = useState<Quote[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function reload() {
    setTrashed(await listTrashed())
  }

  useEffect(() => {
    void reload()
  }, [])

  async function handleRestore(id: string) {
    tapHaptic(8)
    await restoreQuote(id)
    await reload()
  }

  async function handleEmpty() {
    await emptyTrash()
    await reload()
    setConfirmOpen(false)
  }

  return (
    <div className="grid gap-5 pt-3 sm:gap-8 sm:pt-10">
      <section className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-[0.2em] text-graphite">{t('trash')}</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">{t('trash')}</h1>
          <p className="mt-4 max-w-xl leading-7 text-graphite">{t('trashIntro')}</p>
        </div>
        {trashed.length > 0 && (
          <button
            type="button"
            className="quiet-touch inline-flex shrink-0 items-center gap-2 rounded-full border border-clay px-4 py-2 text-sm text-clay"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 size={16} />
            {t('emptyTrash')}
          </button>
        )}
      </section>

      {trashed.length === 0 ? (
        <EmptyState title={t('trashEmptyTitle')}>{t('trashEmptyBody')}</EmptyState>
      ) : (
        <ul className="grid gap-3">
          {trashed.map((quote) => (
            <li key={quote.id} className="flex items-start justify-between gap-3 rounded-md border border-line bg-white/30 p-4">
              <div className="min-w-0">
                <p className="line-clamp-3 break-words font-serif text-lg leading-snug text-ink">
                  {quote.text || quote.note || (quote.imageDataUrl ? t('untitledPhotoNote') : t('untitledVoiceNote'))}
                </p>
                <p className="mt-1 truncate text-xs text-graphite">{[quote.author, quote.work].filter(Boolean).join(', ')}</p>
              </div>
              <button
                type="button"
                className="quiet-touch inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-line px-3 text-sm text-ink"
                aria-label={t('restore')}
                title={t('restore')}
                onClick={() => void handleRestore(quote.id)}
              >
                <RotateCcw size={15} />
                {t('restore')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmSheet
        open={confirmOpen}
        title={t('emptyTrash')}
        description={t('emptyTrashConfirm')}
        confirmLabel={t('emptyTrash')}
        cancelLabel={t('cancel')}
        onConfirm={handleEmpty}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  )
}
