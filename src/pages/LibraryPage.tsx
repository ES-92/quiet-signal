import { useEffect } from 'react'
import { EmptyState } from '../components/EmptyState'
import { QuoteCard } from '../components/QuoteCard'
import { useI18n } from '../i18n/I18nProvider'
import { filterQuotes, getFilterOptions } from '../services/search'
import { useQuoteStore } from '../store/useQuoteStore'

export function LibraryPage() {
  const { t } = useI18n()
  const { quotes, filters, setFilters, resetFilters, loadQuotes, saveQuote, likeQuote } = useQuoteStore()

  useEffect(() => {
    void loadQuotes()
  }, [loadQuotes])

  const options = getFilterOptions(quotes)
  const results = filterQuotes(quotes, filters)

  return (
    <div className="grid gap-5 sm:gap-7">
      <section className="flex min-w-0 flex-col gap-3 pt-3 sm:flex-row sm:items-end sm:justify-between sm:pt-10">
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-[0.2em] text-graphite">{t('archive')}</p>
          <h1 className="mt-2 truncate font-serif text-4xl leading-tight sm:text-5xl">{t('library')}</h1>
        </div>
        <p className="text-sm text-graphite">{t('countOfQuotes', { shown: results.length, total: quotes.length })}</p>
      </section>

      <section className="grid gap-3 rounded-md border border-line bg-white/30 p-3 sm:grid-cols-5 sm:p-4">
        <input
          value={filters.query}
          onChange={(event) => setFilters({ query: event.target.value })}
          placeholder={t('searchPlaceholder')}
          className="min-w-0 rounded-md border border-line bg-paper px-3 py-2 sm:col-span-2"
        />
        <Select label={t('allTags')} value={filters.tag} values={options.tags} onChange={(tag) => setFilters({ tag })} />
        <Select label={t('allAuthors')} value={filters.author} values={options.authors} onChange={(author) => setFilters({ author })} />
        <Select label={t('allSources')} value={filters.source} values={options.sources} onChange={(source) => setFilters({ source })} />
        <label className="flex items-center gap-2 text-sm text-graphite">
          <input
            type="checkbox"
            checked={filters.favoritesOnly}
            onChange={(event) => setFilters({ favoritesOnly: event.target.checked })}
          />
          {t('favoritesOnly')}
        </label>
        <button className="rounded-md border border-line px-3 py-2 text-sm text-graphite sm:w-fit" onClick={resetFilters}>
          {t('resetFilters')}
        </button>
      </section>

      {results.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              compact
              onFavorite={(id) => void saveQuote(id, { favorite: !quote.favorite })}
              onLike={(id) => void likeQuote(id)}
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
    <select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 rounded-md border border-line bg-paper px-3 py-2">
      <option value="">{label}</option>
      {values.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  )
}
