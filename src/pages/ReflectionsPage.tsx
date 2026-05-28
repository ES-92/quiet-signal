import { BookOpen, CalendarDays, Clock3, Download, Inbox, MapPin, Save, Sparkles, Tags } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { useI18n } from '../i18n/I18nProvider'
import { downloadText } from '../services/importExport'
import { buildReflection, reflectionMarkdown, type ReflectionMetric, type ReflectionPeriod, type ReflectionSummary } from '../services/reflections'
import { tapHaptic } from '../services/haptics'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import type { TranslationKey } from '../i18n/translations'

export function ReflectionsPage() {
  const { language, t } = useI18n()
  const { quotes, loadQuotes, addQuote } = useQuoteStore()
  const { books, loadBooks } = useBookStore()
  const [period, setPeriod] = useState<ReflectionPeriod>('week')
  const [message, setMessage] = useState('')

  useEffect(() => {
    void loadQuotes()
    void loadBooks()
  }, [loadBooks, loadQuotes])

  const summary = useMemo(() => buildReflection(quotes, books, period), [books, period, quotes])
  const letter = useMemo(() => composeLetter(summary, t), [summary, t])
  const markdown = useMemo(() => reflectionMarkdown(summary, letter), [letter, summary])
  const hasReflection = summary.entries.length > 0

  async function saveReflection() {
    if (!hasReflection) return
    tapHaptic([8, 28, 8])
    await addQuote({
      text: letter,
      tags: ['reflection', period],
      favorite: true,
      source: 'Quiet Signal',
      work: period === 'week' ? t('weeklyReflection') : t('monthlyReflection'),
      note: markdown,
      status: 'signal',
      signalStrength: 'strong',
      entryType: 'note',
      people: []
    })
    setMessage(t('reflectionSaved'))
  }

  function exportReflection() {
    if (!hasReflection) return
    tapHaptic(8)
    downloadText(`quiet-signal-${period}-reflection.md`, markdown, 'text/markdown')
  }

  return (
    <div className="grid gap-6 pt-3 sm:gap-8 sm:pt-10">
      <section className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-graphite">{t('reflectionsEyebrow')}</p>
        </div>
        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">{t('reflections')}</h1>
        <p className="mt-4 max-w-2xl leading-7 text-graphite">{t('reflectionsIntro')}</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="classical-panel min-w-0 rounded-md p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-graphite">{formatRange(summary.start, summary.end, language)}</p>
              <h2 className="mt-1 font-serif text-3xl leading-tight">{period === 'week' ? t('weeklyReflection') : t('monthlyReflection')}</h2>
            </div>
            <PeriodToggle period={period} onChange={setPeriod} />
          </div>

          {hasReflection ? (
            <>
              <article className="mt-7 border-y border-line py-6">
                <p className="max-w-2xl whitespace-pre-line font-serif text-3xl leading-tight text-ink sm:text-4xl">{letter}</p>
              </article>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Insight icon={<Sparkles size={17} />} label={t('reflectionSignals')} value={String(summary.signals.length)} />
                <Insight icon={<Inbox size={17} />} label={t('reflectionNoise')} value={String(summary.noise.length)} />
                {summary.topTime && <Insight icon={<Clock3 size={17} />} label={t('reflectionTimePattern')} value={translateMetric(summary.topTime, t)} />}
                {summary.topTags[0] && <Insight icon={<Tags size={17} />} label={t('reflectionTopTag')} value={summary.topTags[0].label} />}
              </div>

              {summary.topSignal && (
                <section className="mt-6 rounded-md border border-line bg-paper/55 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-graphite">{t('reflectionTopSignal')}</p>
                  <blockquote className="mt-3 font-serif text-2xl leading-tight">
                    "{summary.topSignal.text || summary.topSignal.note || t('quote')}"
                  </blockquote>
                  <p className="mt-3 truncate text-sm text-graphite">
                    {[summary.topSignal.author, summary.topSignal.work].filter(Boolean).join(', ')}
                  </p>
                </section>
              )}

              <div className="mt-6 flex flex-wrap gap-2">
                <button className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm text-paper" onClick={() => void saveReflection()}>
                  <Save size={16} /> {t('saveReflection')}
                </button>
                <button className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-line px-4 py-2 text-sm text-graphite" onClick={exportReflection}>
                  <Download size={16} /> {t('exportMarkdown')}
                </button>
              </div>
              {message && <p className="mt-3 text-sm leading-6 text-moss">{message}</p>}
            </>
          ) : (
            <div className="mt-6">
              <EmptyState title={t('reflectionEmptyTitle')}>{t('reflectionEmptyBody')}</EmptyState>
            </div>
          )}
        </div>

        <aside className="grid gap-3">
          <MetricGroup icon={<Tags size={16} />} title={t('reflectionTags')} metrics={summary.topTags} />
          <MetricGroup icon={<BookOpen size={16} />} title={t('reflectionBooks')} metrics={summary.topBooks} />
          <MetricGroup icon={<MapPin size={16} />} title={t('reflectionPlaces')} metrics={summary.topPlaces} />
          <MetricGroup icon={<CalendarDays size={16} />} title={t('reflectionTypes')} metrics={summary.topTypes.map((metric) => ({ ...metric, label: translateMetric(metric, t) }))} />
        </aside>
      </section>
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

function Insight({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-paper/55 p-3">
      <div className="flex items-center gap-2 text-graphite">
        {icon}
        <p className="text-xs uppercase tracking-[0.14em]">{label}</p>
      </div>
      <p className="mt-2 truncate font-serif text-2xl leading-tight">{value}</p>
    </div>
  )
}

function MetricGroup({ icon, title, metrics }: { icon: React.ReactNode; title: string; metrics: ReflectionMetric[] }) {
  const { t } = useI18n()
  return (
    <section className="rounded-md border border-line bg-white/30 p-4">
      <div className="flex items-center gap-2">
        <span className="text-clay">{icon}</span>
        <h3 className="font-serif text-2xl">{title}</h3>
      </div>
      {metrics.length ? (
        <div className="mt-3 grid gap-2">
          {metrics.map((metric) => (
            <div key={metric.key} className="flex items-center justify-between gap-3 border-t border-line pt-2 text-sm">
              <span className="truncate text-ink">{metric.label}</span>
              <span className="text-graphite">{metric.count}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-graphite">{t('reflectionNoPattern')}</p>
      )}
    </section>
  )
}

function composeLetter(summary: ReflectionSummary, t: (key: TranslationKey, values?: Record<string, string | number>) => string) {
  if (!summary.entries.length) return t('reflectionEmptyBody')

  const lines = [
    t('reflectionLetterIntro', {
      entries: summary.entries.length,
      signals: summary.signals.length,
      noise: summary.noise.length
    })
  ]

  if (summary.topTags[0]) lines.push(t('reflectionLetterTag', { tag: summary.topTags[0].label }))
  if (summary.topBooks[0]) lines.push(t('reflectionLetterBook', { book: summary.topBooks[0].label }))
  if (summary.topPlaces[0]) lines.push(t('reflectionLetterPlace', { place: summary.topPlaces[0].label }))
  if (summary.topTime) lines.push(t('reflectionLetterTime', { time: translateMetric(summary.topTime, t) }))
  if (summary.noise.length) lines.push(t('reflectionLetterNoise', { count: summary.noise.length }))
  if (summary.topSignal) lines.push(t('reflectionLetterClose'))

  return lines.join('\n\n')
}

function translateMetric(metric: ReflectionMetric, t: (key: TranslationKey, values?: Record<string, string | number>) => string) {
  const entryTypeKeys: Record<string, TranslationKey> = {
    note: 'entryType_note',
    memory: 'entryType_memory',
    book_quote: 'entryType_book_quote',
    idea: 'entryType_idea',
    conversation: 'entryType_conversation',
    observation: 'entryType_observation'
  }
  const timeKeys: Record<string, TranslationKey> = {
    morning: 'reflectionTime_morning',
    afternoon: 'reflectionTime_afternoon',
    evening: 'reflectionTime_evening',
    night: 'reflectionTime_night'
  }
  const key = entryTypeKeys[metric.key] ?? timeKeys[metric.key]
  return key ? t(key) : metric.label
}

function formatRange(start: Date, end: Date, locale: string) {
  return `${new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(start)} - ${new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric'
  }).format(end)}`
}
