import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'
import { tapHaptic } from '../services/haptics'
import { useQuoteStore } from '../store/useQuoteStore'

export function ShareTargetPage() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const addQuote = useQuoteStore((state) => state.addQuote)
  const handledRef = useRef(false)
  const [message, setMessage] = useState(t('shareImporting'))

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    const params = new URLSearchParams(location.search)
    const title = params.get('title')?.trim() ?? ''
    const text = params.get('text')?.trim() ?? ''
    const url = params.get('url')?.trim() ?? ''
    const body = [title, text, url].filter(Boolean).join('\n\n')

    if (!body) {
      navigate('/today', { replace: true })
      return
    }

    void addQuote({
      text: body,
      source: url ? 'Share' : undefined,
      note: url || undefined,
      tags: ['share'],
      favorite: false,
      status: 'inbox',
      signalStrength: 'normal',
      entryType: 'note'
    }).then(() => {
      tapHaptic([10, 30, 10])
      setMessage(t('shareImported'))
      window.setTimeout(() => navigate('/inbox', { replace: true }), 420)
    })
  }, [addQuote, location.search, navigate, t])

  return (
    <div className="flex min-h-[55dvh] w-full items-center justify-center">
      <div className="grid justify-items-center gap-3 rounded-md border border-line bg-paper/70 px-6 py-8 text-center shadow-[0_18px_50px_rgba(31,30,28,0.08)]">
        <Loader2 className="animate-spin text-graphite" size={24} />
        <p className="text-sm text-graphite">{message}</p>
      </div>
    </div>
  )
}
