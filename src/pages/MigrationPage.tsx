import { ArrowRightLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { SignalMark } from '../components/SignalMark'
import { useI18n } from '../i18n/I18nProvider'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'

const allowedTargets = new Set(['https://quiet-signal.vercel.app', 'http://127.0.0.1:5184', 'http://localhost:5184'])

export function MigrationPage() {
  const { t } = useI18n()
  const { quotes, loadQuotes } = useQuoteStore()
  const { books, loadBooks } = useBookStore()
  const [sent, setSent] = useState(false)
  const target = useMemo(() => new URLSearchParams(window.location.search).get('target') ?? '', [])
  const allowed = allowedTargets.has(target)

  useEffect(() => {
    void loadQuotes()
    void loadBooks()
  }, [loadBooks, loadQuotes])

  function send() {
    if (!allowed || !window.opener) return
    window.opener.postMessage(
      {
        type: 'quiet-signal-migration',
        payload: { books, quotes }
      },
      target
    )
    setSent(true)
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-paper px-4 py-8 text-ink">
      <section className="classical-panel w-full max-w-md rounded-md p-5 text-center sm:p-7">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-ink text-paper">
          <SignalMark className="h-8 w-8" />
        </span>
        <p className="mt-5 text-xs uppercase tracking-[0.22em] text-graphite">{t('migrationTitle')}</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight">{t('migrationSendTitle')}</h1>
        <p className="mt-4 leading-7 text-graphite">{t('migrationSendBody', { quotes: quotes.length, books: books.length })}</p>
        {!allowed && <p className="mt-4 rounded-md border border-clay px-3 py-2 text-sm text-clay">{t('migrationUnsupported')}</p>}
        <button
          className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 text-sm text-paper disabled:opacity-50"
          disabled={!allowed || sent}
          onClick={send}
        >
          <ArrowRightLeft size={16} />
          {sent ? t('migrationSent') : t('migrationSendAction')}
        </button>
      </section>
    </main>
  )
}
