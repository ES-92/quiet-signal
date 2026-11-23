import { BookMarked, Coffee, Download, Feather, Hand, Heart, Inbox, Library, Search, Settings, Sparkles, Trash2, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'
import { openCapture as dispatchCapture } from '../services/captureEvents'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import { quoteStatus } from '../types/quote'

const commandItems = [
  { to: '/today', labelKey: 'today', icon: Sparkles },
  { to: '/inbox', labelKey: 'clarifyPageTitle', icon: Inbox },
  { to: '/library?view=favorites', labelKey: 'favorites', icon: Heart },
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
  onSupport: () => void
}

export function CommandDrawer({ open, onClose, onSupport }: CommandDrawerProps) {
  const { t } = useI18n()
  const titleId = useId()
  const location = useLocation()
  const { quotes, loadQuotes } = useQuoteStore()
  const { books, loadBooks } = useBookStore()
  const [query, setQuery] = useState('')
  const dialogRef = useRef<HTMLElement>(null)

  // Focus the drawer itself on open: screen readers announce it by its heading, and no keyboard pops up for the search field.
  useEffect(() => {
    if (open) dialogRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    void loadQuotes()
    void loadBooks()
  }, [loadBooks, loadQuotes, open])

  // Reset the search each time the drawer opens (adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setQuery('')
  }

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
            .filter((quote) => quoteStatus(quote) !== 'inbox')
            .filter((quote) => [quote.text, quote.author, quote.work, quote.note, quote.tags.join(' '), quote.thoughts?.map((thought) => thought.text).join(' ')].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery))
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="quiet-sheet outline-none absolute right-3 top-[calc(3.75rem+env(safe-area-inset-top))] grid grid-cols-[minmax(0,1fr)] max-h-[calc(100dvh-5rem)] w-[min(22rem,calc(100vw-1.5rem))] gap-3 overflow-y-auto rounded-md border border-line bg-paper/95 p-3 shadow-[0_24px_70px_rgba(31,30,28,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-graphite">{t('hiddenTools')}</p>
            <h2 id={titleId} className="font-serif text-2xl">Quiet Signal</h2>
          </div>
          <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line text-graphite" onClick={onClose} aria-label={t('close')}>
            <X size={17} />
          </button>
        </div>

        <label className="flex min-h-[46px] min-w-0 items-center gap-2 rounded-md border border-line bg-white/40 px-3">
          <Search size={16} className="text-graphite" />
          <input
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-graphite/65 sm:text-sm"
            placeholder={t('commandSearchPlaceholder')}
            aria-label={t('commandSearchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
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
              // Computed here rather than by NavLink, which ignores the query string and would also mark the library as
              // current on the favourites view.
              const active = isCommandActive(item.to, location.pathname, location.search)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'flex min-h-[46px] items-center gap-3 rounded-md border px-3 text-sm transition',
                    active ? 'border-ink/35 bg-white/60 font-medium text-ink' : 'border-transparent text-ink hover:bg-white/50'
                  ].join(' ')}
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-paper/70">
                    <Icon size={16} />
                  </span>
                  {t(item.labelKey)}
                </Link>
              )
            })}
          </nav>
        )}

        {bookResults.length > 0 && (
          <ResultGroup title={t('books')}>
            {bookResults.map((book) => (
              <Link key={book.id} to={`/books/${book.id}`} onClick={onClose} className="rounded-md border border-line bg-white/30 px-3 py-2 text-sm">
                <span className="block truncate text-ink">{book.title}</span>
                {book.author && <span className="block truncate text-xs text-graphite">{book.author}</span>}
              </Link>
            ))}
          </ResultGroup>
        )}

        {quoteResults.length > 0 && (
          <ResultGroup title={t('library')}>
            {quoteResults.map((quote) => (
              <Link key={quote.id} to={`/quote/${quote.id}`} onClick={onClose} className="rounded-md border border-line bg-white/30 px-3 py-2 text-sm">
                <span className="line-clamp-2 text-ink">{quote.text || quote.note || t('quote')}</span>
                <span className="mt-1 block truncate text-xs text-graphite">{[quote.author, quote.work].filter(Boolean).join(', ')}</span>
              </Link>
            ))}
          </ResultGroup>
        )}

        {!hasResults && <p className="rounded-md border border-line bg-white/30 px-3 py-4 text-sm text-graphite">{t('commandNoMatches')}</p>}

        <div className="grid gap-1 border-t border-line pt-2">
          <button
            type="button"
            className="flex min-h-[44px] items-center gap-3 rounded-md px-3 text-left text-sm text-ink hover:bg-white/50"
            onClick={() => {
              onClose()
              onSupport()
            }}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-paper/70">
              <Coffee size={16} />
            </span>
            {t('supportProjectAction')}
          </button>
        </div>
      </aside>
    </div>
  )
}

// The Favoriten entry shares the /library path with the library: only the query string tells them apart.
// Nested routes (e.g. /books/:id) keep their section current.
function isCommandActive(to: string, pathname: string, search: string) {
  const [path] = to.split('?')
  const pathActive = pathname === path || pathname.startsWith(`${path}/`)
  const favoritesView = new URLSearchParams(search).get('view') === 'favorites'
  if (to === '/library?view=favorites') return pathActive && favoritesView
  if (to === '/library') return pathActive && !favoritesView
  return pathActive
}

function ResultGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-1">
      <p className="px-1 text-xs uppercase tracking-[0.16em] text-graphite">{title}</p>
      {children}
    </section>
  )
}
