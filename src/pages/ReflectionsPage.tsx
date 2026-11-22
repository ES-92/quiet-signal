import { Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n, type I18nContextValue } from '../i18n/useI18n'
import { downloadText } from '../services/importExport'
import {
  buildReflection,
  reflectionMarkdown,
  type ReflectionPeriod,
  type ReflectionThought,
  type ReflectionTotals,
  type StripBucket
} from '../services/reflections'
import { tapHaptic } from '../services/haptics'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'

// Dots shown per column before the strip stops stacking (the summary line keeps the full count).
const maxMoreDots = 6
const maxRestDots = 4

export function ReflectionsPage() {
  const { t, tCount, locale } = useI18n()
  const { quotes, loadQuotes } = useQuoteStore()
  const { books, loadBooks } = useBookStore()
  const [period, setPeriod] = useState<ReflectionPeriod>('week')

  useEffect(() => {
    void loadQuotes()
    void loadBooks()
  }, [loadBooks, loadQuotes])

  const summary = useMemo(() => buildReflection(quotes, books, period), [books, period, quotes])
  const summaryLine = useMemo(() => tideSummary(summary.totals, tCount), [summary.totals, tCount])
  const title = period === 'week' ? t('weeklyReflection') : t('monthlyReflection')
  const hasContent = summary.thoughts.length > 0 || summary.totals.more + summary.totals.less + summary.totals.rest > 0

  function exportReflection() {
    if (!hasContent) return
    tapHaptic(8)
    const markdown = reflectionMarkdown(summary, { title, summary: summaryLine ?? '', fromNote: t('fromNote') })
    downloadText(`quiet-signal-${period}-reflection.md`, markdown, 'text/markdown')
  }

  return (
    <div className="grid gap-6 pt-3 sm:gap-8 sm:pt-10">
      <section className="min-w-0">
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">{t('reflections')}</h1>
        <p className="mt-4 max-w-2xl leading-7 text-graphite">{t('reflectionsIntro')}</p>
      </section>

      <section className="classical-panel min-w-0 rounded-md p-4 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-graphite">{formatRange(summary.start, summary.end, locale)}</p>
            <h2 className="mt-1 font-serif text-3xl leading-tight">{title}</h2>
          </div>
          <PeriodToggle period={period} onChange={setPeriod} />
        </div>

        <ThoughtWall thoughts={summary.thoughts} period={period} />

        <section aria-labelledby="reflection-tide-title" className="mt-8 border-t border-line pt-5">
          <h3 id="reflection-tide-title" className="text-xs uppercase tracking-[0.16em] text-graphite">
            {t('reflectionTideTitle')}
          </h3>
          <TideStrip
            strip={summary.strip}
            period={period}
            label={[t('reflectionTideTitle'), summaryLine ?? t('reflectionTideQuiet'), tCount('reflectionThoughtsCount', summary.thoughts.length)].join(' · ')}
          />
          <p className="mt-3 text-sm leading-6 text-ink">{summaryLine ?? t('reflectionTideQuiet')}</p>
          <p className="mt-1 text-xs leading-5 text-graphite">{t('reflectionTideLegend')}</p>
        </section>

        {hasContent && (
          <div className="mt-6">
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-line px-4 py-2 text-sm text-graphite hover:text-ink"
              onClick={exportReflection}
            >
              <Download size={16} /> {t('exportMarkdown')}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

function ThoughtWall({ thoughts, period }: { thoughts: ReflectionThought[]; period: ReflectionPeriod }) {
  const { t, locale } = useI18n()
  const dayFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, period === 'week' ? { weekday: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' }),
    [locale, period]
  )

  return (
    <section aria-labelledby="reflection-thoughts-title" className="mt-6">
      <h3 id="reflection-thoughts-title" className="text-xs uppercase tracking-[0.16em] text-graphite">
        {t('reflectionThoughtsTitle')}
      </h3>
      {thoughts.length ? (
        <ul className="mt-3 grid grid-cols-1 gap-3">
          {thoughts.map((thought) => {
            const context = [thought.author, thought.work].filter(Boolean).join(', ') || excerpt(thought.quoteText)
            return (
              <li key={`${thought.quoteId}-${thought.id}`} className="min-w-0">
                <Link
                  to={`/quote/${thought.quoteId}`}
                  className="block min-w-0 rounded-md border border-line bg-paper/60 px-4 py-3 transition hover:border-graphite/40 hover:bg-white/40"
                  onClick={() => tapHaptic(8)}
                >
                  <p data-thought-text className="whitespace-pre-wrap break-words font-serif text-xl leading-snug text-ink">
                    {thought.text}
                  </p>
                  <p className="mt-2 truncate text-xs text-graphite">
                    {[dayFormat.format(new Date(thought.createdAt)), context, thought.fromNote ? t('fromNote') : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 max-w-xl font-serif text-xl leading-snug text-graphite">
          {period === 'week' ? t('reflectionEmptyWeek') : t('reflectionEmptyMonth')}
        </p>
      )}
    </section>
  )
}

// Above the line: one dot per → (ring on top when a thought was added); below: one dot per ↓.
function TideStrip({ strip, period, label }: { strip: StripBucket[]; period: ReflectionPeriod; label: string }) {
  const { locale } = useI18n()
  const labelFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, period === 'week' ? { weekday: 'short' } : { day: 'numeric' }),
    [locale, period]
  )

  return (
    <div
      role="img"
      aria-label={label}
      className="mt-4 grid min-w-0"
      style={{ gridTemplateColumns: `repeat(${strip.length}, minmax(0, 1fr))` }}
    >
      {strip.map((bucket) => (
        <div key={bucket.start.toISOString()} className="flex min-w-0 flex-col items-center">
          <div className="flex h-20 flex-col-reverse items-center gap-1 pb-1.5">
            {Array.from({ length: Math.min(bucket.more, maxMoreDots) }, (_, index) => (
              <span key={index} className="h-1.5 w-1.5 rounded-full bg-clay" />
            ))}
            {bucket.thought && <span className="h-3 w-3 rounded-full border-[1.5px] border-clay" />}
          </div>
          <div className="h-px w-full bg-line" />
          <div className="flex h-10 flex-col items-center gap-1 pt-1.5">
            {Array.from({ length: Math.min(bucket.rest, maxRestDots) }, (_, index) => (
              <span key={index} className="h-1.5 w-1.5 rounded-full bg-graphite/45" />
            ))}
          </div>
          <span className="mt-1 max-w-full truncate text-[0.68rem] text-graphite">{labelFormat.format(bucket.start)}</span>
        </div>
      ))}
    </div>
  )
}

function PeriodToggle({ period, onChange }: { period: ReflectionPeriod; onChange: (period: ReflectionPeriod) => void }) {
  const { t } = useI18n()
  return (
    <div className="grid grid-cols-2 rounded-md border border-line bg-paper p-1 text-sm">
      {(['week', 'month'] as const).map((value) => (
        <button
          key={value}
          type="button"
          className={[
            'min-h-[40px] rounded px-3 transition',
            period === value ? 'bg-ink text-paper shadow-[0_8px_18px_rgba(31,30,28,0.14)]' : 'text-graphite hover:text-ink'
          ].join(' ')}
          onClick={() => onChange(value)}
        >
          {value === 'week' ? t('thisWeek') : t('thisMonth')}
        </button>
      ))}
    </div>
  )
}

// "2 durften ruhen · 5 wolltest du öfter sehen"; undefined when nothing moved.
function tideSummary(totals: ReflectionTotals, tCount: I18nContextValue['tCount']) {
  const parts = [
    totals.rest > 0 ? tCount('reflectionRestedCount', totals.rest) : '',
    totals.more > 0 ? tCount('reflectionMoreCount', totals.more) : ''
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : undefined
}

function excerpt(text: string | undefined) {
  if (!text) return ''
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > 60 ? `${line.slice(0, 59)}…` : line
}

function formatRange(start: Date, end: Date, locale: string) {
  const format = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
  return `${format.format(start)} - ${format.format(end)}`
}
