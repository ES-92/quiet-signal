import { Mic, Pause, Play, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { tapHaptic } from '../services/haptics'

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
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!recording) return
    const tick = () => setElapsedMs(Date.now() - startedAtRef.current)
    tick()
    const interval = window.setInterval(tick, 160)
    return () => window.clearInterval(interval)
  }, [recording])

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
      setElapsedMs(0)

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
      tapHaptic(10)
      setRecording(true)
    } catch {
      setError(t('microphoneDenied'))
    }
  }

  function stopRecording() {
    setElapsedMs(Date.now() - startedAtRef.current)
    tapHaptic([8, 24, 8])
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
  }

  return (
    <section className="rounded-md border border-line bg-white/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
      <div className="grid gap-4">
        <div>
          <p className="font-serif text-xl sm:text-2xl">{t('voiceNote')}</p>
          <p className="mt-1 text-sm leading-6 text-graphite">{t('voiceNoteHelp')}</p>
        </div>
        <button
          type="button"
          className={[
            'group relative grid min-h-[118px] place-items-center overflow-hidden rounded-md border px-4 py-4 text-center transition duration-300',
            recording
              ? 'border-clay bg-clay text-paper shadow-[0_18px_42px_rgba(166,95,63,0.2)]'
              : 'border-ink bg-ink text-paper shadow-[0_18px_42px_rgba(31,30,28,0.15)] hover:bg-[#171615]'
          ].join(' ')}
          onClick={recording ? stopRecording : startRecording}
        >
          <span className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-paper/45 to-transparent" />
          <span className={['mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-paper/20 bg-paper/10', recording ? 'recording-pulse' : ''].join(' ')}>
            {recording ? <Pause size={19} /> : <Mic size={19} />}
          </span>
          <span className="text-sm font-medium">{recording ? t('stopRecording') : t('startRecording')}</span>
          <span className="mt-1 font-mono text-xs tabular-nums text-paper/65">
            {recording ? formatDuration(elapsedMs) : t('voiceNote')}
          </span>
          {recording && <RecordingBars />}
        </button>
      </div>

      {recording && <p className="mt-3 text-sm text-clay">{t('recordingNow')} - {formatDuration(elapsedMs)}</p>}
      {error && <p className="mt-3 text-sm text-clay">{error}</p>}

      {audioDataUrl && (
        <div className="mt-4 grid gap-3">
          <audio className="w-full" controls src={audioDataUrl}>
            {t('audioUnsupported')}
          </audio>
          <button
            type="button"
            className="inline-flex w-fit items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-graphite"
            onClick={() => {
              tapHaptic(8)
              setElapsedMs(0)
              onChange(undefined)
            }}
          >
            <Trash2 size={16} /> {t('removeAudio')}
          </button>
        </div>
      )}
    </section>
  )
}

function RecordingBars() {
  return (
    <span className="recording-wave mt-4 flex h-7 items-end gap-1" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6].map((index) => (
        <span key={index} style={{ animationDelay: `${index * 72}ms` }} />
      ))}
    </span>
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

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
