import { useI18n } from '../i18n/useI18n'
import { effectiveDueAt } from '../services/lifecycle'
import { quoteStatus, type Quote } from '../types/quote'

function endOfToday(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - 1
}

// The one line under the thoughts: when the entry comes back, how often it was met, and its likes.
export function EntryInfoLine({ quote }: { quote: Quote }) {
  const { t, tCount, locale } = useI18n()
  const status = quoteStatus(quote)
  if (status === 'inbox') return <p className="text-sm text-graphite">{t('infoNotSorted')}</p>

  const encountered = quote.reviewCount > 0 ? tCount('encounteredCount', quote.reviewCount) : undefined
  let lead: string
  if (status === 'rest') {
    lead = t('infoResting')
  } else {
    const now = new Date()
    const due = effectiveDueAt(quote)
    const dueTime = due ? new Date(due).getTime() : undefined
    if (dueTime === undefined || Number.isNaN(dueTime) || dueTime <= endOfToday(now)) {
      lead = t('dueToday')
    } else {
      const date = new Date(dueTime)
      const formatted = date.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' as const })
      })
      lead = t('comesBackOn', { date: formatted })
    }
  }
  const likes = status === 'signal' && quote.likes > 0 ? `♥ ${quote.likes}` : undefined
  return <p className="text-sm tabular-nums text-graphite">{[lead, encountered, likes].filter(Boolean).join(' · ')}</p>
}
