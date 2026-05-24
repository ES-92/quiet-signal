import { Camera, Image, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'

interface PhotoCaptureProps {
  imageDataUrl?: string
  onChange: (image?: { dataUrl: string; mimeType: string }) => void
}

export function PhotoCapture({ imageDataUrl, onChange }: PhotoCaptureProps) {
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState('')

  async function handleFile(file?: File) {
    if (!file) return
    setError('')

    if (!file.type.startsWith('image/')) {
      setError(t('photoUnsupported'))
      return
    }

    try {
      const image = await resizeImage(file)
      onChange(image)
    } catch {
      setError(t('photoUnsupported'))
    }
  }

  return (
    <section className="rounded-md border border-line bg-white/30 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-serif text-xl sm:text-2xl">{t('photoNote')}</p>
          <p className="mt-1 text-sm leading-6 text-graphite">{t('photoNoteHelp')}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-3 py-2 text-sm text-paper" onClick={() => cameraInputRef.current?.click()}>
          <Camera size={16} /> {t('takePhoto')}
        </button>
        <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-graphite" onClick={() => fileInputRef.current?.click()}>
          <Image size={16} /> {t('choosePhoto')}
        </button>
      </div>

      <input ref={cameraInputRef} className="hidden" type="file" accept="image/*" capture="environment" onChange={(event) => void handleFile(event.target.files?.[0])} />
      <input ref={fileInputRef} className="hidden" type="file" accept="image/*" onChange={(event) => void handleFile(event.target.files?.[0])} />

      {error && <p className="mt-3 text-sm text-clay">{error}</p>}

      {imageDataUrl && (
        <div className="mt-4 grid gap-3">
          <img className="max-h-[22rem] w-full rounded-md border border-line object-cover sm:max-h-[26rem]" src={imageDataUrl} alt={t('photoNote')} />
          <button
            type="button"
            className="inline-flex w-fit items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-graphite"
            onClick={() => onChange(undefined)}
          >
            <Trash2 size={16} /> {t('removePhoto')}
          </button>
        </div>
      )}
    </section>
  )
}

export function PhotoPreview({ src, className = 'w-full rounded-md border border-line object-cover' }: { src: string; className?: string }) {
  const { t } = useI18n()

  return <img className={className} src={src} alt={t('photoNote')} />
}

async function resizeImage(file: File) {
  const dataUrl = await fileToDataUrl(file)
  const image = await loadImage(dataUrl)
  const maxWidth = 1600
  const scale = Math.min(1, maxWidth / image.naturalWidth)
  const width = Math.round(image.naturalWidth * scale)
  const height = Math.round(image.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas unavailable')
  context.drawImage(image, 0, 0, width, height)
  const mimeType = 'image/jpeg'
  return { dataUrl: canvas.toDataURL(mimeType, 0.82), mimeType }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load image'))
    image.src = src
  })
}
