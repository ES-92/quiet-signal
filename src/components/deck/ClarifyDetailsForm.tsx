import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { ClarifyDraft } from '../../hooks/useClarifyDraft'
import { useI18n } from '../../i18n/useI18n'
import type { Book } from '../../types/book'
import { Field } from './Field'

interface ClarifyDetailsFormProps {
  draft: ClarifyDraft
  books: Book[]
  onChange: (patch: Partial<ClarifyDraft>) => void
  onBookChange: (id: string) => void
  onSave: () => void
  onFinish: () => void
}

// Edit form for the top card. Text, author, book, tags and first thought are always shown; the rarely used fields sit behind "More details", which opens by itself when any of them already has a value or gets one (e.g. picking a book fills Werk).
export function ClarifyDetailsForm({
  draft,
  books,
  onChange,
  onBookChange,
  onSave,
  onFinish
}: ClarifyDetailsFormProps) {
  const { t } = useI18n()
  const hasRareValues = Boolean(
    draft.people.trim() || draft.occurredAt || draft.work || draft.year || draft.note.trim() || draft.source
  )
  // Decided when the form opens, so clearing a field never makes the others jump away.
  const [moreOpen, setMoreOpen] = useState(hasRareValues)
  // While collapsed the user cannot edit these fields, so a change means the app filled one (adjusting state while rendering).
  const rareKey = [draft.people, draft.occurredAt, draft.work, draft.year, draft.note, draft.source].join('\u0001')
  const [seenRareKey, setSeenRareKey] = useState(rareKey)
  if (rareKey !== seenRareKey) {
    setSeenRareKey(rareKey)
    if (hasRareValues) setMoreOpen(true)
  }

  return (
    <div className="quiet-pop grid gap-4 rounded-md border border-line bg-white/30 p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-graphite">{t('signalDraft')}</p>
        <h3 className="mt-1 font-serif text-2xl">{t('signalDraftTitle')}</h3>
      </div>
      <label className="grid gap-2">
        <span className="text-sm text-graphite">{t('text')}</span>
        <textarea
          className="min-h-28 rounded-md border border-line bg-white/50 p-4 font-serif text-xl leading-snug"
          value={draft.text}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      </label>

      <Field label={t('author')} value={draft.author} onChange={(author) => onChange({ author })} />
      {books.length > 0 && (
        <label className="grid gap-2">
          <span className="text-sm text-graphite">{t('book')}</span>
          <select
            className="rounded-md border border-line bg-white/50 px-3 py-3"
            value={draft.bookId}
            onChange={(event) => onBookChange(event.target.value)}
          >
            <option value="">{t('noBookOption')}</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.author ? `${book.title} - ${book.author}` : book.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <Field
        label={t('tags')}
        value={draft.tags}
        onChange={(tags) => onChange({ tags })}
        placeholder={t('noiseTagsPlaceholder')}
      />
      <label className="grid gap-2">
        <span className="text-sm text-graphite">{t('firstThoughtLabel')}</span>
        <textarea
          className="min-h-20 rounded-md border border-line bg-white/50 p-3"
          value={draft.firstThought}
          onChange={(event) => onChange({ firstThought: event.target.value })}
        />
      </label>

      <button
        type="button"
        className="flex min-h-[44px] items-center gap-2 text-left text-sm text-graphite"
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((open) => !open)}
      >
        <ChevronDown size={16} className={moreOpen ? 'rotate-180' : ''} aria-hidden="true" />
        {t('moreDetails')}
      </button>
      {moreOpen && (
        <div className="grid gap-3 rounded-md border border-line bg-paper/60 p-3 sm:grid-cols-2">
          <Field
            label={t('people')}
            value={draft.people}
            onChange={(people) => onChange({ people })}
            placeholder={t('peoplePlaceholder')}
          />
          <label className="grid gap-2">
            <span className="text-sm text-graphite">{t('occurredAt')}</span>
            <input
              className="rounded-md border border-line bg-white/50 px-3 py-3"
              type="datetime-local"
              value={draft.occurredAt}
              onChange={(event) => onChange({ occurredAt: event.target.value })}
            />
          </label>
          <Field label={t('work')} value={draft.work} onChange={(work) => onChange({ work })} />
          <Field label={t('year')} value={draft.year} onChange={(year) => onChange({ year })} />
          <Field label={t('source')} value={draft.source} onChange={(source) => onChange({ source })} />
          <label className="grid gap-2 sm:col-span-2">
            <span className="text-sm text-graphite">{t('note')}</span>
            <textarea
              className="min-h-24 rounded-md border border-line bg-white/50 p-3"
              value={draft.note}
              onChange={(event) => onChange({ note: event.target.value })}
            />
          </label>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="min-h-[46px] rounded-md border border-line px-3 py-2 text-sm text-graphite"
          onClick={onSave}
        >
          {t('saveDetails')}
        </button>
        <button
          type="button"
          className="min-h-[46px] rounded-md bg-ink px-3 py-2 text-sm text-paper"
          onClick={onFinish}
        >
          {t('finishSignal')}
        </button>
      </div>
    </div>
  )
}
