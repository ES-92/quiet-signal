import { Download, Share, X } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n/useI18n'
import { ensureFirstUse, isSecondDayOrLater } from '../services/firstUse'
import { isOnboardingActive, subscribeOnboardingActive } from '../services/onboarding'

const DISMISS_KEY = 'quiet-signal-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const { t } = useI18n()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  // Prompting is skipped when the user dismissed it before or the app already runs standalone.
  const [eligible] = useState(() => !localStorage.getItem(DISMISS_KEY) && !isStandalone())
  // iOS Safari has no beforeinstallprompt — show the manual hint instead.
  const [iosHint] = useState(() => eligible && isIosSafari())
  const [dismissed, setDismissed] = useState(false)
  // Calm start: nothing on the first day of use, and never on top of the onboarding.
  const [pastFirstDay, setPastFirstDay] = useState(() => {
    ensureFirstUse()
    return isSecondDayOrLater()
  })
  const onboardingActive = useSyncExternalStore(subscribeOnboardingActive, isOnboardingActive)

  useEffect(() => {
    if (!eligible) return

    function onBeforeInstall(event: Event) {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
      setPastFirstDay(isSecondDayOrLater())
    }

    function onInstalled() {
      setDismissed(true)
      localStorage.setItem(DISMISS_KEY, '1')
    }

    // An app left open overnight crosses into day two without a reload.
    function onVisible() {
      if (document.visibilityState === 'visible') setPastFirstDay(isSecondDayOrLater())
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [eligible])

  const visible = eligible && !dismissed && pastFirstDay && !onboardingActive && (iosHint || deferred !== null)
  if (!visible) return null

  function dismiss() {
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, '1')
  }

  async function handleInstall() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice.catch(() => undefined)
    dismiss()
  }

  return (
    <div data-install-prompt className="shrink-0 px-4 pb-2 sm:px-8">
      <div className="mx-auto flex max-w-md items-center gap-2 rounded-md border border-line bg-ink px-2.5 py-2 text-paper shadow-sm">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper/15">
          {iosHint ? <Share size={18} /> : <Download size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words font-serif text-sm leading-tight">{t('installTitle')}</p>
          <p className="break-words text-[11px] leading-snug text-paper/70">{iosHint ? t('installIosHint') : t('installBenefit')}</p>
        </div>
        {!iosHint && (
          <button
            onClick={() => void handleInstall()}
            className="quiet-touch shrink-0 rounded-full bg-paper px-4 py-2 text-xs font-medium text-ink"
          >
            {t('installAction')}
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label={t('installDismiss')}
          className="quiet-touch inline-flex shrink-0 items-center justify-center rounded-full text-paper/70 transition hover:text-paper"
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
