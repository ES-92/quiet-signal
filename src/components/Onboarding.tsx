import { ArrowRight, Check, Inbox, PenLine, Radio, ShieldCheck, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'
import { openCapture } from '../services/captureEvents'
import { onboardingEventName, markOnboardingSeen, shouldShowOnboarding } from '../services/onboarding'
import { tapHaptic } from '../services/haptics'
import { SignalMark } from './SignalMark'

export function Onboarding() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  const steps = useMemo(
    () => [
      {
        icon: <SignalMark className="h-7 w-7" />,
        eyebrow: t('onboardingEyebrow'),
        title: t('onboardingTitle'),
        body: t('onboardingBody'),
        action: t('onboardingNext')
      },
      {
        icon: <PenLine size={20} />,
        eyebrow: t('onboardingCaptureEyebrow'),
        title: t('onboardingCaptureTitle'),
        body: t('onboardingCaptureBody'),
        action: t('onboardingTryCapture')
      },
      {
        icon: <Inbox size={20} />,
        eyebrow: t('onboardingClarifyEyebrow'),
        title: t('onboardingClarifyTitle'),
        body: t('onboardingClarifyBody'),
        action: t('onboardingOpenInbox')
      },
      {
        icon: <ShieldCheck size={20} />,
        eyebrow: t('onboardingBackupEyebrow'),
        title: t('onboardingBackupTitle'),
        body: t('onboardingBackupBody'),
        action: t('onboardingFinish')
      }
    ],
    [t]
  )

  useEffect(() => {
    setVisible(shouldShowOnboarding())
  }, [])

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
    if (!last) {
      setStep((value) => value + 1)
      return
    }
    dismiss()
  }

  function runAction() {
    tapHaptic([8, 24, 8])
    if (step === 1) {
      dismiss()
      openCapture('text')
      return
    }
    if (step === 2) {
      dismiss()
      navigate('/inbox')
      return
    }
    next()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/35 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
      <section className="quiet-sheet classical-panel relative w-full max-w-lg overflow-hidden rounded-md p-5 text-ink sm:p-7">
        <button
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-graphite hover:text-ink"
          onClick={dismiss}
          aria-label={t('close')}
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 pr-10">
          <span className="flex h-12 w-12 items-center justify-center rounded-md bg-ink text-paper shadow-[0_14px_32px_rgba(31,30,28,0.16)]">
            {current.icon}
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-graphite">{current.eyebrow}</p>
            <h2 className="font-serif text-3xl leading-tight">{current.title}</h2>
          </div>
        </div>

        <p className="mt-4 leading-7 text-graphite">{current.body}</p>

        <div className="mt-5 grid grid-cols-4 gap-1" aria-label={t('onboardingProgress')}>
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

        <div className="mt-6 grid gap-2 sm:grid-cols-[1fr_auto]">
          <button className="min-h-[50px] rounded-md bg-ink px-4 py-3 text-sm text-paper" onClick={runAction}>
            <span className="inline-flex items-center justify-center gap-2">
              {last ? <Check size={16} /> : <ArrowRight size={16} />}
              {current.action}
            </span>
          </button>
          {!last && (
            <button className="min-h-[50px] rounded-md border border-line px-4 py-3 text-sm text-graphite" onClick={next}>
              {t('onboardingNext')}
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-2 border-t border-line pt-4">
          <OnboardingHint icon={<Radio size={16} />} title={t('onboardingGestureTitle')} body={t('onboardingGestureBody')} />
        </div>
      </section>
    </div>
  )
}

function OnboardingHint({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-md bg-paper/60 p-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-clay">{icon}</span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm leading-6 text-graphite">{body}</p>
      </div>
    </div>
  )
}
