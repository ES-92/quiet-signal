import { useNavigate } from 'react-router-dom'
import { QuoteForm } from '../components/QuoteForm'
import { useI18n } from '../i18n/I18nProvider'
import { useQuoteStore } from '../store/useQuoteStore'
import type { QuoteInput } from '../types/quote'

export function AddQuotePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const addQuote = useQuoteStore((state) => state.addQuote)

  async function handleSubmit(input: QuoteInput) {
    const quote = await addQuote(input)
    navigate(`/quote/${quote.id}`)
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-5 pt-3 sm:gap-7 sm:pt-10">
      <section>
        <p className="text-sm uppercase tracking-[0.2em] text-graphite">{t('capture')}</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">{t('addQuote')}</h1>
      </section>
      <QuoteForm submitLabel={t('saveQuote')} onSubmit={handleSubmit} />
    </div>
  )
}
