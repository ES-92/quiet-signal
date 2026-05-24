import { Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookCover } from '../components/BookCover'
import { EmptyState } from '../components/EmptyState'
import { useI18n } from '../i18n/I18nProvider'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'

export function BooksPage() {
  const { t } = useI18n()
  const { books, loadBooks, addBook } = useBookStore()
  const { quotes, loadQuotes } = useQuoteStore()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')

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

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    await addBook({ title: title.trim(), author: author.trim() || undefined, weight: 'normal', source: 'manual' })
    setTitle('')
    setAuthor('')
    setAdding(false)
  }

  return (
    <div className="grid gap-5 sm:gap-7">
      <section className="flex min-w-0 flex-col gap-3 pt-3 sm:flex-row sm:items-end sm:justify-between sm:pt-10">
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-[0.2em] text-graphite">{t('bookshelf')}</p>
          <h1 className="mt-2 truncate font-serif text-4xl leading-tight sm:text-5xl">{t('books')}</h1>
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
        <form className="grid gap-3 rounded-md border border-line bg-white/40 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={handleCreate}>
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
          <button disabled={!title.trim()} className="rounded-md bg-ink px-4 py-2 text-sm text-paper disabled:opacity-50">
            {t('create')}
          </button>
        </form>
      )}

      {books.length ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
          {books.map((book) => {
            const count = countByBook.get(book.id) ?? 0
            return (
              <Link key={book.id} to={`/books/${book.id}`} className="group flex min-w-0 flex-col gap-3">
                <div className="relative transition-transform duration-300 group-hover:-translate-y-1">
                  <BookCover title={book.title} author={book.author} />
                  {book.weight !== 'normal' && (
                    <span className="absolute right-2 top-2 rounded-full bg-paper/90 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.12em] text-ink shadow-sm">
                      {book.weight === 'often' ? t('weightOften') : t('weightRare')}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-serif text-lg leading-tight text-ink">{book.title}</p>
                  <p className="mt-1 truncate text-sm text-graphite">
                    {[book.author, count === 1 ? t('oneQuote') : t('quotesCount', { count })].filter(Boolean).join(' · ')}
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
