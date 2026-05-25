import { ArrowLeft, ArrowRight, ExternalLink, Flame, Heart, Minus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AudioPlayer } from '../components/AudioRecorder'
import { EmptyState } from '../components/EmptyState'
import { LikeControl } from '../components/LikeControl'
import { PhotoPreview } from '../components/PhotoCapture'
import { useFitText } from '../hooks/useFitText'
import { useI18n } from '../i18n/I18nProvider'
import { selectDailyStack, type BookWeightMap } from '../services/review'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useSettingsStore } from '../store/useSettingsStore'

const SWIPE_THRESHOLD = 80

export function TodayPage() {
  const { t } = useI18n()
  const { quotes, loading, loadQuotes, saveQuote, likeQuote, dislikeQuote } = useQuoteStore()
  const { books, loadBooks } = useBookStore()
  const { dailyCount, dailyMode } = useSettingsStore()
  const [index, setIndex] = useState(0)
  const [drag, setDrag] = useState(0)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    void loadQuotes()
    void loadBooks()
  }, [loadQuotes, loadBooks])

  const bookWeights = useMemo<BookWeightMap>(
    () => Object.fromEntries(books.map((book) => [book.id, book.weight])),
    [books]
  )

  const dailyQuotes = useMemo(
    () => selectDailyStack(quotes, { limit: dailyCount, mode: dailyMode, bookWeights }),
    [bookWeights, dailyCount, dailyMode, quotes]
  )

  const currentIndex = Math.min(index, Math.max(dailyQuotes.length - 1, 0))
  const currentQuote = dailyQuotes[currentIndex]
  // Shrink long quotes to fit the card instead of clipping them.
  const { containerRef, textRef } = useFitText(currentQuote?.id ?? '')

  useEffect(() => {
    if (index >= dailyQuotes.length) {
      setIndex(Math.max(dailyQuotes.length - 1, 0))
    }
  }, [dailyQuotes.length, index])

  function goPrevious() {
    setIndex((value) => Math.max(value - 1, 0))
  }

  function goNext() {
    setIndex((value) => Math.min(value + 1, Math.max(dailyQuotes.length - 1, 0)))
  }

  function handleTouchStart(event: React.TouchEvent) {
    const touch = event.changedTouches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    draggingRef.current = false
  }

  function handleTouchMove(event: React.TouchEvent) {
    const start = touchStartRef.current
    if (!start) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    // Lock into a horizontal drag only once it clearly beats vertical motion.
    if (!draggingRef.current && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      draggingRef.current = true
    }
    if (draggingRef.current) setDrag(dx)
  }

  function handleTouchEnd(event: React.TouchEvent) {
    const start = touchStartRef.current
    const wasDragging = draggingRef.current
    touchStartRef.current = null
    draggingRef.current = false
    if (!start || !wasDragging || !currentQuote) {
      setDrag(0)
      return
    }
    const dx = event.changedTouches[0].clientX - start.x
    if (dx > SWIPE_THRESHOLD) void likeQuote(currentQuote.id)
    else if (dx < -SWIPE_THRESHOLD) void dislikeQuote(currentQuote.id)
    setDrag(0)
  }

  const likeHint = Math.max(0, Math.min(1, drag / SWIPE_THRESHOLD))
  const dislikeHint = Math.max(0, Math.min(1, -drag / SWIPE_THRESHOLD))

  return (
    <div className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden sm:gap-6">
      <section className="min-w-0 pt-1 sm:max-w-3xl sm:pt-6">
        <p className="text-[0.68rem] uppercase tracking-[0.2em] text-graphite sm:text-sm sm:tracking-[0.24em]">{t('dailyReading')}</p>
        <h1 className="mt-1 truncate font-serif text-3xl leading-tight sm:mt-3 sm:text-6xl">{t('todaysHighlights')}</h1>
        <p className="mt-2 hidden max-w-2xl text-base leading-7 text-graphite sm:block">{t('todayIntro')}</p>
      </section>

      {loading ? (
        <div className="flex min-h-0 items-center justify-center rounded-md border border-line bg-white/30 text-graphite">
          {t('loadingLibrary')}
        </div>
      ) : currentQuote ? (
        <section className="flex min-h-0 flex-col gap-4 lg:flex-row">
          <div
            className="relative flex min-h-0 flex-1 touch-pan-y flex-col overflow-hidden rounded-md border border-[#d4cabd] bg-[#fbf8f2] p-4 shadow-[0_24px_70px_rgba(31,30,28,0.08)] sm:p-8"
            style={{
              transform: `translateX(${drag}px) rotate(${drag * 0.015}deg)`,
              transition: drag === 0 ? 'transform 0.25s ease' : 'none'
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Swipe stamps */}
            <div
              className="pointer-events-none absolute right-4 top-16 z-10 flex items-center gap-1.5 rounded-full border-2 border-clay bg-paper/80 px-3 py-1 text-sm font-medium uppercase tracking-wide text-clay"
              style={{ opacity: likeHint }}
            >
              <Flame size={16} fill="currentColor" /> {t('like')}
            </div>
            <div
              className="pointer-events-none absolute left-4 top-16 z-10 flex items-center gap-1.5 rounded-full border-2 border-graphite bg-paper/80 px-3 py-1 text-sm font-medium uppercase tracking-wide text-graphite"
              style={{ opacity: dislikeHint }}
            >
              <Minus size={16} /> {t('dislike')}
            </div>

            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-clay/50 to-transparent" />
            <div className="flex shrink-0 items-center justify-between gap-3 text-[0.66rem] uppercase tracking-[0.18em] text-graphite sm:text-xs sm:tracking-[0.22em]">
              <span>{t('reviewStack')}</span>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-line text-graphite disabled:opacity-35 sm:h-9 sm:w-9"
                  disabled={currentIndex === 0}
                  onClick={goPrevious}
                  aria-label={t('previous')}
                >
                  <ArrowLeft size={15} />
                </button>
                <span className="min-w-12 text-center">{t('cardProgress', { current: currentIndex + 1, total: dailyQuotes.length })}</span>
                <button
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-line text-graphite disabled:opacity-35 sm:h-9 sm:w-9"
                  disabled={currentIndex >= dailyQuotes.length - 1}
                  onClick={goNext}
                  aria-label={t('next')}
                >
                  <ArrowRight size={15} />
                </button>
              </div>
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

            <div className="mt-3 grid shrink-0 grid-cols-3 gap-2 sm:mt-6 sm:flex sm:flex-wrap">
              <LikeControl
                compact
                className="w-full sm:w-auto"
                likes={currentQuote.likes}
                onLike={() => void likeQuote(currentQuote.id)}
                onDislike={() => void dislikeQuote(currentQuote.id)}
              />
              <button
                className={[
                  'inline-flex min-h-[44px] min-w-0 items-center justify-center gap-2 rounded-md border px-2 py-3 text-sm sm:px-4',
                  currentQuote.favorite ? 'border-clay text-clay' : 'border-line text-graphite'
                ].join(' ')}
                onClick={() => void saveQuote(currentQuote.id, { favorite: !currentQuote.favorite })}
              >
                <Heart size={16} fill={currentQuote.favorite ? 'currentColor' : 'none'} />
                <span className="hidden sm:inline">{t('favorite')}</span>
                <span className="sr-only sm:hidden">{t('favorite')}</span>
              </button>
              <Link
                className="inline-flex min-h-[44px] min-w-0 items-center justify-center gap-2 rounded-md border border-line px-2 py-3 text-sm text-graphite sm:px-4"
                to={`/quote/${currentQuote.id}`}
              >
                <ExternalLink size={16} />
                <span className="hidden sm:inline">{t('open')}</span>
                <span className="sr-only sm:hidden">{t('open')}</span>
              </Link>
            </div>
          </div>

          <aside className="hidden shrink-0 flex-col justify-between rounded-md border border-line bg-white/30 p-5 lg:flex lg:w-60">
            <div>
              <p className="font-serif text-3xl">{t('dailyReview')}</p>
              <p className="mt-3 text-sm leading-6 text-graphite">{t('swipeHint')}</p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md border border-line px-3 py-3 text-sm text-graphite disabled:opacity-40"
                disabled={currentIndex === 0}
                onClick={goPrevious}
              >
                <ArrowLeft size={16} /> {t('previous')}
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md border border-line px-3 py-3 text-sm text-graphite disabled:opacity-40"
                disabled={currentIndex >= dailyQuotes.length - 1}
                onClick={goNext}
              >
                {t('next')} <ArrowRight size={16} />
              </button>
            </div>
          </aside>
        </section>
      ) : (
        <div className="min-h-0">
          <EmptyState title={t('nothingDueToday')}>
            {t('nothingDueBody')}
            <div className="mt-5">
              <Link className="rounded-md bg-ink px-4 py-2 text-sm text-paper" to="/add">
                {t('addQuote')}
              </Link>
            </div>
          </EmptyState>
        </div>
      )}
    </div>
  )
}
