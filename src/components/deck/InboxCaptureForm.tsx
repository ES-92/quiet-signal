import type { FormEvent } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { AudioRecorder } from '../AudioRecorder'
import { PhotoCapture } from '../PhotoCapture'

interface InboxCaptureFormProps {
  text: string
  onTextChange: (value: string) => void
  tags: string
  onTagsChange: (value: string) => void
  imageDataUrl?: string
  onImageChange: (image?: { dataUrl: string; mimeType: string }) => void
  audioDataUrl?: string
  onAudioChange: (audio?: { dataUrl: string; mimeType: string; durationMs: number }) => void
  canSave: boolean
  onSubmit: (event: FormEvent) => void
}

// Desktop quick-capture form on the Klären page (hidden on small screens, where the capture sheet is used).
export function InboxCaptureForm(props: InboxCaptureFormProps) {
  const { t } = useI18n()

  return (
    <form className="classical-panel mt-6 hidden gap-4 rounded-md p-4 sm:grid sm:p-5" onSubmit={props.onSubmit}>
      <p className="font-serif text-2xl">{t('quickCapture')}</p>
      <textarea
        className="min-h-28 rounded-md border border-line bg-white/50 p-4 font-serif text-xl leading-snug"
        placeholder={t('noisePlaceholder')}
        value={props.text}
        onChange={(event) => props.onTextChange(event.target.value)}
      />
      <PhotoCapture imageDataUrl={props.imageDataUrl} onChange={props.onImageChange} />
      <AudioRecorder audioDataUrl={props.audioDataUrl} onChange={props.onAudioChange} />
      <input
        className="rounded-md border border-line bg-white/50 px-3 py-3"
        placeholder={t('noiseTagsPlaceholder')}
        value={props.tags}
        onChange={(event) => props.onTagsChange(event.target.value)}
      />
      <button disabled={!props.canSave} className="rounded-md bg-ink px-4 py-3 text-sm text-paper disabled:opacity-50">
        {t('captureNoise')}
      </button>
    </form>
  )
}
