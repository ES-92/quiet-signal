import type { ClarifyDraft } from '../../hooks/useClarifyDraft'
import { useI18n } from '../../i18n/useI18n'
import type { Book } from '../../types/book'
import { EntryTypeControl } from '../EntryTypeControl'
import { LocationCapture } from '../LocationCapture'
import { SignalStrengthControl } from '../SignalStrengthControl'
import { Field } from './Field'

interface ClarifyDetailsFormProps {
  draft: ClarifyDraft
  books: Book[]
  onChange: (patch: Partial<ClarifyDraft>) => void
  onBookChange: (id: string) => void
  onSave: () => void
  onFinish: () => void
}

// Edit form for the top card: type, strength, text, note, book or context details, tags.
export function ClarifyDetailsForm({
  draft,
  books,
  onChange,
  onBookChange,
  onSave,
  onFinish
}: ClarifyDetailsFormProps) {
  const { t } = useI18n()
  const contextDetails =
    draft.entryType === 'memory' || draft.entryType === 'conversation' || draft.entryType === 'observation'
  const bookDetails = draft.entryType === 'book_quote'

  return (
    <div className="quiet-pop grid gap-4 rounded-md border border-line bg-white/30 p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-graphite">{t('signalDraft')}</p>
        <h3 className="mt-1 font-serif text-2xl">{t('signalDraftTitle')}</h3>
      </div>
      <EntryTypeControl value={draft.entryType} onChange={(entryType) => onChange({ entryType })} />
      <SignalStrengthControl value={draft.strength} onChange={(strength) => onChange({ strength })} />
      <label className="grid gap-2">
        <span className="text-sm text-graphite">{t('text')}</span>
        <textarea
          className="min-h-28 rounded-md border border-line bg-white/50 p-4 font-serif text-xl leading-snug"
          value={draft.text}
          onChange={(event) => onChange({ text: event.target.value })}
        />
      </label>
      <label className="grid gap-2">
        <span className="text-sm text-graphite">{t('note')}</span>
        <textarea
          className="min-h-24 rounded-md border border-line bg-white/50 p-3"
          value={draft.note}
          onChange={(event) => onChange({ note: event.target.value })}
        />
      </label>

      {bookDetails && (
        <div className="grid gap-3 rounded-md border border-line bg-paper/60 p-3 sm:grid-cols-2">
          <p className="font-serif text-xl sm:col-span-2">{t('bookDetails')}</p>
          {books.length > 0 && (
            <label className="grid gap-2 sm:col-span-2">
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
          <Field label={t('author')} value={draft.author} onChange={(author) => onChange({ author })} />
          <Field label={t('work')} value={draft.work} onChange={(work) => onChange({ work })} />
          <Field label={t('source')} value={draft.source} onChange={(source) => onChange({ source })} />
          <Field label={t('year')} value={draft.year} onChange={(year) => onChange({ year })} />
        </div>
      )}

      {(contextDetails || !bookDetails) && (
        <div className="grid gap-3 rounded-md border border-line bg-paper/60 p-3">
          <p className="font-serif text-xl">{t('contextDetails')}</p>
          <label className="grid gap-2">
            <span className="text-sm text-graphite">{t('occurredAt')}</span>
            <input
              className="rounded-md border border-line bg-white/50 px-3 py-3"
              type="datetime-local"
              value={draft.occurredAt}
              onChange={(event) => onChange({ occurredAt: event.target.value })}
            />
          </label>
          <Field
            label={t('people')}
            value={draft.people}
            onChange={(people) => onChange({ people })}
            placeholder={t('peoplePlaceholder')}
          />
          <LocationCapture
            value={{
              locationName: draft.locationName,
              locationLatitude: draft.locationLatitude,
              locationLongitude: draft.locationLongitude
            }}
            onChange={(location) =>
              onChange({
                locationName: location.locationName,
                locationLatitude: location.locationLatitude,
                locationLongitude: location.locationLongitude
              })
            }
          />
        </div>
      )}

      <Field
        label={t('tags')}
        value={draft.tags}
        onChange={(tags) => onChange({ tags })}
        placeholder={t('noiseTagsPlaceholder')}
      />
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
