import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'
import { dueInDays, overdueDays } from '../services/dueLabel'
import { effectiveDueAt } from '../services/lifecycle'
import { quoteStatus, type Quote } from '../types/quote'

// The one line under the thoughts: when the entry comes back, how often it was met, and its likes (in words).
export function EntryInfoLine({ quote }: { quote: Quote }) {
  const { t, tCount, locale } = useI18n()
  const status = quoteStatus(quote)
  if (status === 'inbox') {
    return (
      <p className="text-sm text-graphite">
        {t('infoNotSorted')} ·{' '}
        <Link className="inline-flex min-h-[44px] items-center text-clay underline underline-offset-2" to="/inbox">
          {t('clarifyNow')}
        </Link>
      </p>
    )
  }

  const encountered = quote.reviewCount > 0 ? tCount('encounteredCount', quote.reviewCount) : undefined
  let lead: string
  if (status === 'rest') {
    lead = t('infoResting')
  } else {
    const now = new Date()
    const overdue = overdueDays(quote, now)
    if (overdue > 0) {
      lead = tCount('infoOverdue', overdue)
    } else if (dueInDays(quote, now) === 0) {
      lead = t('dueToday')
    } else {
      const date = new Date(effectiveDueAt(quote) as string)
      const formatted = date.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
        ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' as const })
      })
      lead = t('comesBackOn', { date: formatted })
    }
  }
  // In words, so it is not mistaken for the favourite heart.
  const likes = quote.likes > 0 ? tCount('likesCount', quote.likes) : undefined
  return <p className="text-sm tabular-nums text-graphite">{[lead, encountered, likes].filter(Boolean).join(' · ')}</p>
}
