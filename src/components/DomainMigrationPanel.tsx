import { ArrowRightLeft, ChevronDown, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { parseJsonImportBundle } from '../services/importExport'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'
import type { Book } from '../types/book'
import type { Quote } from '../types/quote'

const oldOrigin = 'https://commonplace-seven.vercel.app'

interface MigrationMessage {
  type?: string
  payload?: {
    books?: Book[]
    quotes?: Quote[]
  }
}

export function DomainMigrationPanel() {
  const { t } = useI18n()
  const importBooks = useBookStore((state) => state.importBooks)
  const importQuotes = useQuoteStore((state) => state.importQuotes)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function receive(event: MessageEvent<MigrationMessage>) {
      if (event.origin !== oldOrigin) return
      if (event.data?.type !== 'quiet-signal-migration') return

      let books: Book[]
      let quotes: Quote[]
      try {
        const bundle = parseJsonImportBundle(JSON.stringify(event.data.payload ?? {}))
        books = bundle.books
        quotes = bundle.quotes
      } catch {
        return
      }
      if (books.length) await importBooks(books)
      if (quotes.length) await importQuotes(quotes)
      setMessage(t('migrationSuccess', { quotes: quotes.length, books: books.length }))
    }

    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [importBooks, importQuotes, t])

  function startMigration() {
    const target = encodeURIComponent(window.location.origin)
    const popup = window.open(`${oldOrigin}/migrate?target=${target}`, 'quiet-signal-migration', 'width=460,height=720')
    if (!popup) {
      setMessage(t('migrationBlocked'))
      return
    }
    setMessage(t('migrationWaiting'))
  }

  return (
    <details className="group rounded-md border border-line bg-white/30 p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2 font-serif text-2xl sm:text-3xl">
          <ArrowRightLeft size={22} className="shrink-0 text-clay" /> {t('migrationTitle')}
        </span>
        <ChevronDown className="shrink-0 text-graphite transition duration-200 group-open:rotate-180" size={18} />
      </summary>
      <p className="mt-3 text-sm leading-6 text-graphite">{t('migrationIntro')}</p>
      <button className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-ink px-4 py-2 text-sm text-ink hover:bg-ink hover:text-paper" onClick={startMigration}>
        {t('migrationOpenOld')} <ExternalLink size={15} />
      </button>
      {message && <p className="mt-3 text-sm leading-6 text-moss">{message}</p>}
    </details>
  )
}
