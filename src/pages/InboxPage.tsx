import { ArrowRight, Clock3, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent, type ReactNode } from 'react'
import { AudioPlayer, AudioRecorder } from '../components/AudioRecorder'
import { EntryTypeControl } from '../components/EntryTypeControl'
import { EmptyState } from '../components/EmptyState'
import { LocationCapture } from '../components/LocationCapture'
import { PhotoCapture } from '../components/PhotoCapture'
import { SignalStrengthControl } from '../components/SignalStrengthControl'
import { useI18n } from '../i18n/I18nProvider'
import { openCapture } from '../services/captureEvents'
import { tapHaptic } from '../services/haptics'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { entryType, quoteStatus, type EntryType, type Quote, type SignalStrength } from '../types/quote'

const typeLabels = {
  note: 'entryType_note',
  memory: 'entryType_memory',
  book_quote: 'entryType_book_quote',
  idea: 'entryType_idea',
  conversation: 'entryType_conversation',
  observation: 'entryType_observation'
} as const

const CLARIFY_THRESHOLD = 64
const CLARIFY_DISTANCE = 76
const CLARIFY_VELOCITY = 0.4
const CLARIFY_EXIT_MS = 340

interface ClarifyDrag {
  x: number
  y: number
  active: boolean
}

interface ClarifyPointer {
  pointerId: number
  x: number
  y: number
  lastX: number
  lastY: number
  lastTime: number
  vx: number
  vy: number
}

interface ClarifyExit {
  x: number
  y: number
  rotate: number
  opacity: number
}

export function InboxPage() {
  const { t } = useI18n()
  const { quotes, loadQuotes, addQuote, saveQuote, removeQuote } = useQuoteStore()
  const { books, loadBooks } = useBookStore()
  const [text, setText] = useState('')
  const [tags, setTags] = useState('')
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>()
  const [imageMimeType, setImageMimeType] = useState<string | undefined>()
  const [audioDataUrl, setAudioDataUrl] = useState<string | undefined>()
  const [audioMimeType, setAudioMimeType] = useState<string | undefined>()
  const [audioDurationMs, setAudioDurationMs] = useState<number | undefined>()
  const [signalStrength, setSignalStrength] = useState<SignalStrength>('quiet')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [draftText, setDraftText] = useState('')
  const [draftTags, setDraftTags] = useState('')
  const [draftNote, setDraftNote] = useState('')
  const [draftEntryType, setDraftEntryType] = useState<EntryType>('note')
  const [draftStrength, setDraftStrength] = useState<SignalStrength>('normal')
  const [draftAuthor, setDraftAuthor] = useState('')
  const [draftWork, setDraftWork] = useState('')
  const [draftSource, setDraftSource] = useState('')
  const [draftYear, setDraftYear] = useState('')
  const [draftBookId, setDraftBookId] = useState('')
  const [draftOccurredAt, setDraftOccurredAt] = useState('')
  const [draftPeople, setDraftPeople] = useState('')
  const [draftLocationName, setDraftLocationName] = useState<string | undefined>()
  const [draftLocationLatitude, setDraftLocationLatitude] = useState<number | undefined>()
  const [draftLocationLongitude, setDraftLocationLongitude] = useState<number | undefined>()
  const [message, setMessage] = useState('')
  const [clarifyDrag, setClarifyDrag] = useState<ClarifyDrag>({ x: 0, y: 0, active: false })
  const [clarifyExit, setClarifyExit] = useState<ClarifyExit | null>(null)
  const clarifyPointerRef = useRef<ClarifyPointer | null>(null)
  const clarifyThresholdHapticRef = useRef(false)
  const canSave = Boolean(text.trim() || imageDataUrl || audioDataUrl)

  useEffect(() => {
    void loadQuotes()
    void loadBooks()
  }, [loadQuotes, loadBooks])

  const inboxQuotes = useMemo(() => quotes.filter((quote) => quoteStatus(quote) === 'inbox'), [quotes])
  const currentQuote = inboxQuotes[currentIndex] ?? inboxQuotes[0]
  const nextInboxQuote = inboxQuotes.length > 1 ? inboxQuotes[(currentIndex + 1) % inboxQuotes.length] : undefined
  const thirdInboxQuote = inboxQuotes.length > 2 ? inboxQuotes[(currentIndex + 2) % inboxQuotes.length] : undefined

  useEffect(() => {
    if (currentIndex >= inboxQuotes.length) setCurrentIndex(Math.max(0, inboxQuotes.length - 1))
  }, [currentIndex, inboxQuotes.length])

  useEffect(() => {
    if (!currentQuote) return
    setDetailsOpen(false)
    setClarifyDrag({ x: 0, y: 0, active: false })
    setClarifyExit(null)
    clarifyThresholdHapticRef.current = false
    setDraftText(currentQuote.text ?? '')
    setDraftTags(currentQuote.tags.join(', '))
    setDraftNote(currentQuote.note ?? '')
    setDraftEntryType(entryType(currentQuote))
    setDraftStrength(currentQuote.signalStrength ?? 'normal')
    setDraftAuthor(currentQuote.author ?? '')
    setDraftWork(currentQuote.work ?? '')
    setDraftSource(currentQuote.source ?? '')
    setDraftYear(currentQuote.year ?? '')
    setDraftBookId(currentQuote.bookId ?? '')
    setDraftOccurredAt(toLocalDateTime(currentQuote.occurredAt))
    setDraftPeople((currentQuote.people ?? []).join(', '))
    setDraftLocationName(currentQuote.locationName)
    setDraftLocationLatitude(currentQuote.locationLatitude)
    setDraftLocationLongitude(currentQuote.locationLongitude)
  }, [currentQuote?.id])

  async function handleCapture(event: FormEvent) {
    event.preventDefault()
    if (!canSave) return
    await addQuote({
      text: text.trim(),
      tags: splitList(tags),
      note: undefined,
      favorite: false,
      status: 'inbox',
      signalStrength,
      entryType: 'note',
      people: [],
      audioDataUrl,
      audioMimeType,
      audioDurationMs,
      imageDataUrl,
      imageMimeType
    })
    setText('')
    setTags('')
    setImageDataUrl(undefined)
    setImageMimeType(undefined)
    setAudioDataUrl(undefined)
    setAudioMimeType(undefined)
    setAudioDurationMs(undefined)
    setSignalStrength('quiet')
    setMessage(t('noiseSaved'))
  }

  function handleBookChange(id: string) {
    setDraftBookId(id)
    const book = books.find((item) => item.id === id)
    if (book) {
      setDraftWork(book.title)
      if (book.author) setDraftAuthor(book.author)
    }
  }

  function buildPatch(status: Quote['status'], strength = draftStrength): Partial<Quote> {
    return {
      text: draftText.trim(),
      tags: splitList(draftTags).map((tag) => tag.toLowerCase()),
      note: clean(draftNote),
      status,
      signalStrength: strength,
      entryType: draftEntryType,
      author: clean(draftAuthor),
      work: clean(draftWork),
      source: clean(draftSource),
      year: clean(draftYear),
      bookId: clean(draftBookId),
      occurredAt: fromLocalDateTime(draftOccurredAt),
      people: splitList(draftPeople),
      locationName: clean(draftLocationName),
      locationLatitude: draftLocationLatitude,
      locationLongitude: draftLocationLongitude,
      nextReviewAt: status === 'signal' ? undefined : currentQuote?.nextReviewAt
    }
  }

  async function finishSignal(strength = draftStrength) {
    if (!currentQuote) return
    await saveQuote(currentQuote.id, buildPatch('signal', strength))
    setMessage(t('movedToSignals'))
  }

  async function saveDetails() {
    if (!currentQuote) return
    await saveQuote(currentQuote.id, buildPatch('inbox'))
    setMessage(t('keptInNoise'))
  }

  function clarifyLater() {
    if (!inboxQuotes.length) return
    setCurrentIndex((index) => (index + 1) % inboxQuotes.length)
    setDetailsOpen(false)
    setMessage('')
  }

  async function discardCurrent() {
    if (!currentQuote) return
    await removeQuote(currentQuote.id)
    setMessage('')
  }

  function handleClarifyPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!currentQuote || clarifyExit || isInteractiveTarget(event.target)) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setMessage('')
    clarifyThresholdHapticRef.current = false
    clarifyPointerRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now(),
      vx: 0,
      vy: 0
    }
    setClarifyDrag({ x: 0, y: 0, active: true })
  }

  function handleClarifyPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = clarifyPointerRef.current
    if (!start || start.pointerId !== event.pointerId) return

    const now = performance.now()
    const elapsed = Math.max(now - start.lastTime, 16)
    const rawDx = event.clientX - start.x
    const rawDy = event.clientY - start.y
    const dx = rubberDistance(rawDx, window.innerWidth * 0.82)
    const dy = rubberDistance(rawDy, window.innerHeight * 0.48)
    const intent = Math.max(Math.abs(rawDx), Math.abs(rawDy))

    if (!clarifyThresholdHapticRef.current && intent > CLARIFY_THRESHOLD) {
      clarifyThresholdHapticRef.current = true
      tapHaptic(6)
    }
    if (clarifyThresholdHapticRef.current && intent < CLARIFY_THRESHOLD * 0.52) {
      clarifyThresholdHapticRef.current = false
    }

    start.vx = (event.clientX - start.lastX) / elapsed
    start.vy = (event.clientY - start.lastY) / elapsed
    start.lastX = event.clientX
    start.lastY = event.clientY
    start.lastTime = now
    setClarifyDrag({ x: dx, y: dy, active: true })
  }

  function handleClarifyPointerUp(event: PointerEvent<HTMLDivElement>) {
    finishClarifyPointer(event)
  }

  function handleClarifyPointerCancel(event: PointerEvent<HTMLDivElement>) {
    finishClarifyPointer(event, true)
  }

  function finishClarifyPointer(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const start = clarifyPointerRef.current
    clarifyThresholdHapticRef.current = false
    clarifyPointerRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture can be released by the browser before cancel events.
    }

    if (!start || start.pointerId !== event.pointerId || cancelled || !currentQuote) {
      resetClarifyGesture()
      return
    }

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    const projectedX = dx + start.vx * 230
    const projectedY = dy + start.vy * 210
    const horizontal = Math.abs(projectedX) >= Math.abs(projectedY) * 0.72
    const vertical = Math.abs(projectedY) > Math.abs(projectedX) * 0.72
    const fastThrow = Math.max(Math.abs(start.vx), Math.abs(start.vy)) > CLARIFY_VELOCITY

    if (horizontal && (Math.abs(projectedX) > CLARIFY_DISTANCE || (fastThrow && Math.abs(dx) > 20))) {
      commitClarify(projectedX > 0 ? 'signal' : 'delete', projectedX, projectedY)
      return
    }

    if (vertical && (Math.abs(projectedY) > CLARIFY_DISTANCE || (fastThrow && Math.abs(dy) > 20))) {
      if (projectedY < 0) {
        tapHaptic(8)
        setDetailsOpen(true)
        resetClarifyGesture()
      } else {
        commitClarify('later', projectedX, projectedY)
      }
      return
    }

    resetClarifyGesture()
  }

  function commitClarify(action: 'signal' | 'delete' | 'later', projectedX: number, projectedY: number) {
    if (!currentQuote) return
    const width = window.innerWidth || 390
    const horizontal = action === 'signal' || action === 'delete'
    const direction = action === 'delete' ? -1 : 1
    const exitX = horizontal ? direction * width * 1.38 : clamp(projectedX, -width * 0.32, width * 0.32)
    const exitY = action === 'later' ? width * 0.82 : clamp(projectedY, -width * 0.4, width * 0.4)
    const rotate = horizontal ? direction * clamp(7 + Math.abs(projectedY) / 26, 7, 17) : clamp(projectedX / 20, -9, 9)

    tapHaptic(action === 'signal' ? [8, 24, 8] : action === 'delete' ? 12 : 8)
    setClarifyExit({ x: exitX, y: exitY, rotate, opacity: action === 'later' ? 0.55 : 0.72 })

    window.setTimeout(() => {
      setClarifyExit(null)
      setClarifyDrag({ x: 0, y: 0, active: false })
      if (action === 'signal') void finishSignal()
      if (action === 'delete') void discardCurrent()
      if (action === 'later') clarifyLater()
    }, CLARIFY_EXIT_MS)
  }

  function resetClarifyGesture() {
    setClarifyDrag({ x: 0, y: 0, active: false })
  }

  const contextDetails = draftEntryType === 'memory' || draftEntryType === 'conversation' || draftEntryType === 'observation'
  const bookDetails = draftEntryType === 'book_quote'
  const clarifyDistance = Math.hypot(clarifyDrag.x, clarifyDrag.y)
  const clarifyLift = clarifyExit ? 1 : Math.min(1, clarifyDistance / 132)
  const signalHint = clamp(clarifyDrag.x / CLARIFY_THRESHOLD, 0, 1)
  const deleteHint = clamp(-clarifyDrag.x / CLARIFY_THRESHOLD, 0, 1)
  const detailsHint = clamp(-clarifyDrag.y / CLARIFY_THRESHOLD, 0, 1)
  const laterHint = clamp(clarifyDrag.y / CLARIFY_THRESHOLD, 0, 1)
  const clarifyTransform = clarifyExit
    ? `translate3d(${clarifyExit.x}px, ${clarifyExit.y}px, 0) rotate(${clarifyExit.rotate}deg) scale(0.95)`
    : `perspective(1000px) translate3d(${clarifyDrag.x}px, ${clarifyDrag.y}px, 0) rotateX(${clamp(-clarifyDrag.y * 0.012, -1.8, 1.8)}deg) rotate(${clarifyDrag.x * 0.012}deg) scale(${1 - Math.min(clarifyDistance / 6200, 0.022)})`

  return (
    <div className="grid gap-5 pt-3 sm:gap-8 sm:pt-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
      <section className="min-w-0">
        <p className="text-sm uppercase tracking-[0.2em] text-graphite">{t('noiseInbox')}</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">{t('noiseInboxTitle')}</h1>
        <p className="mt-4 max-w-xl leading-7 text-graphite">{t('noiseInboxIntro')}</p>
        <button className="mt-5 min-h-[46px] w-full rounded-md bg-ink px-4 py-3 text-sm text-paper shadow-[0_14px_34px_rgba(31,30,28,0.14)] sm:hidden" onClick={() => openCapture('text')}>
          {t('openCapture')}
        </button>

        <form className="classical-panel mt-6 hidden gap-4 rounded-md p-4 sm:grid sm:p-5" onSubmit={(event) => void handleCapture(event)}>
          <p className="font-serif text-2xl">{t('quickCapture')}</p>
          <textarea
            className="min-h-28 rounded-md border border-line bg-white/50 p-4 font-serif text-xl leading-snug"
            placeholder={t('noisePlaceholder')}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
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
          <input
            className="rounded-md border border-line bg-white/50 px-3 py-3"
            placeholder={t('noiseTagsPlaceholder')}
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
          <SignalStrengthControl value={signalStrength} onChange={setSignalStrength} />
          <button disabled={!canSave} className="rounded-md bg-ink px-4 py-3 text-sm text-paper disabled:opacity-50">
            {t('captureNoise')}
          </button>
        </form>
      </section>

      <section className="min-w-0 lg:sticky lg:top-8 lg:self-start">
        {message && <p className="mb-4 rounded-md border border-line bg-paper/80 px-4 py-3 text-sm text-moss">{message}</p>}
        <div className="quiet-sheet classical-panel overflow-hidden rounded-md">
          <div className="border-b border-line p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-graphite">{t('signalProcessing')}</p>
                <h2 className="mt-1 font-serif text-3xl">{t('clarifyStack')}</h2>
              </div>
              {inboxQuotes.length > 0 && (
                <span className="shrink-0 rounded border border-line px-2 py-1 text-xs text-graphite">
                  {t('cardProgress', { current: Math.min(currentIndex + 1, inboxQuotes.length), total: inboxQuotes.length })}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm leading-6 text-graphite">{t('clarifyIntro')}</p>
          </div>

          {currentQuote ? (
            <div className="grid gap-4 p-4 sm:p-5">
              <div className="relative min-h-[19rem] overflow-hidden px-1 py-2" style={{ perspective: '1100px' }}>
                {thirdInboxQuote && <ClarifyPreviewCard quote={thirdInboxQuote} depth={2} lift={clarifyLift} />}
                {nextInboxQuote && <ClarifyPreviewCard quote={nextInboxQuote} depth={1} lift={clarifyLift} />}
                <article
                  className="clarify-top-card relative z-20 touch-none select-none overflow-hidden rounded-md border border-line bg-paper p-4 shadow-[0_22px_62px_rgba(31,30,28,0.14)] will-change-transform"
                  onPointerDown={handleClarifyPointerDown}
                  onPointerMove={handleClarifyPointerMove}
                  onPointerUp={handleClarifyPointerUp}
                  onPointerCancel={handleClarifyPointerCancel}
                  style={{
                    opacity: clarifyExit ? clarifyExit.opacity : 1,
                    transform: clarifyTransform,
                    transition: clarifyExit
                      ? `opacity ${CLARIFY_EXIT_MS}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${CLARIFY_EXIT_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
                      : clarifyDrag.active
                        ? 'none'
                        : 'transform 420ms cubic-bezier(0.18, 1.22, 0.22, 1), box-shadow 280ms cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  <GestureStamp className="right-3 top-16 border-clay text-clay" opacity={signalHint} rotate={5} x={12}>
                    <ArrowRight size={15} /> {t('finishSignal')}
                  </GestureStamp>
                  <GestureStamp className="left-3 top-16 border-clay text-clay" opacity={deleteHint} rotate={-5} x={-12}>
                    <Trash2 size={15} /> {t('deleteNoise')}
                  </GestureStamp>
                  <GestureStamp className="left-1/2 top-3 -translate-x-1/2 border-graphite text-graphite" opacity={detailsHint} rotate={0} y={-10}>
                    <SlidersHorizontal size={15} /> {t('detailsAction')}
                  </GestureStamp>
                  <GestureStamp className="bottom-3 left-1/2 -translate-x-1/2 border-graphite text-graphite" opacity={laterHint} rotate={0} y={10}>
                    <Clock3 size={15} /> {t('clarifyLater')}
                  </GestureStamp>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded border border-line px-2 py-1 text-xs text-graphite">{t('entryStatus_inbox')}</span>
                    <span className="rounded border border-clay/60 px-2 py-1 text-xs text-clay">{t(typeLabels[entryType(currentQuote)])}</span>
                  </div>
                  {currentQuote.imageDataUrl && <img className="mt-4 max-h-56 w-full rounded-md border border-line object-cover" src={currentQuote.imageDataUrl} alt={t('photoNote')} />}
                  {currentQuote.text ? (
                    <blockquote className="mt-4 break-words font-serif text-2xl leading-tight sm:text-4xl">"{currentQuote.text}"</blockquote>
                  ) : (
                    <p className="mt-4 break-words font-serif text-2xl leading-tight sm:text-4xl">
                      {currentQuote.imageDataUrl ? t('untitledPhotoNote') : t('untitledVoiceNote')}
                    </p>
                  )}
                  {currentQuote.audioDataUrl && (
                    <div className="mt-4">
                      <AudioPlayer src={currentQuote.audioDataUrl} compact />
                    </div>
                  )}
                  {currentQuote.note && <p className="mt-4 text-sm leading-6 text-graphite">{currentQuote.note}</p>}
                </article>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <button className="quiet-touch inline-flex h-11 items-center justify-center rounded-full bg-ink text-paper shadow-[0_12px_28px_rgba(31,30,28,0.14)]" aria-label={t('finishSignal')} title={t('finishSignal')} onClick={() => void finishSignal()}>
                  <ArrowRight size={16} />
                </button>
                <button className="quiet-touch inline-flex h-11 items-center justify-center rounded-full border border-line text-graphite" aria-label={t('detailsAction')} title={t('detailsAction')} onClick={() => setDetailsOpen((open) => !open)}>
                  <SlidersHorizontal size={16} />
                </button>
                <button className="quiet-touch inline-flex h-11 items-center justify-center rounded-full border border-line text-graphite" aria-label={t('clarifyLater')} title={t('clarifyLater')} onClick={clarifyLater}>
                  <Clock3 size={16} />
                </button>
                <button className="quiet-touch inline-flex h-11 items-center justify-center rounded-full border border-clay text-clay" aria-label={t('deleteNoise')} title={t('deleteNoise')} onClick={() => void discardCurrent()}>
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="text-center text-xs leading-5 text-graphite">{t('clarifyGestureHint')}</p>

              {detailsOpen && (
                <div className="quiet-pop grid gap-4 rounded-md border border-line bg-white/30 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-graphite">{t('signalDraft')}</p>
                    <h3 className="mt-1 font-serif text-2xl">{t('signalDraftTitle')}</h3>
                  </div>
                  <EntryTypeControl value={draftEntryType} onChange={setDraftEntryType} />
                  <SignalStrengthControl value={draftStrength} onChange={setDraftStrength} />
                  <label className="grid gap-2">
                    <span className="text-sm text-graphite">{t('text')}</span>
                    <textarea
                      className="min-h-28 rounded-md border border-line bg-white/50 p-4 font-serif text-xl leading-snug"
                      value={draftText}
                      onChange={(event) => setDraftText(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-graphite">{t('note')}</span>
                    <textarea className="min-h-24 rounded-md border border-line bg-white/50 p-3" value={draftNote} onChange={(event) => setDraftNote(event.target.value)} />
                  </label>

                  {bookDetails && (
                    <div className="grid gap-3 rounded-md border border-line bg-paper/60 p-3 sm:grid-cols-2">
                      <p className="font-serif text-xl sm:col-span-2">{t('bookDetails')}</p>
                      {books.length > 0 && (
                        <label className="grid gap-2 sm:col-span-2">
                          <span className="text-sm text-graphite">{t('book')}</span>
                          <select className="rounded-md border border-line bg-white/50 px-3 py-3" value={draftBookId} onChange={(event) => handleBookChange(event.target.value)}>
                            <option value="">{t('noBookOption')}</option>
                            {books.map((book) => (
                              <option key={book.id} value={book.id}>
                                {book.author ? `${book.title} - ${book.author}` : book.title}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <Field label={t('author')} value={draftAuthor} onChange={setDraftAuthor} />
                      <Field label={t('work')} value={draftWork} onChange={setDraftWork} />
                      <Field label={t('source')} value={draftSource} onChange={setDraftSource} />
                      <Field label={t('year')} value={draftYear} onChange={setDraftYear} />
                    </div>
                  )}

                  {(contextDetails || !bookDetails) && (
                    <div className="grid gap-3 rounded-md border border-line bg-paper/60 p-3">
                      <p className="font-serif text-xl">{t('contextDetails')}</p>
                      <label className="grid gap-2">
                        <span className="text-sm text-graphite">{t('occurredAt')}</span>
                        <input className="rounded-md border border-line bg-white/50 px-3 py-3" type="datetime-local" value={draftOccurredAt} onChange={(event) => setDraftOccurredAt(event.target.value)} />
                      </label>
                      <Field label={t('people')} value={draftPeople} onChange={setDraftPeople} placeholder={t('peoplePlaceholder')} />
                      <LocationCapture
                        value={{ locationName: draftLocationName, locationLatitude: draftLocationLatitude, locationLongitude: draftLocationLongitude }}
                        onChange={(location) => {
                          setDraftLocationName(location.locationName)
                          setDraftLocationLatitude(location.locationLatitude)
                          setDraftLocationLongitude(location.locationLongitude)
                        }}
                      />
                    </div>
                  )}

                  <Field label={t('tags')} value={draftTags} onChange={setDraftTags} placeholder={t('noiseTagsPlaceholder')} />
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" className="min-h-[46px] rounded-md border border-line px-3 py-2 text-sm text-graphite" onClick={() => void saveDetails()}>
                      {t('saveDetails')}
                    </button>
                    <button type="button" className="min-h-[46px] rounded-md bg-ink px-3 py-2 text-sm text-paper" onClick={() => void finishSignal()}>
                      {t('finishSignal')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 sm:p-5">
              <EmptyState title={t('inboxEmptyTitle')}>{t('inboxEmptyBody')}</EmptyState>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function GestureStamp({
  className,
  opacity,
  rotate = 0,
  x = 0,
  y = 0,
  children
}: {
  className: string
  opacity: number
  rotate?: number
  x?: number
  y?: number
  children: ReactNode
}) {
  return (
    <div
      className={[
        'pointer-events-none absolute z-10 inline-flex items-center gap-1.5 rounded-full border-2 bg-paper/86 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] shadow-[0_12px_30px_rgba(31,30,28,0.1)] backdrop-blur transition-opacity',
        className
      ].join(' ')}
      style={
        {
          opacity,
          translate: `${x * (1 - opacity)}px ${y * (1 - opacity)}px`,
          rotate: `${rotate * opacity}deg`,
          scale: `${0.94 + opacity * 0.06}`
        } as CSSProperties
      }
    >
      {children}
    </div>
  )
}

function ClarifyPreviewCard({ quote, depth, lift }: { quote: Quote; depth: 1 | 2; lift: number }) {
  const { t } = useI18n()
  const y = depth === 1 ? lerp(18, 2, lift) : lerp(34, 16, lift)
  const scale = depth === 1 ? lerp(0.946, 0.982, lift) : lerp(0.902, 0.948, lift)
  const opacity = depth === 1 ? lerp(0.76, 0.92, lift) : lerp(0.44, 0.64, lift)
  const rotate = depth === 1 ? lerp(-0.6, 0.1, lift) : lerp(0.8, -0.2, lift)

  return (
    <article
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-4 top-7 z-10 min-h-[16.5rem] overflow-hidden rounded-md border border-line bg-paper/80 p-4 shadow-[0_18px_46px_rgba(31,30,28,0.08)] will-change-transform"
      style={{
        opacity,
        transform: `translate3d(0, ${y}px, 0) rotate(${rotate}deg) scale(${scale})`,
        transition: 'opacity 220ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div className="flex flex-wrap gap-2">
        <span className="rounded border border-line px-2 py-1 text-xs text-graphite">{t('entryStatus_inbox')}</span>
      </div>
      <p className="mt-5 line-clamp-4 break-words font-serif text-2xl leading-tight text-ink">
        {quote.text ? `"${quote.text}"` : quote.imageDataUrl ? t('untitledPhotoNote') : t('untitledVoiceNote')}
      </p>
    </article>
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
      <input className="rounded-md border border-line bg-white/50 px-3 py-3" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function clean(value?: string) {
  const trimmed = value?.trim() ?? ''
  return trimmed.length ? trimmed : undefined
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function rubberDistance(distance: number, dimension: number) {
  const sign = Math.sign(distance)
  const absolute = Math.abs(distance)
  return sign * ((absolute * dimension) / (dimension + absolute * 0.62))
}

function isInteractiveTarget(target: EventTarget) {
  return target instanceof HTMLElement && Boolean(target.closest('button, a, input, select, textarea, audio, summary'))
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
