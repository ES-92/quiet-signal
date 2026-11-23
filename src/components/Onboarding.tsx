import { ArrowRight, Check, Inbox, PenLine, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { onboardingEventName, markOnboardingSeen, setOnboardingOpen, shouldShowOnboarding } from '../services/onboarding'
import { tapHaptic } from '../services/haptics'
import { SignalMark } from './SignalMark'

export function Onboarding() {
  const { t } = useI18n()
  const [visible, setVisible] = useState(shouldShowOnboarding)
  const [step, setStep] = useState(0)

  // Three short steps: what noise, signal and rest mean, how capture works, how Today works.
  const steps = useMemo(
    () => [
      {
        icon: <SignalMark className="h-6 w-6" />,
        title: t('onboardingTitle'),
        body: t('onboardingBody')
      },
      {
        icon: <PenLine size={20} />,
        title: t('onboardingCaptureTitle'),
        body: t('onboardingCaptureBody')
      },
      {
        icon: <Inbox size={20} />,
        title: t('onboardingTodayTitle'),
        body: t('onboardingTodayBody')
      }
    ],
    [t]
  )

  useLayoutEffect(() => {
    setOnboardingOpen(visible)
    return () => setOnboardingOpen(false)
  }, [visible])

  useEffect(() => {
    function showOnboarding() {
      setStep(0)
      setVisible(true)
    }
    window.addEventListener(onboardingEventName, showOnboarding)
    return () => window.removeEventListener(onboardingEventName, showOnboarding)
  }, [])

  if (!visible) return null

  const current = steps[step]
  const last = step >= steps.length - 1

  function dismiss() {
    markOnboardingSeen()
    setVisible(false)
  }

  function next() {
    tapHaptic(8)
    if (last) {
      dismiss()
      return
    }
    setStep((value) => value + 1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/35 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={current.title}
        className="quiet-sheet classical-panel relative max-h-full w-full max-w-lg overflow-y-auto overscroll-contain rounded-md p-5 text-ink sm:p-7"
      >
        <button
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-graphite hover:text-ink"
          onClick={dismiss}
          aria-label={t('close')}
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 pr-10">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-ink text-paper shadow-[0_14px_32px_rgba(31,30,28,0.16)]">
            {current.icon}
          </span>
          <h2 className="min-w-0 font-serif text-2xl leading-tight sm:text-3xl">{current.title}</h2>
        </div>

        <p className="mt-4 leading-7 text-graphite">{current.body}</p>

        <div className="mt-5 grid grid-cols-3 gap-1" aria-label={t('onboardingProgress')}>
          {steps.map((item, index) => (
            <button
              key={item.title}
              type="button"
              className={[
                'h-1.5 rounded-full transition',
                index <= step ? 'bg-ink' : 'bg-line'
              ].join(' ')}
              aria-label={t('onboardingStep', { current: index + 1, total: steps.length })}
              onClick={() => setStep(index)}
            />
          ))}
        </div>

        <div className="mt-5 grid gap-2">
          <button className="min-h-[50px] rounded-md bg-ink px-4 py-3 text-sm text-paper" onClick={next}>
            <span className="inline-flex items-center justify-center gap-2">
              {last ? <Check size={16} /> : <ArrowRight size={16} />}
              {last ? t('onboardingFinish') : t('onboardingNext')}
            </span>
          </button>
          {!last && (
            <button className="min-h-[44px] rounded-md px-4 py-2 text-sm text-graphite hover:text-ink" onClick={dismiss}>
              {t('onboardingSkip')}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
