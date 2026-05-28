import { Camera, Mic, PenLine, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useI18n } from '../../i18n/I18nProvider'
import { openCapture } from '../../services/captureEvents'
import { tapHaptic } from '../../services/haptics'

export function QuickCaptureDock() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  function toggle() {
    tapHaptic(open ? 6 : [8, 24, 8])
    setOpen((value) => !value)
  }

  function capture(mode: 'text' | 'photo' | 'audio') {
    tapHaptic(8)
    setOpen(false)
    openCapture(mode)
  }

  return (
    <div className="relative flex flex-col items-center">
      {open && (
        <div
          className="quiet-pop absolute bottom-[4.15rem] left-1/2 z-30 -ml-[5.25rem] flex w-[10.5rem] items-center justify-between rounded-full border border-line bg-paper/92 p-1.5 shadow-[0_18px_46px_rgba(31,30,28,0.14)] backdrop-blur"
          role="group"
          aria-label={t('openCapture')}
        >
          <QuickCaptureModeButton label={t('text')} onClick={() => capture('text')}>
            <PenLine size={18} />
          </QuickCaptureModeButton>
          <QuickCaptureModeButton label={t('photoNote')} onClick={() => capture('photo')}>
            <Camera size={18} />
          </QuickCaptureModeButton>
          <QuickCaptureModeButton label={t('voiceNote')} onClick={() => capture('audio')}>
            <Mic size={18} />
          </QuickCaptureModeButton>
        </div>
      )}
      <button
        type="button"
        className="capture-dock quiet-touch inline-flex h-14 min-w-14 items-center justify-center rounded-full border border-line bg-paper/90 text-ink shadow-[0_18px_46px_rgba(31,30,28,0.14)] backdrop-blur transition duration-200 hover:bg-white/45 active:scale-95"
        aria-label={t('openCapture')}
        aria-expanded={open}
        onClick={toggle}
      >
        <Plus className={['transition duration-200', open ? 'rotate-45' : ''].join(' ')} size={22} />
      </button>
    </div>
  )
}

function QuickCaptureModeButton({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="quiet-touch inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-graphite transition duration-200 hover:bg-white/45 hover:text-ink active:scale-95 active:bg-white/60"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
