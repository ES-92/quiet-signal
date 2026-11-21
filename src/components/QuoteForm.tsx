import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { useBookStore } from '../store/useBookStore'
import { bookKey } from '../types/book'
import { entryType, type EntryType, type Quote, type QuoteInput, type SignalStrength } from '../types/quote'
import { AudioRecorder } from './AudioRecorder'
import { EntryTypeControl } from './EntryTypeControl'
import { LocationCapture } from './LocationCapture'
import { PhotoCapture } from './PhotoCapture'
import { SignalStrengthControl } from './SignalStrengthControl'

// Creating submits every field; editing submits only the fields the user changed, so edits never overwrite changes made elsewhere on the page.
type QuoteFormProps = {
  submitLabel: string
  defaultStatus?: QuoteInput['status']
} & (
  | { quote?: undefined; onSubmit: (input: QuoteInput) => Promise<void> }
  | { quote: Quote; onSubmit: (changes: Partial<QuoteInput>) => Promise<void> }
)

interface FormValues {
  text: string
  author: string
  work: string
  source: string
  year: string
  bookId: string
  tags: string
  note: string
  audioDataUrl?: string
  audioMimeType?: string
  audioDurationMs?: number
  imageDataUrl?: string
  imageMimeType?: string
  favorite: boolean
  status: QuoteInput['status']
  signalStrength: SignalStrength
  entryType: EntryType
  occurredAt: string
  people: string
  locationName?: string
  locationLatitude?: number
  locationLongitude?: number
}

function toFormValues(quote: Quote | undefined, defaultStatus: QuoteInput['status']): FormValues {
  return {
    text: quote?.text ?? '',
    author: quote?.author ?? '',
    work: quote?.work ?? '',
    source: quote?.source ?? '',
    year: quote?.year ?? '',
    bookId: quote?.bookId ?? '',
    tags: quote?.tags.join(', ') ?? '',
    note: quote?.note ?? '',
    audioDataUrl: quote?.audioDataUrl,
    audioMimeType: quote?.audioMimeType,
    audioDurationMs: quote?.audioDurationMs,
    imageDataUrl: quote?.imageDataUrl,
    imageMimeType: quote?.imageMimeType,
    favorite: quote?.favorite ?? false,
    status: quote?.status ?? defaultStatus,
    signalStrength: quote?.signalStrength ?? 'normal',
    entryType: quote ? entryType(quote) : 'note',
    occurredAt: toLocalDateTime(quote?.occurredAt),
    people: quote?.people?.join(', ') ?? '',
    locationName: quote?.locationName,
    locationLatitude: quote?.locationLatitude,
    locationLongitude: quote?.locationLongitude
  }
}

export function QuoteForm({ quote, onSubmit, submitLabel, defaultStatus = 'signal' }: QuoteFormProps) {
  const { t } = useI18n()
  const { books, loadBooks } = useBookStore()
  // Values the form started from (kept in step with status/note/favorite, which can change elsewhere on the page).
  const [initial, setInitial] = useState(() => toFormValues(quote, defaultStatus))
  const [text, setText] = useState(initial.text)
  const [author, setAuthor] = useState(initial.author)
  const [work, setWork] = useState(initial.work)
  const [source, setSource] = useState(initial.source)
  const [year, setYear] = useState(initial.year)
  const [bookId, setBookId] = useState(initial.bookId)
  const [tags, setTags] = useState(initial.tags)
  const [note, setNote] = useState(initial.note)
  const [audioDataUrl, setAudioDataUrl] = useState(initial.audioDataUrl)
  const [audioMimeType, setAudioMimeType] = useState(initial.audioMimeType)
  const [audioDurationMs, setAudioDurationMs] = useState(initial.audioDurationMs)
  const [imageDataUrl, setImageDataUrl] = useState(initial.imageDataUrl)
  const [imageMimeType, setImageMimeType] = useState(initial.imageMimeType)
  const [favorite, setFavorite] = useState(initial.favorite)
  const [status, setStatus] = useState(initial.status)
  const [signalStrength, setSignalStrength] = useState(initial.signalStrength)
  const [draftEntryType, setDraftEntryType] = useState(initial.entryType)
  const [occurredAt, setOccurredAt] = useState(initial.occurredAt)
  const [people, setPeople] = useState(initial.people)
  const [locationName, setLocationName] = useState(initial.locationName)
  const [locationLatitude, setLocationLatitude] = useState(initial.locationLatitude)
  const [locationLongitude, setLocationLongitude] = useState(initial.locationLongitude)
  const [saving, setSaving] = useState(false)
  const canSave = Boolean(text.trim() || audioDataUrl || imageDataUrl)

  // Status, note and favorite are also changed by actions beside the form (wake, adopt as thought, favorite); follow them (adjusting state while rendering).
  if (quote) {
    const latest = toFormValues(quote, defaultStatus)
    if (latest.status !== initial.status || latest.note !== initial.note || latest.favorite !== initial.favorite) {
      setInitial({ ...initial, status: latest.status, note: latest.note, favorite: latest.favorite })
      setStatus(latest.status)
      setNote(latest.note)
      setFavorite(latest.favorite)
    }
  }

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
    const input: QuoteInput = {
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
    }
    if (quote) {
      const current: FormValues = {
        text, author, work, source, year, bookId, tags, note, audioDataUrl, audioMimeType, audioDurationMs, imageDataUrl,
        imageMimeType, favorite, status, signalStrength, entryType: draftEntryType, occurredAt, people, locationName,
        locationLatitude, locationLongitude
      }
      await onSubmit(changedFields(input, current, initial))
    } else {
      await onSubmit(input)
    }
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
              <option value="inbox">{t('entryStatus_inbox')}</option>
              <option value="signal">{t('entryStatus_signal')}</option>
              <option value="rest">{t('entryStatus_rest')}</option>
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

// Which form values feed each input field; a field is submitted only if one of them differs from the initial values.
const fieldSources: Partial<Record<keyof QuoteInput, (keyof FormValues)[]>> = {
  text: ['text'],
  author: ['author'],
  work: ['work'],
  source: ['source'],
  year: ['year'],
  tags: ['tags'],
  note: ['note'],
  audioDataUrl: ['audioDataUrl'],
  audioMimeType: ['audioMimeType'],
  audioDurationMs: ['audioDurationMs'],
  imageDataUrl: ['imageDataUrl'],
  imageMimeType: ['imageMimeType'],
  favorite: ['favorite'],
  status: ['status'],
  signalStrength: ['signalStrength'],
  entryType: ['entryType'],
  occurredAt: ['occurredAt'],
  people: ['people'],
  locationName: ['locationName'],
  locationLatitude: ['locationLatitude'],
  locationLongitude: ['locationLongitude']
}

function changedFields(input: QuoteInput, current: FormValues, initial: FormValues): Partial<QuoteInput> {
  const changes: Partial<QuoteInput> = {}
  for (const key of Object.keys(input) as (keyof QuoteInput)[]) {
    // The book link is resolved at submit time (it can follow work/author), so compare the resolved value.
    if (key === 'bookId') {
      if ((input.bookId ?? '') !== initial.bookId) changes.bookId = input.bookId
    } else if (fieldSources[key]?.some((source) => current[source] !== initial[source])) {
      Object.assign(changes, { [key]: input[key] })
    }
  }
  return changes
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
