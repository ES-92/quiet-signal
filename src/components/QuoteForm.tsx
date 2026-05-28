import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { useBookStore } from '../store/useBookStore'
import { bookKey } from '../types/book'
import { entryType, type EntryType, type Quote, type QuoteInput, type SignalStrength } from '../types/quote'
import { AudioRecorder } from './AudioRecorder'
import { EntryTypeControl } from './EntryTypeControl'
import { LocationCapture } from './LocationCapture'
import { PhotoCapture } from './PhotoCapture'
import { SignalStrengthControl } from './SignalStrengthControl'

interface QuoteFormProps {
  quote?: Quote
  onSubmit: (input: QuoteInput) => Promise<void>
  submitLabel: string
  defaultStatus?: QuoteInput['status']
}

export function QuoteForm({ quote, onSubmit, submitLabel, defaultStatus = 'signal' }: QuoteFormProps) {
  const { t } = useI18n()
  const { books, loadBooks } = useBookStore()
  const [text, setText] = useState(quote?.text ?? '')
  const [author, setAuthor] = useState(quote?.author ?? '')
  const [work, setWork] = useState(quote?.work ?? '')
  const [source, setSource] = useState(quote?.source ?? '')
  const [year, setYear] = useState(quote?.year ?? '')
  const [bookId, setBookId] = useState(quote?.bookId ?? '')
  const [tags, setTags] = useState(quote?.tags.join(', ') ?? '')
  const [note, setNote] = useState(quote?.note ?? '')
  const [audioDataUrl, setAudioDataUrl] = useState(quote?.audioDataUrl)
  const [audioMimeType, setAudioMimeType] = useState(quote?.audioMimeType)
  const [audioDurationMs, setAudioDurationMs] = useState(quote?.audioDurationMs)
  const [imageDataUrl, setImageDataUrl] = useState(quote?.imageDataUrl)
  const [imageMimeType, setImageMimeType] = useState(quote?.imageMimeType)
  const [favorite, setFavorite] = useState(quote?.favorite ?? false)
  const [status, setStatus] = useState<QuoteInput['status']>(quote?.status ?? defaultStatus)
  const [signalStrength, setSignalStrength] = useState<SignalStrength>(quote?.signalStrength ?? 'normal')
  const [draftEntryType, setDraftEntryType] = useState<EntryType>(quote ? entryType(quote) : 'note')
  const [occurredAt, setOccurredAt] = useState(toLocalDateTime(quote?.occurredAt))
  const [people, setPeople] = useState(quote?.people?.join(', ') ?? '')
  const [locationName, setLocationName] = useState<string | undefined>(quote?.locationName)
  const [locationLatitude, setLocationLatitude] = useState<number | undefined>(quote?.locationLatitude)
  const [locationLongitude, setLocationLongitude] = useState<number | undefined>(quote?.locationLongitude)
  const [saving, setSaving] = useState(false)
  const canSave = Boolean(text.trim() || audioDataUrl || imageDataUrl)

  useEffect(() => {
    void loadBooks()
  }, [loadBooks])

  function handleBookChange(id: string) {
    setBookId(id)
    const book = books.find((item) => item.id === id)
    if (book) {
      setWork(book.title)
      if (book.author) setAuthor(book.author)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSave) return
    setSaving(true)
    // If no book was picked but the work matches one, link it automatically.
    let resolvedBookId = bookId || undefined
    if (!resolvedBookId && work.trim()) {
      const match = books.find((book) => bookKey(book.title, book.author) === bookKey(work, author))
      if (match) resolvedBookId = match.id
    }
    await onSubmit({
      text: text.trim(),
      author: clean(author),
      work: clean(work),
      source: clean(source),
      year: clean(year),
      bookId: resolvedBookId,
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      note: clean(note),
      audioDataUrl,
      audioMimeType,
      audioDurationMs,
      imageDataUrl,
      imageMimeType,
      favorite,
      status,
      signalStrength,
      entryType: draftEntryType,
      occurredAt: fromLocalDateTime(occurredAt),
      people: splitList(people),
      locationName: clean(locationName),
      locationLatitude,
      locationLongitude
    })
    setSaving(false)
  }

  return (
    <form className="grid gap-4 sm:gap-5" onSubmit={handleSubmit}>
      <label className="grid gap-2">
        <span className="text-sm text-graphite">{t('text')}</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          className="min-h-32 rounded-md border border-line bg-white/50 p-4 font-serif text-xl leading-snug sm:text-2xl"
        />
      </label>
      <PhotoCapture
        imageDataUrl={imageDataUrl}
        onChange={(image) => {
          setImageDataUrl(image?.dataUrl)
          setImageMimeType(image?.mimeType)
        }}
      />
      <AudioRecorder
        audioDataUrl={audioDataUrl}
        onChange={(audio) => {
          setAudioDataUrl(audio?.dataUrl)
          setAudioMimeType(audio?.mimeType)
          setAudioDurationMs(audio?.durationMs)
        }}
      />
      <Field label={t('tags')} value={tags} onChange={setTags} placeholder="alltag, idee, buch" />
      <EntryTypeControl value={draftEntryType} onChange={setDraftEntryType} />
      <SignalStrengthControl value={signalStrength ?? 'normal'} onChange={setSignalStrength} />
      <label className="grid gap-2">
        <span className="text-sm text-graphite">{t('note')}</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          className="min-h-28 rounded-md border border-line bg-white/50 p-3"
        />
      </label>
      <details className="rounded-md border border-line bg-white/30 p-4">
        <summary className="cursor-pointer font-serif text-xl sm:text-2xl">{t('details')}</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {books.length > 0 && (
            <label className="grid gap-2 sm:col-span-2">
              <span className="text-sm text-graphite">{t('book')}</span>
              <select
                value={bookId}
                onChange={(event) => handleBookChange(event.target.value)}
                className="rounded-md border border-line bg-white/50 px-3 py-3"
              >
                <option value="">{t('noBookOption')}</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.author ? `${book.title} — ${book.author}` : book.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Field label={t('author')} value={author} onChange={setAuthor} />
          <Field label={t('work')} value={work} onChange={setWork} />
          <Field label={t('source')} value={source} onChange={setSource} />
          <Field label={t('year')} value={year} onChange={setYear} />
          <label className="grid gap-2">
            <span className="text-sm text-graphite">{t('occurredAt')}</span>
            <input
              value={occurredAt}
              type="datetime-local"
              onChange={(event) => setOccurredAt(event.target.value)}
              className="rounded-md border border-line bg-white/50 px-3 py-3"
            />
          </label>
          <Field label={t('people')} value={people} onChange={setPeople} placeholder={t('peoplePlaceholder')} />
          <div className="sm:col-span-2">
            <LocationCapture
              value={{ locationName, locationLatitude, locationLongitude }}
              onChange={(location) => {
                setLocationName(location.locationName)
                setLocationLatitude(location.locationLatitude)
                setLocationLongitude(location.locationLongitude)
              }}
            />
          </div>
          <label className="grid gap-2 sm:col-span-2">
            <span className="text-sm text-graphite">{t('entryStatus')}</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as QuoteInput['status'])}
              className="rounded-md border border-line bg-white/50 px-3 py-3"
            >
              <option value="signal">{t('entryStatus_signal')}</option>
              <option value="inbox">{t('entryStatus_inbox')}</option>
            </select>
          </label>
        </div>
      </details>
      <label className="flex items-center gap-3 text-sm text-graphite">
        <input type="checkbox" checked={favorite} onChange={(event) => setFavorite(event.target.checked)} />
        {t('favorite')}
      </label>
      <button disabled={saving || !canSave} className="w-full rounded-md bg-ink px-5 py-3 text-sm text-paper disabled:opacity-50 sm:w-fit">
        {saving ? t('saving') : submitLabel}
      </button>
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm text-graphite">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-line bg-white/50 px-3 py-3"
      />
    </label>
  )
}

function clean(value?: string) {
  const trimmed = value?.trim() ?? ''
  return trimmed.length ? trimmed : undefined
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function toLocalDateTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function fromLocalDateTime(value: string) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}
