import { Mic, Pause, Play, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'

interface AudioRecorderProps {
  audioDataUrl?: string
  onChange: (audio?: { dataUrl: string; mimeType: string; durationMs: number }) => void
}

export function AudioRecorder({ audioDataUrl, onChange }: AudioRecorderProps) {
  const { t } = useI18n()
  const recorderRef = useRef<MediaRecorder | null>(null)
  const startedAtRef = useRef(0)
  const chunksRef = useRef<Blob[]>([])
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')

  async function startRecording() {
    setError('')

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(t('audioUnsupported'))
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      startedAtRef.current = Date.now()

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const mimeType = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const dataUrl = await blobToDataUrl(blob)
        onChange({ dataUrl, mimeType, durationMs: Date.now() - startedAtRef.current })
      }

      recorder.start()
      setRecording(true)
    } catch {
      setError(t('microphoneDenied'))
    }
  }

  function stopRecording() {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
  }

  return (
    <section className="rounded-md border border-line bg-white/30 p-4">
      <div className="grid gap-3 sm:flex sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="font-serif text-xl sm:text-2xl">{t('voiceNote')}</p>
          <p className="mt-1 text-sm leading-6 text-graphite">{t('voiceNoteHelp')}</p>
        </div>
        <button
          type="button"
          className={[
            'inline-flex shrink-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm',
            recording ? 'bg-clay text-paper' : 'bg-ink text-paper'
          ].join(' ')}
          onClick={recording ? stopRecording : startRecording}
        >
          {recording ? <Pause size={16} /> : <Mic size={16} />}
          {recording ? t('stopRecording') : t('startRecording')}
        </button>
      </div>

      {recording && <p className="mt-3 text-sm text-clay">{t('recordingNow')}</p>}
      {error && <p className="mt-3 text-sm text-clay">{error}</p>}

      {audioDataUrl && (
        <div className="mt-4 grid gap-3">
          <audio className="w-full" controls src={audioDataUrl}>
            {t('audioUnsupported')}
          </audio>
          <button
            type="button"
            className="inline-flex w-fit items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-graphite"
            onClick={() => onChange(undefined)}
          >
            <Trash2 size={16} /> {t('removeAudio')}
          </button>
        </div>
      )}
    </section>
  )
}

export function AudioPlayer({ src, compact = false }: { src: string; compact?: boolean }) {
  const { t } = useI18n()

  return (
    <div className={['rounded-md border border-line bg-white/40', compact ? 'p-2' : 'p-3'].join(' ')}>
      <div className={['flex items-center gap-2 text-sm text-graphite', compact ? 'sr-only' : 'mb-2'].join(' ')}>
        <Play size={15} /> {t('voiceNote')}
      </div>
      <audio className="w-full" controls src={src}>
        {t('audioUnsupported')}
      </audio>
    </div>
  )
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
