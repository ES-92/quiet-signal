import { Camera, Feather, Inbox, Mic, PenLine } from 'lucide-react'
import { type ReactNode } from 'react'
import { useI18n } from '../../i18n/I18nProvider'
import { openCapture } from '../../services/captureEvents'
import { tapHaptic } from '../../services/haptics'

export function DailyRestState({
  title,
  body,
  showReflection,
  onOpenReflections,
  inboxCount,
  onOpenInbox
}: {
  title: string
  body: string
  showReflection: boolean
  onOpenReflections: () => void
  inboxCount: number
  onOpenInbox: () => void
}) {
  const { t } = useI18n()

  return (
    <section className="flex min-h-0 items-center justify-center">
      <div className="quiet-fade classical-panel relative grid w-full max-w-2xl gap-5 overflow-hidden rounded-md px-5 py-7 text-center sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute inset-x-10 top-5 h-24 rounded-md border border-line/70 bg-paper/35 opacity-55" />
        <div className="pointer-events-none absolute inset-x-7 top-8 h-24 rounded-md border border-line bg-paper/55 opacity-75" />
        <div className="relative mx-auto flex h-24 w-20 items-center justify-center rounded-md border border-line bg-paper shadow-[0_16px_44px_rgba(31,30,28,0.08)]">
          <Feather className="text-clay" size={22} />
        </div>
        <div className="relative">
          <h2 className="font-serif text-3xl leading-tight sm:text-4xl">{title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-graphite">{body}</p>
        </div>
        {inboxCount > 0 && (
          <button
            type="button"
            className="quiet-touch relative mx-auto inline-flex items-center gap-2 rounded-full border border-clay/45 bg-paper/82 px-4 py-2 text-sm text-clay shadow-[0_14px_36px_rgba(31,30,28,0.08)] backdrop-blur transition active:scale-[0.98]"
            onClick={() => {
              tapHaptic(8)
              onOpenInbox()
            }}
          >
            <Inbox size={16} />
            <span>{t('noiseWaiting')}</span>
            <span className="rounded-full bg-clay/10 px-1.5 py-0.5 text-xs tabular-nums">{inboxCount}</span>
          </button>
        )}
        <div className="relative mx-auto flex max-w-full items-center justify-center gap-2 rounded-full border border-line bg-paper/80 p-1.5 shadow-[0_16px_42px_rgba(31,30,28,0.08)] backdrop-blur">
          <RestAction label={t('text')} onClick={() => openCapture('text')}>
            <PenLine size={17} />
          </RestAction>
          <RestAction label={t('photoNote')} onClick={() => openCapture('photo')}>
            <Camera size={17} />
          </RestAction>
          <RestAction label={t('voiceNote')} onClick={() => openCapture('audio')}>
            <Mic size={17} />
          </RestAction>
          {showReflection && (
            <RestAction label={t('openReflections')} onClick={onOpenReflections} emphasized>
              <Feather size={17} />
            </RestAction>
          )}
        </div>
      </div>
    </section>
  )
}

function RestAction({
  label,
  children,
  onClick,
  emphasized = false
}: {
  label: string
  children: ReactNode
  onClick: () => void
  emphasized?: boolean
}) {
  return (
    <button
      type="button"
      className={[
        'quiet-touch inline-flex h-11 w-11 items-center justify-center rounded-full transition duration-200 active:scale-95',
        emphasized ? 'bg-ink text-paper shadow-[0_10px_24px_rgba(31,30,28,0.14)]' : 'text-graphite hover:bg-white/45 hover:text-ink'
      ].join(' ')}
      aria-label={label}
      title={label}
      onClick={() => {
        tapHaptic(8)
        onClick()
      }}
    >
      {children}
    </button>
  )
}
