import { Download, Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'

const DISMISS_KEY = 'quiet-signal-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const { t } = useI18n()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosHint, setIosHint] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) || isStandalone()) return

    function onBeforeInstall(event: Event) {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
      setVisible(true)
    }

    function onInstalled() {
      setVisible(false)
      localStorage.setItem(DISMISS_KEY, '1')
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    // iOS Safari has no beforeinstallprompt — show the manual hint instead.
    if (isIosSafari()) {
      setIosHint(true)
      setVisible(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!visible) return null

  function dismiss() {
    setVisible(false)
    localStorage.setItem(DISMISS_KEY, '1')
  }

  async function handleInstall() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice.catch(() => undefined)
    dismiss()
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(5.15rem+env(safe-area-inset-bottom))] z-30 px-4 sm:bottom-4">
      <div className="mx-auto flex max-w-[23rem] items-center gap-2 rounded-full border border-paper/10 bg-ink px-2.5 py-2 text-paper shadow-[0_16px_40px_rgba(31,30,28,0.28)] backdrop-blur">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper/15">
          {iosHint ? <Share size={18} /> : <Download size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-sm leading-tight">{t('installTitle')}</p>
          <p className="truncate text-[11px] leading-snug text-paper/70">{iosHint ? t('installIosHint') : t('installBenefit')}</p>
        </div>
        {!iosHint && (
          <button
            onClick={() => void handleInstall()}
            className="shrink-0 rounded-full bg-paper px-3 py-1.5 text-xs font-medium text-ink"
          >
            {t('installAction')}
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label={t('installDismiss')}
          className="shrink-0 rounded-full p-2 text-paper/70 transition hover:text-paper"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIosSafari() {
  const ua = navigator.userAgent
  // Only Safari can "Add to Home Screen" on iOS; exclude Chrome/Firefox for iOS.
  return /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua) && !isStandalone()
}
