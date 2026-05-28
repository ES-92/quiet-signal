import { Camera, ChevronDown, Mic, PenLine, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import type { CaptureMode } from '../services/captureEvents'
import { tapHaptic } from '../services/haptics'
import { useQuoteStore } from '../store/useQuoteStore'
import type { SignalStrength } from '../types/quote'
import { AudioRecorder } from './AudioRecorder'
import { PhotoCapture } from './PhotoCapture'
import { SignalStrengthControl } from './SignalStrengthControl'

interface ZeroCaptureSheetProps {
  open: boolean
  onClose: () => void
  initialMode: CaptureMode
}

export function ZeroCaptureSheet({ open, onClose, initialMode }: ZeroCaptureSheetProps) {
  const { t } = useI18n()
  const titleId = useId()
  const { addQuote } = useQuoteStore()
  const [mode, setMode] = useState<CaptureMode>('text')
  const [text, setText] = useState('')
  const [tags, setTags] = useState('')
  const [signalStrength, setSignalStrength] = useState<SignalStrength>('quiet')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>()
  const [imageMimeType, setImageMimeType] = useState<string | undefined>()
  const [audioDataUrl, setAudioDataUrl] = useState<string | undefined>()
  const [audioMimeType, setAudioMimeType] = useState<string | undefined>()
  const [audioDurationMs, setAudioDurationMs] = useState<number | undefined>()
  const canSave =
    (mode === 'text' && Boolean(text.trim())) ||
    (mode === 'photo' && Boolean(imageDataUrl)) ||
    (mode === 'audio' && Boolean(audioDataUrl))

  useEffect(() => {
    if (!open) return
    setMode(initialMode)
    setText('')
    setTags('')
    setSignalStrength('quiet')
    setDetailsOpen(false)
    setImageDataUrl(undefined)
    setImageMimeType(undefined)
    setAudioDataUrl(undefined)
    setAudioMimeType(undefined)
    setAudioDurationMs(undefined)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [initialMode, onClose, open])

  function chooseMode(nextMode: CaptureMode) {
    tapHaptic(6)
    setMode(nextMode)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSave) return
    await addQuote({
      text: mode === 'text' ? text.trim() : '',
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      favorite: false,
      status: 'inbox',
      signalStrength,
      entryType: 'note',
      people: [],
      imageDataUrl: mode === 'photo' ? imageDataUrl : undefined,
      imageMimeType: mode === 'photo' ? imageMimeType : undefined,
      audioDataUrl: mode === 'audio' ? audioDataUrl : undefined,
      audioMimeType: mode === 'audio' ? audioMimeType : undefined,
      audioDurationMs: mode === 'audio' ? audioDurationMs : undefined
    })
    setText('')
    setTags('')
    setSignalStrength('quiet')
    setDetailsOpen(false)
    setMode(initialMode)
    setImageDataUrl(undefined)
    setImageMimeType(undefined)
    setAudioDataUrl(undefined)
    setAudioMimeType(undefined)
    setAudioDurationMs(undefined)
    tapHaptic([10, 35, 10])
    onClose()
  }

  if (!open) return null

  return (
    <div className="quiet-fade fixed inset-0 z-50 flex items-end bg-ink/10 backdrop-blur-[2px]" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="quiet-sheet mx-auto mb-3 grid max-h-[88dvh] w-[min(42rem,calc(100vw-1.5rem))] gap-4 overflow-y-auto rounded-md border border-line bg-paper/95 p-4 shadow-[0_-24px_80px_rgba(31,30,28,0.2)] sm:mb-6 sm:p-5"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="mx-auto h-1 w-12 rounded-full bg-ink/20" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-graphite">{t('quickNoise')}</p>
            <h2 id={titleId} className="font-serif text-3xl">{t('noiseInbox')}</h2>
          </div>
          <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line text-graphite" onClick={onClose} aria-label={t('close')}>
            <X size={17} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-full border border-line bg-paper/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
          <ModeButton active={mode === 'text'} icon={<PenLine size={17} />} label={t('text')} onClick={() => chooseMode('text')} />
          <ModeButton active={mode === 'photo'} icon={<Camera size={17} />} label={t('photoNote')} onClick={() => chooseMode('photo')} />
          <ModeButton active={mode === 'audio'} icon={<Mic size={17} />} label={t('voiceNote')} onClick={() => chooseMode('audio')} />
        </div>

        {mode === 'text' && (
          <textarea
            className="min-h-44 rounded-md border border-line bg-white/50 p-4 font-serif text-2xl leading-snug"
            placeholder={t('noisePlaceholder')}
            value={text}
            onChange={(event) => setText(event.target.value)}
            autoFocus
          />
        )}

        {mode === 'photo' && (
          <PhotoCapture
            imageDataUrl={imageDataUrl}
            onChange={(image) => {
              setImageDataUrl(image?.dataUrl)
              setImageMimeType(image?.mimeType)
            }}
          />
        )}

        {mode === 'audio' && (
          <AudioRecorder
            audioDataUrl={audioDataUrl}
            onChange={(audio) => {
              setAudioDataUrl(audio?.dataUrl)
              setAudioMimeType(audio?.mimeType)
              setAudioDurationMs(audio?.durationMs)
            }}
          />
        )}

        <button
          type="button"
          className="inline-flex min-h-[44px] items-center justify-between rounded-md border border-line bg-paper/60 px-3 py-2 text-sm text-graphite transition hover:border-ink/35 hover:text-ink"
          aria-expanded={detailsOpen}
          onClick={() => {
            tapHaptic(6)
            setDetailsOpen((open) => !open)
          }}
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal size={16} /> {t('contextDetails')}
          </span>
          <ChevronDown className={['transition duration-200', detailsOpen ? 'rotate-180' : ''].join(' ')} size={16} />
        </button>

        {detailsOpen && (
          <div className="quiet-pop grid gap-4 rounded-md border border-line bg-white/30 p-3">
            <input
              className="rounded-md border border-line bg-white/50 px-3 py-3"
              placeholder={t('noiseTagsPlaceholder')}
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
            <SignalStrengthControl value={signalStrength} onChange={setSignalStrength} />
          </div>
        )}

        <div className="sticky bottom-0 -mx-4 -mb-4 border-t border-line bg-paper/95 p-4 backdrop-blur sm:-mx-5 sm:-mb-5 sm:p-5">
          <button disabled={!canSave} className="min-h-[52px] w-full rounded-md bg-ink px-4 py-3 text-sm text-paper shadow-[0_14px_34px_rgba(31,30,28,0.16)] transition hover:bg-[#171615] disabled:opacity-50">
            {t('captureNoise')}
          </button>
        </div>
      </form>
    </div>
  )
}

function ModeButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={[
        'inline-flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-1 rounded-full px-2 text-[0.68rem] leading-none transition sm:text-xs',
        active ? 'bg-ink text-paper shadow-[0_8px_18px_rgba(31,30,28,0.14)]' : 'text-graphite hover:bg-white/45 hover:text-ink'
      ].join(' ')}
      aria-pressed={active}
      onClick={onClick}
    >
      {icon}
      <span className="w-full truncate text-center">{label}</span>
    </button>
  )
}
