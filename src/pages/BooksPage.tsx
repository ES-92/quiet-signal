import { GitMerge, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookCover } from '../components/BookCover'
import { EmptyState } from '../components/EmptyState'
import { useI18n } from '../i18n/useI18n'
import {
  findBookMergeSuggestions,
  shouldUpdateSourceToBookTitle,
  strongestBookWeight,
  type BookMergeSuggestion
} from '../services/bookIntelligence'
import { tapHaptic } from '../services/haptics'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'

export function BooksPage() {
  const { t, tCount } = useI18n()
  const { books, loadBooks, addBook, removeBook, saveBook } = useBookStore()
  const { quotes, loadQuotes, saveQuote } = useQuoteStore()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    void loadBooks()
    void loadQuotes()
  }, [loadBooks, loadQuotes])

  const countByBook = useMemo(() => {
    const counts = new Map<string, number>()
    for (const quote of quotes) {
      if (quote.bookId) counts.set(quote.bookId, (counts.get(quote.bookId) ?? 0) + 1)
    }
    return counts
  }, [quotes])

  const mergeSuggestions = useMemo(() => findBookMergeSuggestions(books, quotes), [books, quotes])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    await addBook({ title: title.trim(), author: author.trim() || undefined, source: 'manual' })
    setTitle('')
    setAuthor('')
    setAdding(false)
  }

  async function handleMerge(suggestion: BookMergeSuggestion) {
    tapHaptic([8, 24, 8])
    for (const duplicate of suggestion.duplicates) {
      const duplicateQuotes = quotes.filter((quote) => quote.bookId === duplicate.id)
      for (const quote of duplicateQuotes) {
        await saveQuote(quote.id, {
          bookId: suggestion.primary.id,
          work: suggestion.primary.title,
          author: suggestion.primary.author ?? quote.author,
          source: shouldUpdateSourceToBookTitle(quote, duplicate) ? suggestion.primary.title : quote.source
        })
      }
      await removeBook(duplicate.id)
    }

    // The deprecated weight is unused, but the strongest stored value must survive the merge.
    const weight = strongestBookWeight(suggestion.books)
    if (weight && weight !== suggestion.primary.weight) await saveBook(suggestion.primary.id, { weight })

    await loadBooks()
    await loadQuotes()
    setMessage(t('booksMerged', { count: suggestion.duplicates.length + 1 }))
  }

  return (
    <div className="grid gap-5 sm:gap-7">
      <section className="flex min-w-0 flex-col gap-3 pt-3 sm:flex-row sm:items-end sm:justify-between sm:pt-10">
        <div className="min-w-0">
          <h1 className="truncate font-serif text-4xl leading-tight sm:text-5xl">{t('books')}</h1>
          <p className="mt-3 max-w-xl leading-7 text-graphite">{t('booksIntro')}</p>
        </div>
        <button
          className="inline-flex w-fit items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm text-paper"
          onClick={() => setAdding((value) => !value)}
        >
          {adding ? <X size={16} /> : <Plus size={16} />}
          {adding ? t('cancel') : t('addBook')}
        </button>
      </section>

      {adding && (
        <form
          className="grid gap-3 rounded-md border border-line bg-white/40 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={handleCreate}
        >
          <label className="grid gap-2">
            <span className="text-sm text-graphite">{t('bookTitleLabel')}</span>
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-md border border-line bg-paper px-3 py-2"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-graphite">{t('bookAuthorLabel')}</span>
            <input
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              className="rounded-md border border-line bg-paper px-3 py-2"
            />
          </label>
          <button
            disabled={!title.trim()}
            className="rounded-md bg-ink px-4 py-2 text-sm text-paper disabled:opacity-50"
          >
            {t('create')}
          </button>
        </form>
      )}

      {message && <p className="rounded-md border border-line bg-paper/80 px-4 py-3 text-sm text-moss">{message}</p>}

      {mergeSuggestions.length > 0 && (
        <section className="grid gap-3 rounded-md border border-line bg-white/30 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line text-clay">
              <GitMerge size={17} />
            </span>
            <div className="min-w-0">
              <h2 className="font-serif text-2xl">{t('similarBooks')}</h2>
              <p className="mt-1 text-sm leading-6 text-graphite">{t('similarBooksHelp')}</p>
            </div>
          </div>
          <div className="grid gap-2">
            {mergeSuggestions.slice(0, 3).map((suggestion) => (
              <div
                key={suggestion.key}
                className="grid gap-3 rounded-md border border-line bg-paper/60 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{suggestion.primary.title}</p>
                  <p className="mt-1 text-sm text-graphite">
                    {tCount('bookMergeSuggestion', suggestion.quoteCount, { books: suggestion.books.length })}
                  </p>
                </div>
                <button
                  className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-md bg-ink px-3 py-2 text-sm text-paper"
                  onClick={() => void handleMerge(suggestion)}
                >
                  <GitMerge size={15} /> {t('mergeBooks')}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {books.length ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
          {books.map((book) => {
            const count = countByBook.get(book.id) ?? 0
            return (
              <Link key={book.id} to={`/books/${book.id}`} className="group flex min-w-0 flex-col gap-3">
                <div className="relative transition-transform duration-300 group-hover:-translate-y-1">
                  <BookCover title={book.title} author={book.author} />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-serif text-lg leading-tight text-ink">{book.title}</p>
                  <p className="mt-1 truncate text-sm text-graphite">
                    {[book.author, tCount('entriesCount', count)].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <EmptyState title={t('noBooks')}>{t('noBooksBody')}</EmptyState>
      )}
    </div>
  )
}
