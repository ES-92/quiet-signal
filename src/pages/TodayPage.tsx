import { ArrowLeft, ArrowRight, BookOpen, Clock, ExternalLink, Flame, Heart } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AudioPlayer } from '../components/AudioRecorder'
import { EmptyState } from '../components/EmptyState'
import { PhotoPreview } from '../components/PhotoCapture'
import { useI18n } from '../i18n/I18nProvider'
import { selectDailyStack, type BookWeightMap } from '../services/review'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { useSettingsStore } from '../store/useSettingsStore'

export function TodayPage() {
  const { t } = useI18n()
  const { quotes, loading, loadQuotes, reviewQuote, saveQuote, likeQuote } = useQuoteStore()
  const { books, loadBooks } = useBookStore()
  const { dailyCount, dailyMode } = useSettingsStore()
  const [index, setIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)

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

  async function complete(action: 'read' | 'later') {
    if (!currentQuote) return
    await reviewQuote(currentQuote.id, action)
    setIndex((value) => Math.min(value, Math.max(dailyQuotes.length - 2, 0)))
  }

  function handleTouchEnd(clientX: number) {
    if (touchStart === null) return
    const distance = touchStart - clientX
    if (Math.abs(distance) > 48) {
      if (distance > 0) goNext()
      else goPrevious()
    }
    setTouchStart(null)
  }

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
        <section className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div
            className="relative flex min-h-0 flex-col overflow-hidden rounded-md border border-[#d4cabd] bg-[#fbf8f2] p-4 shadow-[0_24px_70px_rgba(31,30,28,0.08)] sm:p-8"
            onTouchStart={(event) => setTouchStart(event.changedTouches[0].clientX)}
            onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0].clientX)}
          >
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-clay/50 to-transparent" />
            <div className="flex shrink-0 items-center justify-between gap-3 text-[0.66rem] uppercase tracking-[0.18em] text-graphite sm:text-xs sm:tracking-[0.22em]">
              <span>{t('reviewStack')}</span>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-graphite disabled:opacity-35"
                  disabled={currentIndex === 0}
                  onClick={goPrevious}
                  aria-label={t('previous')}
                >
                  <ArrowLeft size={15} />
                </button>
                <span className="min-w-12 text-center">{t('cardProgress', { current: currentIndex + 1, total: dailyQuotes.length })}</span>
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-graphite disabled:opacity-35"
                  disabled={currentIndex >= dailyQuotes.length - 1}
                  onClick={goNext}
                  aria-label={t('next')}
                >
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 py-3 sm:gap-5 sm:py-6">
              {currentQuote.imageDataUrl && (
                <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-md">
                  <PhotoPreview
                    src={currentQuote.imageDataUrl}
                    className="max-h-[26dvh] w-full rounded-md border border-line object-cover sm:max-h-[34dvh]"
                  />
                </div>
              )}

              {currentQuote.text ? (
                <blockquote className="line-clamp-[8] break-words font-serif text-2xl leading-[1.12] text-ink sm:line-clamp-[7] sm:text-5xl">
                  "{currentQuote.text}"
                </blockquote>
              ) : (
                <h2 className="line-clamp-[4] break-words font-serif text-3xl leading-[1.12] text-ink sm:text-5xl">
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

            <div className="mt-3 grid shrink-0 grid-cols-5 gap-2 sm:mt-6 sm:flex sm:flex-wrap">
              <button
                className="inline-flex min-w-0 items-center justify-center gap-2 rounded-md bg-ink px-2 py-3 text-sm text-paper sm:px-4"
                onClick={() => void complete('read')}
              >
                <BookOpen size={16} />
                <span className="hidden sm:inline">{t('read')}</span>
                <span className="sr-only sm:hidden">{t('read')}</span>
              </button>
              <button
                className="inline-flex min-w-0 items-center justify-center gap-2 rounded-md border border-line px-2 py-3 text-sm text-graphite sm:px-4"
                onClick={() => void complete('later')}
              >
                <Clock size={16} />
                <span className="hidden sm:inline">{t('later')}</span>
                <span className="sr-only sm:hidden">{t('later')}</span>
              </button>
              <button
                className={[
                  'inline-flex min-w-0 items-center justify-center gap-2 rounded-md border px-2 py-3 text-sm sm:px-4',
                  currentQuote.likes > 0 ? 'border-clay text-clay' : 'border-line text-graphite'
                ].join(' ')}
                onClick={() => void likeQuote(currentQuote.id)}
                aria-label={t('like')}
              >
                <Flame size={16} fill={currentQuote.likes > 0 ? 'currentColor' : 'none'} />
                {currentQuote.likes > 0 ? (
                  <span key={currentQuote.likes} className="like-pop tabular-nums">{currentQuote.likes}</span>
                ) : (
                  <>
                    <span className="hidden sm:inline">{t('like')}</span>
                    <span className="sr-only sm:hidden">{t('like')}</span>
                  </>
                )}
              </button>
              <button
                className={[
                  'inline-flex min-w-0 items-center justify-center gap-2 rounded-md border px-2 py-3 text-sm sm:px-4',
                  currentQuote.favorite ? 'border-clay text-clay' : 'border-line text-graphite'
                ].join(' ')}
                onClick={() => void saveQuote(currentQuote.id, { favorite: !currentQuote.favorite })}
              >
                <Heart size={16} fill={currentQuote.favorite ? 'currentColor' : 'none'} />
                <span className="hidden sm:inline">{t('favorite')}</span>
                <span className="sr-only sm:hidden">{t('favorite')}</span>
              </button>
              <Link
                className="inline-flex min-w-0 items-center justify-center gap-2 rounded-md border border-line px-2 py-3 text-sm text-graphite sm:px-4"
                to={`/quote/${currentQuote.id}`}
              >
                <ExternalLink size={16} />
                <span className="hidden sm:inline">{t('open')}</span>
                <span className="sr-only sm:hidden">{t('open')}</span>
              </Link>
            </div>
          </div>

          <aside className="hidden flex-col justify-between rounded-md border border-line bg-white/30 p-5 lg:flex">
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
      ) : quotes.length ? (
        <div className="min-h-0">
          <EmptyState title={t('doneForToday')}>{t('doneForTodayBody')}</EmptyState>
        </div>
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
