import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'
import { tapHaptic } from '../services/haptics'
import { useQuoteStore } from '../store/useQuoteStore'

export function ShareTargetPage() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const addQuote = useQuoteStore((state) => state.addQuote)
  const handledRef = useRef(false)
  const [state, setState] = useState<'saving' | 'saved' | 'failed'>('saving')

  const params = new URLSearchParams(location.search)
  const title = params.get('title')?.trim() ?? ''
  const text = params.get('text')?.trim() ?? ''
  const url = params.get('url')?.trim() ?? ''
  const body = [title, text, url].filter(Boolean).join('\n\n')

  // Resolves true once stored; a failure is shown instead of an endless spinner (the text stays in the URL for a retry).
  const store = useCallback(async () => {
    try {
      await addQuote({
        text: body,
        source: url ? 'Share' : undefined,
        note: url || undefined,
        tags: ['share'],
        favorite: false,
        status: 'inbox'
      })
      return true
    } catch (error) {
      console.error('Quiet Signal: shared content could not be saved', error)
      return false
    }
  }, [addQuote, body, url])

  const finish = useCallback(
    (saved: boolean) => {
      if (!saved) {
        setState('failed')
        return
      }
      tapHaptic([10, 30, 10])
      setState('saved')
      window.setTimeout(() => navigate('/inbox', { replace: true }), 420)
    },
    [navigate]
  )

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true
    if (!body) {
      navigate('/today', { replace: true })
      return
    }
    void store().then(finish)
  }, [body, finish, navigate, store])

  function retry() {
    setState('saving')
    void store().then(finish)
  }

  return (
    <div className="flex min-h-[55dvh] w-full items-center justify-center">
      <div className="grid justify-items-center gap-3 rounded-md border border-line bg-paper/70 px-6 py-8 text-center shadow-[0_18px_50px_rgba(31,30,28,0.08)]">
        {state === 'failed' ? (
          <>
            <p role="alert" className="text-sm text-clay">
              {t('shareFailed')}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={retry}
                className="quiet-touch rounded-full bg-ink px-4 py-2 text-xs font-medium text-paper"
              >
                {t('shareRetry')}
              </button>
              <Link to="/today" replace className="quiet-touch rounded-full border border-line px-4 py-2 text-xs text-graphite">
                {t('today')}
              </Link>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="animate-spin text-graphite" size={24} />
            <p className="text-sm text-graphite">{t(state === 'saved' ? 'shareImported' : 'shareImporting')}</p>
          </>
        )}
      </div>
    </div>
  )
}
