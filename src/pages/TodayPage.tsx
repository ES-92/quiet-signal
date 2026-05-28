import { BookOpen, Camera, Clock3, ExternalLink, Feather, Flame, Heart, Inbox, Mic, Minus, PenLine, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AudioPlayer } from '../components/AudioRecorder'
import { PhotoPreview } from '../components/PhotoCapture'
import { useFitText } from '../hooks/useFitText'
import { useSwipeDeck } from '../hooks/useSwipeDeck'
import { useI18n } from '../i18n/I18nProvider'
import { openCapture } from '../services/captureEvents'
import { tapHaptic } from '../services/haptics'
import { buildReflection } from '../services/reflections'
import { selectDailyStack, type BookWeightMap } from '../services/review'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { useToastStore } from '../store/useToastStore'
import { quoteStatus } from '../types/quote'

const EXIT_MS = 620

export function TodayPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { quotes, loading, loadQuotes, saveQuote, likeQuote, dislikeQuote, reviewQuote, snoozeQuote, discardQuote, restoreQuote } = useQuoteStore()
  const { showToast } = useToastStore()
  const { books, loadBooks, saveBook } = useBookStore()
  const { dailyCount, dailyMode } = useSettingsStore()
  const [index, setIndex] = useState(0)
  const [contextOpen, setContextOpen] = useState(false)
  const [bookEditorOpen, setBookEditorOpen] = useState(false)
  const [bookTitle, setBookTitle] = useState('')
  const [bookAuthor, setBookAuthor] = useState('')
  const [sessionQuoteIds, setSessionQuoteIds] = useState<string[]>([])

  useEffect(() => {
    void loadQuotes()
    void loadBooks()
  }, [loadQuotes, loadBooks])

  const bookWeights = useMemo<BookWeightMap>(
    () => Object.fromEntries(books.map((book) => [book.id, book.weight])),
    [books]
  )

  const selectedDailyQuotes = useMemo(
    () => selectDailyStack(quotes, { limit: dailyCount, mode: dailyMode, bookWeights }),
    [bookWeights, dailyCount, dailyMode, quotes]
  )
  const dailyQuotes = useMemo(() => {
    if (sessionQuoteIds.length === 0) return selectedDailyQuotes
    const quoteById = new Map(quotes.map((quote) => [quote.id, quote]))
    return sessionQuoteIds.map((id) => quoteById.get(id)).filter(Boolean)
  }, [quotes, selectedDailyQuotes, sessionQuoteIds])
  const weeklyReflection = useMemo(() => buildReflection(quotes, books, 'week'), [books, quotes])
  const showReflectionNudge = weeklyReflection.entries.length >= 3
  const inboxCount = useMemo(() => quotes.filter((quote) => quoteStatus(quote) === 'inbox' && !quote.deletedAt).length, [quotes])

  const currentIndex = Math.min(index, dailyQuotes.length)
  const currentQuote = dailyQuotes[currentIndex]
  const nextQuote = dailyQuotes[currentIndex + 1]
  const thirdQuote = dailyQuotes[currentIndex + 2]
  const stackCompleted = dailyQuotes.length > 0 && !currentQuote
  const currentBook = currentQuote?.bookId ? books.find((book) => book.id === currentQuote.bookId) : undefined
  // Shrink long quotes to fit the card instead of clipping them.
  const { containerRef, textRef } = useFitText(currentQuote?.id ?? '')

  useEffect(() => {
    setContextOpen(false)
    setBookEditorOpen(false)
  }, [currentQuote?.id])

  useEffect(() => {
    const selectedIds = selectedDailyQuotes.map((quote) => quote.id)
    setSessionQuoteIds((currentIds) => {
      const existingIds = new Set(quotes.map((quote) => quote.id))
      if (selectedIds.length === 0) {
        const retainedIds = currentIds.filter((id) => existingIds.has(id))
        return sameIds(retainedIds, currentIds) ? currentIds : retainedIds
      }
      if (currentIds.length === 0) return selectedIds
      const retainedIds = currentIds.filter((id) => existingIds.has(id))
      if (retainedIds.length === 0) return selectedIds
      return sameIds(retainedIds, currentIds) ? currentIds : retainedIds
    })
  }, [quotes, selectedDailyQuotes])

  useEffect(() => {
    if (index > dailyQuotes.length) {
      setIndex(dailyQuotes.length)
    }
  }, [dailyQuotes.length, index])

  function advanceIndex() {
    setIndex((value) => Math.min(value + 1, dailyQuotes.length))
  }

  function handleKeep() {
    if (!currentQuote) return
    const id = currentQuote.id
    void likeQuote(id)
    void reviewQuote(id, 'read')
    advanceIndex()
  }

  function handleSnooze() {
    if (!currentQuote) return
    void snoozeQuote(currentQuote.id)
    advanceIndex()
  }

  function handleDiscard() {
    if (!currentQuote) return
    const id = currentQuote.id
    void discardQuote(id)
    showToast({ message: t('discardedToast'), actionLabel: t('undo'), onAction: () => void restoreQuote(id) })
    advanceIndex()
  }

  const deck = useSwipeDeck(
    {
      right: handleKeep,
      left: handleSnooze,
      down: handleDiscard,
      up: () => setContextOpen(true),
      longPress: () => setContextOpen(true)
    },
    { enabled: Boolean(currentQuote) && !contextOpen, distance: 76, exitMs: 620 }
  )

  async function handleFavoriteToggle() {
    if (!currentQuote) return
    tapHaptic(10)
    await saveQuote(currentQuote.id, { favorite: !currentQuote.favorite })
    setContextOpen(false)
  }

  function handleContextSnooze() {
    if (!currentQuote) return
    const id = currentQuote.id
    setContextOpen(false)
    void snoozeQuote(id)
    advanceIndex()
  }

  function handleDislike() {
    if (!currentQuote) return
    void dislikeQuote(currentQuote.id)
    setContextOpen(false)
  }

  function handleOpenDetails() {
    if (!currentQuote) return
    tapHaptic(8)
    navigate(`/quote/${currentQuote.id}`)
  }

  function openBookEditor() {
    if (!currentBook) return
    tapHaptic(8)
    setBookTitle(currentBook.title)
    setBookAuthor(currentBook.author ?? '')
    setBookEditorOpen(true)
    setContextOpen(false)
  }

  async function handleSaveBook() {
    if (!currentBook || !bookTitle.trim()) return
    tapHaptic([8, 28, 8])
    await saveBook(currentBook.id, {
      title: bookTitle.trim(),
      author: bookAuthor.trim() || undefined
    })
    setBookEditorOpen(false)
  }

  const likeHint = deck.hints.right
  const dislikeHint = deck.hints.left
  const deckLift = deck.exit ? 1 : Math.min(1, Math.hypot(deck.drag.x, deck.drag.y) / 140 + deck.hints.right * 0.6)
  const topTransform = deck.exit
    ? `perspective(1100px) translate3d(${deck.exit.x}px, ${deck.exit.y}px, 0) rotate(${deck.exit.rotate}deg) scale(0.955)`
    : `perspective(1100px) translate3d(${deck.drag.x}px, ${deck.drag.y}px, 0) rotate(${deck.drag.x * 0.014 + deck.drag.y * 0.003}deg) scale(${1 - Math.min(Math.hypot(deck.drag.x, deck.drag.y) / 5200, 0.03)})`
  const cardShadow =
    deck.drag.active || deck.exit
      ? '0 36px 96px rgba(31,30,28,0.18), 0 12px 28px rgba(31,30,28,0.08)'
      : '0 26px 78px rgba(31,30,28,0.09), 0 2px 10px rgba(31,30,28,0.04)'
  const todayLabel = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long' }).format(new Date())

  return (
    <div className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden sm:gap-4">
      <section className="flex min-w-0 items-end justify-between gap-4 pt-1 sm:pt-3">
        <div className="min-w-0">
          <p className="text-[0.66rem] uppercase tracking-[0.22em] text-graphite sm:text-xs">{t('today')}</p>
          <h1 className="mt-1 truncate font-serif text-3xl leading-tight sm:text-5xl">{todayLabel}</h1>
        </div>
        {showReflectionNudge ? (
          <button
            type="button"
            className="quiet-touch quiet-fade inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-clay/45 bg-paper/82 px-3 text-clay shadow-[0_14px_36px_rgba(31,30,28,0.08)] backdrop-blur transition duration-200 hover:border-clay hover:bg-white/40 active:scale-[0.98]"
            aria-label={t('openReflections')}
            title={t('reflectionNudge')}
            onClick={() => {
              tapHaptic(8)
              navigate('/reflections')
            }}
          >
            <Feather size={16} />
            <span className="hidden text-xs uppercase tracking-[0.16em] sm:inline">{t('reflectionNudge')}</span>
            <span className="rounded-full bg-clay/10 px-1.5 py-0.5 text-xs tabular-nums">{weeklyReflection.entries.length}</span>
          </button>
        ) : (
          <p className="hidden max-w-44 text-right text-xs leading-5 text-graphite sm:block">{t('swipeDownCapture')}</p>
        )}
      </section>

      {loading ? (
        <div className="flex min-h-0 items-center justify-center rounded-md border border-line bg-white/30 text-graphite">
          {t('loadingLibrary')}
        </div>
      ) : currentQuote ? (
        <section className="flex min-h-0 flex-col gap-4 lg:flex-row">
          <div
            className="relative min-h-0 flex-1 touch-none select-none overflow-hidden px-2 py-2 sm:px-4 sm:py-4"
            style={{ perspective: '1200px' }}
            {...deck.bind}
          >
            {thirdQuote && <DeckPreview quote={thirdQuote} depth={2} lift={deckLift} />}
            {nextQuote && <DeckPreview quote={nextQuote} depth={1} lift={deckLift} />}

            <article
              key={currentQuote.id}
              className={[
                'deck-top-card daily-card-surface absolute inset-x-2 bottom-4 top-0 z-20 flex min-h-0 flex-col overflow-hidden rounded-md border border-line bg-paper p-4 will-change-transform sm:inset-x-4 sm:bottom-6 sm:top-1 sm:p-8',
                deck.drag.active ? 'cursor-grabbing' : 'cursor-grab'
              ].join(' ')}
              style={{
                boxShadow: cardShadow,
                opacity: deck.exit ? 0.72 : 1,
                transform: topTransform,
                transition: deck.exit
                  ? `opacity ${deck.exitMs}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${deck.exitMs}ms cubic-bezier(0.16, 1, 0.3, 1)`
                  : !deck.drag.active && deck.drag.x === 0 && deck.drag.y === 0
                    ? 'box-shadow 360ms cubic-bezier(0.16, 1, 0.3, 1), transform 440ms cubic-bezier(0.18, 1.22, 0.22, 1)'
                    : 'none'
              }}
            >
            <div className="daily-card-texture pointer-events-none absolute inset-0" />
            {/* Swipe stamps */}
            <div
              className="pointer-events-none absolute right-4 top-16 z-10 flex items-center gap-1.5 rounded-full border-2 border-clay bg-paper/80 px-3 py-1 text-sm font-medium uppercase tracking-wide text-clay shadow-[0_12px_34px_rgba(166,95,63,0.12)] backdrop-blur"
              style={{
                opacity: likeHint,
                transform: `translate3d(${lerp(12, 0, likeHint)}px, ${lerp(8, 0, likeHint)}px, 0) rotate(${lerp(6, 0, likeHint)}deg)`
              }}
            >
              <Flame size={16} fill="currentColor" /> {t('like')}
            </div>
            <div
              className="pointer-events-none absolute left-4 top-16 z-10 flex items-center gap-1.5 rounded-full border-2 border-graphite bg-paper/80 px-3 py-1 text-sm font-medium uppercase tracking-wide text-graphite shadow-[0_12px_34px_rgba(31,30,28,0.1)] backdrop-blur"
              style={{
                opacity: dislikeHint,
                transform: `translate3d(${lerp(-12, 0, dislikeHint)}px, ${lerp(8, 0, dislikeHint)}px, 0) rotate(${lerp(-6, 0, dislikeHint)}deg)`
              }}
            >
              <Clock3 size={16} /> {t('later')}
            </div>

            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-clay/50 to-transparent" />
            <div className="flex shrink-0 items-center justify-between gap-3 text-[0.66rem] uppercase tracking-[0.18em] text-graphite sm:text-xs sm:tracking-[0.22em]">
              <span>{t('reviewStack')}</span>
              <span>{t('cardProgress', { current: currentIndex + 1, total: dailyQuotes.length })}</span>
            </div>

            <div
              ref={containerRef}
              className="flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-hidden py-3 sm:gap-5 sm:py-6"
            >
              {currentQuote.imageDataUrl && (
                <div className="mx-auto w-full max-w-2xl shrink-0 overflow-hidden rounded-md">
                  <PhotoPreview
                    src={currentQuote.imageDataUrl}
                    className="max-h-[26dvh] w-full rounded-md border border-line object-cover sm:max-h-[34dvh]"
                  />
                </div>
              )}

              {currentQuote.text ? (
                <blockquote
                  ref={(el) => {
                    textRef.current = el
                  }}
                  className="break-words font-serif leading-[1.12] text-ink"
                >
                  "{currentQuote.text}"
                </blockquote>
              ) : (
                <h2
                  ref={(el) => {
                    textRef.current = el
                  }}
                  className="break-words font-serif leading-[1.12] text-ink"
                >
                  {currentQuote.imageDataUrl ? t('untitledPhotoNote') : t('untitledVoiceNote')}
                </h2>
              )}
            </div>

            <div className="shrink-0 border-t border-line pt-3 sm:pt-5">
              <p className="truncate text-sm text-graphite sm:text-base">
                {[currentQuote.author, currentQuote.work, currentQuote.year].filter(Boolean).join(', ')}
              </p>
              {currentQuote.audioDataUrl && (
                <div className="mt-3">
                  <AudioPlayer src={currentQuote.audioDataUrl} compact />
                </div>
              )}
              {currentQuote.tags.length > 0 && (
                <div className="mt-3 flex max-h-9 flex-wrap gap-2 overflow-hidden sm:max-h-none">
                  {currentQuote.tags.slice(0, 6).map((tag) => (
                    <span key={tag} className="rounded border border-line bg-paper px-2 py-1 text-xs text-graphite">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            </article>
            {contextOpen && currentQuote && (
              <div
                className="quiet-pop absolute inset-x-6 bottom-7 z-30 rounded-md border border-line bg-paper/95 p-2 shadow-[0_22px_70px_rgba(31,30,28,0.18)] backdrop-blur sm:inset-x-auto sm:bottom-10 sm:right-8 sm:w-72"
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 px-2 py-1">
                  <p className="text-xs uppercase tracking-[0.16em] text-graphite">{t('contextActions')}</p>
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-graphite hover:bg-white/50" onClick={() => setContextOpen(false)} aria-label={t('close')}>
                    <X size={16} />
                  </button>
                </div>
                <div className="mt-1 grid gap-1">
                  <button className="flex min-h-[44px] items-center gap-3 rounded-md px-3 text-left text-sm text-ink hover:bg-white/50" onClick={() => void handleFavoriteToggle()}>
                    <Heart size={17} fill={currentQuote.favorite ? 'currentColor' : 'none'} className={currentQuote.favorite ? 'text-clay' : 'text-graphite'} />
                    {t('favorite')}
                  </button>
                  <button className="flex min-h-[44px] items-center gap-3 rounded-md px-3 text-left text-sm text-ink hover:bg-white/50" onClick={handleContextSnooze}>
                    <Clock3 size={17} className="text-graphite" />
                    {t('later')}
                  </button>
                  <button className="flex min-h-[44px] items-center gap-3 rounded-md px-3 text-left text-sm text-ink hover:bg-white/50" onClick={handleDislike}>
                    <Minus size={17} className="text-graphite" />
                    {t('dislike')}
                  </button>
                  <button className="flex min-h-[44px] items-center gap-3 rounded-md px-3 text-left text-sm text-ink hover:bg-white/50" onClick={handleOpenDetails}>
                    <ExternalLink size={17} className="text-graphite" />
                    {t('openDetails')}
                  </button>
                  {currentBook && (
                    <button className="flex min-h-[44px] items-center gap-3 rounded-md px-3 text-left text-sm text-ink hover:bg-white/50" onClick={openBookEditor}>
                      <BookOpen size={17} className="text-graphite" />
                      {t('editBookInline')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      ) : (
        <DailyRestState
          title={stackCompleted ? t('doneForToday') : t('nothingDueToday')}
          body={stackCompleted ? t('doneForTodayBody') : t('nothingDueBody')}
          showReflection={showReflectionNudge}
          onOpenReflections={() => navigate('/reflections')}
          inboxCount={inboxCount}
          onOpenInbox={() => navigate('/inbox')}
        />
      )}
      {bookEditorOpen && currentBook && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/15 p-3 backdrop-blur-[2px] sm:items-center sm:justify-center" onClick={() => setBookEditorOpen(false)}>
          <form
            className="grid w-full gap-3 rounded-md border border-line bg-paper p-4 shadow-[0_24px_80px_rgba(31,30,28,0.2)] sm:max-w-md"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault()
              void handleSaveBook()
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-2xl">{t('editBookInline')}</h2>
              <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-graphite hover:bg-white/50" onClick={() => setBookEditorOpen(false)} aria-label={t('close')}>
                <X size={17} />
              </button>
            </div>
            <label className="grid gap-2 text-sm text-graphite">
              <span>{t('bookTitleLabel')}</span>
              <input className="rounded-md border border-line bg-paper px-3 py-2 text-ink" value={bookTitle} onChange={(event) => setBookTitle(event.target.value)} autoFocus />
            </label>
            <label className="grid gap-2 text-sm text-graphite">
              <span>{t('bookAuthorLabel')}</span>
              <input className="rounded-md border border-line bg-paper px-3 py-2 text-ink" value={bookAuthor} onChange={(event) => setBookAuthor(event.target.value)} />
            </label>
            <div className="grid gap-2 sm:flex sm:justify-end">
              <button type="button" className="rounded-md border border-line px-4 py-2 text-sm text-graphite" onClick={() => setBookEditorOpen(false)}>
                {t('cancel')}
              </button>
              <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm text-paper">
                {t('saveChanges')}
              </button>
            </div>
          </form>
        </div>
      )}
      <footer className="flex shrink-0 justify-center pb-1 sm:hidden" aria-label={t('quickNoise')}>
        <QuickCaptureDock />
      </footer>
    </div>
  )
}

function DailyRestState({
  title,
  body,
  showReflection,
  onOpenReflections,
  inboxCount,
  onOpenInbox
}: {
  title: string
  body: string
  showReflection: boolean
  onOpenReflections: () => void
  inboxCount: number
  onOpenInbox: () => void
}) {
  const { t } = useI18n()

  return (
    <section className="flex min-h-0 items-center justify-center">
      <div className="quiet-fade classical-panel relative grid w-full max-w-2xl gap-5 overflow-hidden rounded-md px-5 py-7 text-center sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute inset-x-10 top-5 h-24 rounded-md border border-line/70 bg-paper/35 opacity-55" />
        <div className="pointer-events-none absolute inset-x-7 top-8 h-24 rounded-md border border-line bg-paper/55 opacity-75" />
        <div className="relative mx-auto flex h-24 w-20 items-center justify-center rounded-md border border-line bg-paper shadow-[0_16px_44px_rgba(31,30,28,0.08)]">
          <Feather className="text-clay" size={22} />
        </div>
        <div className="relative">
          <h2 className="font-serif text-3xl leading-tight sm:text-4xl">{title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-graphite">{body}</p>
        </div>
        {inboxCount > 0 && (
          <button
            type="button"
            className="quiet-touch relative mx-auto inline-flex items-center gap-2 rounded-full border border-clay/45 bg-paper/82 px-4 py-2 text-sm text-clay shadow-[0_14px_36px_rgba(31,30,28,0.08)] backdrop-blur transition active:scale-[0.98]"
            onClick={() => {
              tapHaptic(8)
              onOpenInbox()
            }}
          >
            <Inbox size={16} />
            <span>{t('noiseWaiting')}</span>
            <span className="rounded-full bg-clay/10 px-1.5 py-0.5 text-xs tabular-nums">{inboxCount}</span>
          </button>
        )}
        <div className="relative mx-auto flex max-w-full items-center justify-center gap-2 rounded-full border border-line bg-paper/80 p-1.5 shadow-[0_16px_42px_rgba(31,30,28,0.08)] backdrop-blur">
          <RestAction label={t('text')} onClick={() => openCapture('text')}>
            <PenLine size={17} />
          </RestAction>
          <RestAction label={t('photoNote')} onClick={() => openCapture('photo')}>
            <Camera size={17} />
          </RestAction>
          <RestAction label={t('voiceNote')} onClick={() => openCapture('audio')}>
            <Mic size={17} />
          </RestAction>
          {showReflection && (
            <RestAction label={t('openReflections')} onClick={onOpenReflections} emphasized>
              <Feather size={17} />
            </RestAction>
          )}
        </div>
      </div>
    </section>
  )
}

function RestAction({
  label,
  children,
  onClick,
  emphasized = false
}: {
  label: string
  children: ReactNode
  onClick: () => void
  emphasized?: boolean
}) {
  return (
    <button
      type="button"
      className={[
        'quiet-touch inline-flex h-11 w-11 items-center justify-center rounded-full transition duration-200 active:scale-95',
        emphasized ? 'bg-ink text-paper shadow-[0_10px_24px_rgba(31,30,28,0.14)]' : 'text-graphite hover:bg-white/45 hover:text-ink'
      ].join(' ')}
      aria-label={label}
      title={label}
      onClick={() => {
        tapHaptic(8)
        onClick()
      }}
    >
      {children}
    </button>
  )
}

function QuickCaptureDock() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  function toggle() {
    tapHaptic(open ? 6 : [8, 24, 8])
    setOpen((value) => !value)
  }

  function capture(mode: 'text' | 'photo' | 'audio') {
    tapHaptic(8)
    setOpen(false)
    openCapture(mode)
  }

  return (
    <div className="relative flex flex-col items-center">
      {open && (
        <div
          className="quiet-pop absolute bottom-[4.15rem] left-1/2 z-30 -ml-[5.25rem] flex w-[10.5rem] items-center justify-between rounded-full border border-line bg-paper/92 p-1.5 shadow-[0_18px_46px_rgba(31,30,28,0.14)] backdrop-blur"
          role="group"
          aria-label={t('openCapture')}
        >
          <QuickCaptureModeButton label={t('text')} onClick={() => capture('text')}>
            <PenLine size={18} />
          </QuickCaptureModeButton>
          <QuickCaptureModeButton label={t('photoNote')} onClick={() => capture('photo')}>
            <Camera size={18} />
          </QuickCaptureModeButton>
          <QuickCaptureModeButton label={t('voiceNote')} onClick={() => capture('audio')}>
            <Mic size={18} />
          </QuickCaptureModeButton>
        </div>
      )}
      <button
        type="button"
        className="capture-dock quiet-touch inline-flex h-14 min-w-14 items-center justify-center rounded-full border border-line bg-paper/90 text-ink shadow-[0_18px_46px_rgba(31,30,28,0.14)] backdrop-blur transition duration-200 hover:bg-white/45 active:scale-95"
        aria-label={t('openCapture')}
        aria-expanded={open}
        onClick={toggle}
      >
        <Plus className={['transition duration-200', open ? 'rotate-45' : ''].join(' ')} size={22} />
      </button>
    </div>
  )
}

function QuickCaptureModeButton({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="quiet-touch inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-graphite transition duration-200 hover:bg-white/45 hover:text-ink active:scale-95 active:bg-white/60"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function DeckPreview({
  quote,
  depth,
  lift
}: {
  quote: NonNullable<ReturnType<typeof selectDailyStack>[number]>
  depth: 1 | 2
  lift: number
}) {
  const { t } = useI18n()
  const meta = [quote.author, quote.work, quote.year].filter(Boolean).join(', ')
  const baseY = depth === 1 ? 18 : 34
  const promotedY = depth === 1 ? -10 : 8
  const baseScale = depth === 1 ? 0.946 : 0.902
  const promotedScale = depth === 1 ? 0.992 : 0.956
  const baseOpacity = depth === 1 ? 0.82 : 0.5
  const promotedOpacity = depth === 1 ? 0.96 : 0.7
  const y = lerp(baseY, promotedY, lift)
  const scale = lerp(baseScale, promotedScale, lift)
  const opacity = lerp(baseOpacity, promotedOpacity, lift)
  const rotate = depth === 1 ? lerp(-0.7, 0.15, lift) : lerp(0.8, -0.2, lift)

  return (
    <article
      aria-hidden="true"
      className="daily-preview-card pointer-events-none absolute inset-x-4 bottom-2 top-8 z-10 flex min-h-0 flex-col justify-end overflow-hidden rounded-md border border-line bg-paper/95 p-4 shadow-[0_18px_46px_rgba(31,30,28,0.08)] will-change-transform sm:inset-x-8 sm:bottom-3 sm:top-12 sm:p-7"
      style={{
        opacity,
        transform: `translate3d(0, ${y}px, 0) rotate(${rotate}deg) scale(${scale})`,
        transition: `opacity ${lift === 1 ? EXIT_MS : 160}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${lift === 1 ? EXIT_MS : 160}ms cubic-bezier(0.16, 1, 0.3, 1)`
      }}
    >
      <div className="flex shrink-0 justify-between text-[0.6rem] uppercase tracking-[0.18em] text-graphite">
        <span>{t('reviewStack')}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-hidden py-3">
        {quote.imageDataUrl && (
          <PhotoPreview
            src={quote.imageDataUrl}
            className="max-h-[22dvh] w-full rounded-md border border-line object-cover opacity-80"
          />
        )}
        <p className="line-clamp-2 break-words font-serif text-xl leading-[1.12] text-ink sm:text-3xl">
          {quote.text ? `"${quote.text}"` : quote.imageDataUrl ? t('untitledPhotoNote') : t('untitledVoiceNote')}
        </p>
      </div>
      <p className="truncate border-t border-line pt-2 text-xs text-graphite sm:text-sm">{meta}</p>
    </article>
  )
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index])
}
