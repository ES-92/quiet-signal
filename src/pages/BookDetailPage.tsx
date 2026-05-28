import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BookCover } from '../components/BookCover'
import { ConfirmSheet } from '../components/ConfirmSheet'
import { EmptyState } from '../components/EmptyState'
import { QuoteCard } from '../components/QuoteCard'
import { WeightControl } from '../components/WeightControl'
import { useI18n } from '../i18n/I18nProvider'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'

export function BookDetailPage() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const { books, loadBooks, saveBook, setWeight, removeBook } = useBookStore()
  const { quotes, loadQuotes, saveQuote, likeQuote, dislikeQuote } = useQuoteStore()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [savingBook, setSavingBook] = useState(false)
  const [bookMessage, setBookMessage] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    void loadBooks()
    void loadQuotes()
  }, [loadBooks, loadQuotes])

  const book = books.find((item) => item.id === id)
  const bookQuotes = quotes.filter((quote) => quote.bookId === id)

  useEffect(() => {
    if (!book) return
    setTitle(book.title)
    setAuthor(book.author ?? '')
    setBookMessage('')
  }, [book?.id, book?.title, book?.author])

  if (!book) {
    return (
      <div className="pt-10">
        <p className="text-graphite">{t('bookNotFound')}</p>
        <Link className="mt-4 inline-block rounded-md bg-ink px-4 py-2 text-sm text-paper" to="/books">
          {t('backToBooks')}
        </Link>
      </div>
    )
  }

  async function handleDelete() {
    if (!id) return
    setDeleteConfirmOpen(true)
  }

  async function confirmDeleteBook() {
    if (!id) return
    await removeBook(id)
    setDeleteConfirmOpen(false)
    navigate('/books')
  }

  async function handleSaveBook(event: React.FormEvent) {
    event.preventDefault()
    const nextTitle = title.trim()
    if (!nextTitle || !book) return
    setSavingBook(true)
    try {
      await saveBook(book.id, {
        title: nextTitle,
        author: author.trim() || undefined
      })
      setBookMessage(t('bookUpdated'))
    } finally {
      setSavingBook(false)
    }
  }

  const count = bookQuotes.length

  return (
    <div className="grid gap-6 pt-3 sm:gap-8 sm:pt-10">
      <Link className="inline-flex w-fit items-center gap-2 text-sm text-graphite hover:text-ink" to="/books">
        <ArrowLeft size={16} /> {t('backToBooks')}
      </Link>

      <section className="grid gap-5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-7">
        <div className="w-28 sm:w-32">
          <BookCover title={book.title} author={book.author} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-3xl leading-tight sm:text-5xl">{book.title}</h1>
            {book.source === 'kindle' && (
              <span className="rounded-full border border-line px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.14em] text-graphite">
                {t('fromKindle')}
              </span>
            )}
          </div>
          {book.author && <p className="mt-2 text-lg text-graphite">{book.author}</p>}
          <p className="mt-1 text-sm text-graphite">{count === 1 ? t('oneQuote') : t('quotesCount', { count })}</p>

          <form className="mt-5 grid gap-3 rounded-md border border-line bg-white/30 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end" onSubmit={(event) => void handleSaveBook(event)}>
            <label className="grid gap-2">
              <span className="text-sm text-graphite">{t('bookTitleLabel')}</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="min-w-0 rounded-md border border-line bg-paper px-3 py-2"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm text-graphite">{t('bookAuthorLabel')}</span>
              <input
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                className="min-w-0 rounded-md border border-line bg-paper px-3 py-2"
              />
            </label>
            <button
              disabled={!title.trim() || savingBook}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-md bg-ink px-4 py-2 text-sm text-paper disabled:opacity-50"
            >
              <Save size={16} /> {savingBook ? t('saving') : t('saveBook')}
            </button>
            <p className="text-sm leading-6 text-graphite sm:col-span-3">{bookMessage || t('bookEditHelp')}</p>
          </form>

          <div className="mt-5 rounded-md border border-line bg-white/30 p-4">
            <p className="text-sm uppercase tracking-[0.16em] text-graphite">{t('frequency')}</p>
            <p className="mt-1 text-sm leading-6 text-graphite">{t('frequencyHelp')}</p>
            <WeightControl className="mt-3" value={book.weight} onChange={(weight) => void setWeight(book.id, weight)} />
          </div>

          <button
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-clay px-3 py-2 text-sm text-clay"
            onClick={() => void handleDelete()}
          >
            <Trash2 size={16} /> {t('deleteBook')}
          </button>
        </div>
      </section>

      {bookQuotes.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {bookQuotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              compact
              onFavorite={(quoteId) => void saveQuote(quoteId, { favorite: !quote.favorite })}
              onLike={(quoteId) => void likeQuote(quoteId)}
              onDislike={(quoteId) => void dislikeQuote(quoteId)}
            />
          ))}
        </div>
      ) : (
        <EmptyState title={t('noQuotesYet')}>{t('noBooksBody')}</EmptyState>
      )}
      <ConfirmSheet
        open={deleteConfirmOpen}
        title={t('deleteBook')}
        description={t('deleteBookConfirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDeleteBook}
      />
    </div>
  )
}
