import { BookMarked } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { exportCsv, exportJson, exportMarkdown, downloadText, parseCsvImport, parseJsonImport } from '../services/importExport'
import { buildKindleImport } from '../services/kindleImport'
import { buildReadwiseCsvImport } from '../services/readwiseCsvImport'
import { useBookStore } from '../store/useBookStore'
import { useQuoteStore } from '../store/useQuoteStore'

export function ImportExportPage() {
  const { t } = useI18n()
  const { quotes, loadQuotes, importQuotes } = useQuoteStore()
  const { books, loadBooks, importBooks } = useBookStore()
  const [message, setMessage] = useState('')
  const [kindleMessage, setKindleMessage] = useState('')
  const [readwiseMessage, setReadwiseMessage] = useState('')

  useEffect(() => {
    void loadQuotes()
    void loadBooks()
  }, [loadQuotes, loadBooks])

  async function handleFile(file?: File) {
    if (!file) return
    try {
      const content = await file.text()
      const imported = file.name.toLowerCase().endsWith('.json') ? parseJsonImport(content) : parseCsvImport(content)
      const valid = imported.filter((quote) => quote.text || quote.audioDataUrl || quote.imageDataUrl)
      await importQuotes(valid)
      setMessage(t('importedQuotes', { count: valid.length }))
    } catch (error) {
      console.error(error)
      setMessage(t('importFailed'))
    }
  }

  async function handleKindle(file?: File) {
    if (!file) return
    try {
      const content = await file.text()
      const plan = buildKindleImport(content, books, quotes)
      if (!plan.importedCount && !plan.newBooks.length) {
        setKindleMessage(t('kindleNothing'))
        return
      }
      if (plan.newBooks.length) await importBooks(plan.newBooks)
      if (plan.newQuotes.length) await importQuotes(plan.newQuotes)
      const parts = [t('kindleImported', { quotes: plan.importedCount, books: plan.bookCount })]
      if (plan.skippedCount) parts.push(t('kindleSkipped', { count: plan.skippedCount }))
      setKindleMessage(parts.join(' '))
    } catch (error) {
      console.error(error)
      setKindleMessage(t('kindleFailed'))
    }
  }

  async function handleReadwiseCsv(file?: File) {
    if (!file) return
    try {
      const content = await file.text()
      const plan = buildReadwiseCsvImport(content, books, quotes)
      if (!plan.importedCount && !plan.newBooks.length) {
        setReadwiseMessage(t('readwiseNothing'))
        return
      }
      if (plan.newBooks.length) await importBooks(plan.newBooks)
      if (plan.newQuotes.length) await importQuotes(plan.newQuotes)
      const parts = [t('readwiseImported', { quotes: plan.importedCount, books: plan.bookCount })]
      if (plan.skippedCount) parts.push(t('readwiseSkipped', { count: plan.skippedCount }))
      setReadwiseMessage(parts.join(' '))
    } catch (error) {
      console.error(error)
      setReadwiseMessage(t('readwiseFailed'))
    }
  }

  return (
    <div className="grid gap-6 pt-3 sm:gap-8 sm:pt-10 lg:grid-cols-2">
      <section className="min-w-0">
        <p className="text-sm uppercase tracking-[0.2em] text-graphite">{t('files')}</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">{t('importExport')}</h1>
        <p className="mt-4 max-w-xl leading-7 text-graphite">{t('importExportIntro')}</p>
      </section>
      <section className="grid gap-5">
        <div className="rounded-md border border-line bg-white/30 p-5">
          <h2 className="font-serif text-3xl">{t('import')}</h2>
          <p className="mt-2 text-sm leading-6 text-graphite">{t('importHelp')}</p>
          <input
            className="mt-5 block w-full rounded-md border border-line bg-paper p-3"
            type="file"
            accept=".json,.csv,application/json,text/csv"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          {message && <p className="mt-3 text-sm text-moss">{message}</p>}
        </div>
        <div className="rounded-md border border-line bg-white/30 p-5">
          <h2 className="flex items-center gap-2 font-serif text-3xl">
            <BookMarked size={22} className="text-clay" /> {t('kindleImport')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-graphite">{t('kindleHelp')}</p>
          <input
            className="mt-5 block w-full rounded-md border border-line bg-paper p-3"
            type="file"
            accept=".txt,text/plain"
            onChange={(event) => void handleKindle(event.target.files?.[0])}
          />
          {kindleMessage && <p className="mt-3 text-sm text-moss">{kindleMessage}</p>}
        </div>
        <div className="rounded-md border border-line bg-white/30 p-5">
          <h2 className="flex items-center gap-2 font-serif text-3xl">
            <BookMarked size={22} className="text-clay" /> {t('readwiseCsvImport')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-graphite">{t('readwiseCsvHelp')}</p>
          <input
            className="mt-5 block w-full rounded-md border border-line bg-paper p-3"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void handleReadwiseCsv(event.target.files?.[0])}
          />
          {readwiseMessage && <p className="mt-3 text-sm text-moss">{readwiseMessage}</p>}
        </div>
        <div className="rounded-md border border-line bg-white/30 p-5">
          <h2 className="font-serif text-3xl">{t('export')}</h2>
          <p className="mt-2 text-sm leading-6 text-graphite">{t('exportAvailable', { count: quotes.length })}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="rounded-md bg-ink px-4 py-2 text-sm text-paper" onClick={() => downloadText('commonplace.json', exportJson(quotes), 'application/json')}>
              JSON
            </button>
            <button className="rounded-md border border-line px-4 py-2 text-sm text-graphite" onClick={() => downloadText('commonplace.csv', exportCsv(quotes), 'text/csv')}>
              CSV
            </button>
            <button className="rounded-md border border-line px-4 py-2 text-sm text-graphite" onClick={() => downloadText('commonplace.md', exportMarkdown(quotes), 'text/markdown')}>
              Markdown
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
