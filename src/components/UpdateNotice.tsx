import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { reloadApp, subscribeUpdateReady } from '../services/appUpdate'

// Calm, in-flow notice below the header (like the install hint) so it never covers the Today action bar.
export function UpdateNotice() {
  const { t } = useI18n()
  const [ready, setReady] = useState(false)

  useEffect(() => subscribeUpdateReady(() => setReady(true)), [])

  if (!ready) return null

  return (
    <div data-update-notice className="shrink-0 px-4 pb-2 sm:px-8">
      <div
        role="status"
        className="mx-auto flex max-w-md items-center gap-2 rounded-md border border-line bg-paper/80 px-2.5 py-2 text-ink shadow-sm"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/5 text-graphite">
          <RefreshCw size={16} />
        </span>
        <p className="min-w-0 flex-1 break-words font-serif text-sm leading-tight">{t('updateNoticeTitle')}</p>
        <button onClick={reloadApp} className="quiet-touch shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-medium text-paper">
          {t('updateNoticeAction')}
        </button>
      </div>
    </div>
  )
}
