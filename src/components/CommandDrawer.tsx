import { BookMarked, Coffee, Download, Feather, Hand, Inbox, Library, Search, Settings, Sparkles, Trash2, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'
import { openCapture as dispatchCapture } from '../services/captureEvents'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { quoteStatus } from '../types/quote'

const commandItems = [
  { to: '/today', labelKey: 'today', icon: Sparkles },
  { to: '/inbox', labelKey: 'noiseInbox', icon: Inbox },
  { to: '/library', labelKey: 'library', icon: Library },
  { to: '/reflections', labelKey: 'reflections', icon: Feather },
  { to: '/books', labelKey: 'books', icon: BookMarked },
  { to: '/import', labelKey: 'data', icon: Download },
  { to: '/trash', labelKey: 'trash', icon: Trash2 },
  { to: '/gestures', labelKey: 'gestures', icon: Hand },
  { to: '/settings', labelKey: 'settings', icon: Settings }
] as const

interface CommandDrawerProps {
  open: boolean
  onClose: () => void
}

export function CommandDrawer({ open, onClose }: CommandDrawerProps) {
  const { t } = useI18n()
  const titleId = useId()
  const { quotes, loadQuotes } = useQuoteStore()
  const { books, loadBooks } = useBookStore()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    void loadQuotes()
    void loadBooks()
  }, [loadBooks, loadQuotes, open])

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  const normalizedQuery = query.trim().toLowerCase()
  const commands = useMemo(
    () =>
      commandItems.filter((item) =>
        normalizedQuery ? t(item.labelKey).toLowerCase().includes(normalizedQuery) : true
      ),
    [normalizedQuery, t]
  )
  const quoteResults = useMemo(
    () =>
      normalizedQuery
        ? quotes
            .filter((quote) => quoteStatus(quote) === 'signal')
            .filter((quote) => [quote.text, quote.author, quote.work, quote.note, quote.tags.join(' ')].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery))
            .slice(0, 4)
        : [],
    [normalizedQuery, quotes]
  )
  const bookResults = useMemo(
    () =>
      normalizedQuery
        ? books
            .filter((book) => [book.title, book.author].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery))
            .slice(0, 4)
        : [],
    [books, normalizedQuery]
  )
  const hasResults = commands.length > 0 || quoteResults.length > 0 || bookResults.length > 0

  if (!open) return null

  function openCapture() {
    onClose()
    dispatchCapture('text')
  }

  return (
    <div className="fixed inset-0 z-40 bg-ink/10 backdrop-blur-[2px]" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="quiet-sheet absolute right-3 top-[calc(3.75rem+env(safe-area-inset-top))] grid max-h-[calc(100dvh-5rem)] w-[min(22rem,calc(100vw-1.5rem))] gap-3 overflow-y-auto rounded-md border border-line bg-paper/95 p-3 shadow-[0_24px_70px_rgba(31,30,28,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-graphite">{t('hiddenTools')}</p>
            <h2 id={titleId} className="font-serif text-2xl">Quiet Signal</h2>
          </div>
          <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line text-graphite" onClick={onClose} aria-label={t('close')}>
            <X size={17} />
          </button>
        </div>

        <label className="flex min-h-[46px] items-center gap-2 rounded-md border border-line bg-white/40 px-3">
          <Search size={16} className="text-graphite" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-graphite/65"
            placeholder={t('commandSearchPlaceholder')}
            aria-label={t('commandSearchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
        </label>

        <button type="button" className="flex min-h-[48px] items-center gap-3 rounded-md bg-ink px-3 text-left text-sm text-paper" onClick={openCapture}>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-paper/25">
            <Inbox size={16} />
          </span>
          {t('openCapture')}
        </button>

        {commands.length > 0 && (
          <nav className="grid gap-1" aria-label={t('primaryNavigation')}>
            {commands.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    [
                      'flex min-h-[46px] items-center gap-3 rounded-md px-3 text-sm transition',
                      isActive ? 'bg-ink text-paper' : 'text-ink hover:bg-white/50'
                    ].join(' ')
                  }
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-paper/70">
                    <Icon size={16} />
                  </span>
                  {t(item.labelKey)}
                </NavLink>
              )
            })}
          </nav>
        )}

        {bookResults.length > 0 && (
          <ResultGroup title={t('books')}>
            {bookResults.map((book) => (
              <NavLink key={book.id} to={`/books/${book.id}`} onClick={onClose} className="rounded-md border border-line bg-white/30 px-3 py-2 text-sm">
                <span className="block truncate text-ink">{book.title}</span>
                {book.author && <span className="block truncate text-xs text-graphite">{book.author}</span>}
              </NavLink>
            ))}
          </ResultGroup>
        )}

        {quoteResults.length > 0 && (
          <ResultGroup title={t('library')}>
            {quoteResults.map((quote) => (
              <NavLink key={quote.id} to={`/quote/${quote.id}`} onClick={onClose} className="rounded-md border border-line bg-white/30 px-3 py-2 text-sm">
                <span className="line-clamp-2 text-ink">{quote.text || quote.note || t('quote')}</span>
                <span className="mt-1 block truncate text-xs text-graphite">{[quote.author, quote.work].filter(Boolean).join(', ')}</span>
              </NavLink>
            ))}
          </ResultGroup>
        )}

        {!hasResults && <p className="rounded-md border border-line bg-white/30 px-3 py-4 text-sm text-graphite">{t('commandNoMatches')}</p>}

        <div className="grid gap-1 border-t border-line pt-2">
          <a className="flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm text-ink hover:bg-white/50" href="https://ko-fi.com/esc92" target="_blank" rel="noreferrer">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-paper/70">
              <Coffee size={16} />
            </span>
            {t('supportProjectAction')}
          </a>
        </div>
      </aside>
    </div>
  )
}

function ResultGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-1">
      <p className="px-1 text-xs uppercase tracking-[0.16em] text-graphite">{title}</p>
      {children}
    </section>
  )
}
