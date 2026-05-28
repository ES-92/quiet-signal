import { SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { QuoteCard } from '../components/QuoteCard'
import { useI18n } from '../i18n/I18nProvider'
import { filterQuotes, getFilterOptions } from '../services/search'
import { useQuoteStore } from '../store/useQuoteStore'
import { quoteStatus } from '../types/quote'

export function LibraryPage() {
  const { t } = useI18n()
  const { quotes, filters, setFilters, resetFilters, loadQuotes, saveQuote, likeQuote, dislikeQuote } = useQuoteStore()
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => {
    void loadQuotes()
  }, [loadQuotes])

  const signalQuotes = quotes.filter((quote) => quoteStatus(quote) === 'signal')
  const options = getFilterOptions(signalQuotes)
  const results = filterQuotes(signalQuotes, filters)

  return (
    <div className="grid gap-5 sm:gap-7">
      <section className="flex min-w-0 flex-col gap-3 pt-3 sm:flex-row sm:items-end sm:justify-between sm:pt-10">
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-[0.2em] text-graphite">{t('archive')}</p>
          <h1 className="mt-2 truncate font-serif text-4xl leading-tight sm:text-5xl">{t('library')}</h1>
        </div>
        <p className="text-sm text-graphite">{t('countOfQuotes', { shown: results.length, total: signalQuotes.length })}</p>
      </section>

      <section className="grid gap-2 rounded-md border border-line bg-white/30 p-3 sm:hidden">
        <input
          value={filters.query}
          onChange={(event) => setFilters({ query: event.target.value })}
          placeholder={t('searchPlaceholder')}
          className="min-h-[44px] min-w-0 rounded-md border border-line bg-paper px-3 py-2"
        />
        <button className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-graphite" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal size={16} /> {t('filters')}
        </button>
      </section>

      <section className="hidden gap-3 rounded-md border border-line bg-white/30 p-3 sm:grid sm:grid-cols-5 sm:p-4">
        <FilterFields
          query={filters.query}
          onQuery={(query) => setFilters({ query })}
          filters={filters}
          options={options}
          setFilters={setFilters}
          resetFilters={resetFilters}
        />
      </section>

      {filtersOpen && (
        <div className="quiet-fade fixed inset-0 z-50 flex items-end bg-ink/10 p-3 backdrop-blur-[2px] sm:hidden" onClick={() => setFiltersOpen(false)}>
          <section className="quiet-sheet grid max-h-[82dvh] w-full gap-3 overflow-y-auto rounded-md border border-line bg-paper p-4 shadow-[0_-24px_80px_rgba(31,30,28,0.18)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-2xl">{t('filters')}</h2>
              <button className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line text-graphite" onClick={() => setFiltersOpen(false)} aria-label={t('close')}>
                <X size={17} />
              </button>
            </div>
            <FilterFields
              query={filters.query}
              onQuery={(query) => setFilters({ query })}
              filters={filters}
              options={options}
              setFilters={setFilters}
              resetFilters={resetFilters}
            />
            <button className="min-h-[46px] rounded-md bg-ink px-4 py-2 text-sm text-paper" onClick={() => setFiltersOpen(false)}>
              {t('close')}
            </button>
          </section>
        </div>
      )}

      {results.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              compact
              onFavorite={(id) => void saveQuote(id, { favorite: !quote.favorite })}
              onLike={(id) => void likeQuote(id)}
              onDislike={(id) => void dislikeQuote(id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState title={t('noMatches')}>
          {t('noMatchesBody')}
        </EmptyState>
      )}
    </div>
  )
}

function FilterFields({
  query,
  onQuery,
  filters,
  options,
  setFilters,
  resetFilters
}: {
  query: string
  onQuery: (query: string) => void
  filters: ReturnType<typeof useQuoteStore.getState>['filters']
  options: ReturnType<typeof getFilterOptions>
  setFilters: (patch: Partial<ReturnType<typeof useQuoteStore.getState>['filters']>) => void
  resetFilters: () => void
}) {
  const { t } = useI18n()

  return (
    <>
      <input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={t('searchPlaceholder')}
        className="min-h-[44px] min-w-0 rounded-md border border-line bg-paper px-3 py-2 sm:col-span-2"
      />
      <Select label={t('allTags')} value={filters.tag} values={options.tags} onChange={(tag) => setFilters({ tag })} />
      <Select label={t('allAuthors')} value={filters.author} values={options.authors} onChange={(author) => setFilters({ author })} />
      <Select label={t('allSources')} value={filters.source} values={options.sources} onChange={(source) => setFilters({ source })} />
      <label className="flex min-h-[44px] items-center gap-2 text-sm text-graphite">
        <input
          type="checkbox"
          checked={filters.favoritesOnly}
          onChange={(event) => setFilters({ favoritesOnly: event.target.checked })}
        />
        {t('favoritesOnly')}
      </label>
      <button className="min-h-[44px] rounded-md border border-line px-3 py-2 text-sm text-graphite sm:w-fit" onClick={resetFilters}>
        {t('resetFilters')}
      </button>
    </>
  )
}

function Select({
  label,
  value,
  values,
  onChange
}: {
  label: string
  value: string
  values: string[]
  onChange: (value: string) => void
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-[44px] min-w-0 rounded-md border border-line bg-paper px-3 py-2">
      <option value="">{label}</option>
      {values.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  )
}
