import { Camera, Image, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { tapHaptic } from '../services/haptics'

interface PhotoCaptureProps {
  imageDataUrl?: string
  onChange: (image?: { dataUrl: string; mimeType: string }) => void
}

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const maxImageBytes = 12 * 1024 * 1024

export function PhotoCapture({ imageDataUrl, onChange }: PhotoCaptureProps) {
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState('')

  async function handleFile(file?: File) {
    if (!file) return
    setError('')

    if (!allowedImageTypes.has(file.type) || file.size > maxImageBytes) {
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
    <section className="rounded-md border border-line bg-white/30 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-serif text-xl sm:text-2xl">{t('photoNote')}</p>
          <p className="mt-1 text-sm leading-6 text-graphite">{t('photoNoteHelp')}</p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-md border border-dashed border-line bg-paper/55">
        {imageDataUrl ? (
          <div className="relative">
            <img className="max-h-[24rem] w-full object-cover sm:max-h-[28rem]" src={imageDataUrl} alt={t('photoNote')} />
            <button
              type="button"
              className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper/90 text-graphite shadow-[0_12px_30px_rgba(31,30,28,0.12)] backdrop-blur transition hover:text-clay"
              aria-label={t('removePhoto')}
              onClick={() => {
                tapHaptic(8)
                onChange(undefined)
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <div className="grid min-h-[11.5rem] place-items-center px-4 py-5 text-center">
            <div className="grid justify-items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-white/40 text-graphite shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                <Camera size={18} />
              </span>
              <div className="grid w-full grid-cols-2 gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-ink px-3 py-2 text-sm text-paper"
                  onClick={() => {
                    tapHaptic(8)
                    cameraInputRef.current?.click()
                  }}
                >
                  <Camera size={16} /> {t('takePhoto')}
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-line bg-paper/70 px-3 py-2 text-sm text-graphite"
                  onClick={() => {
                    tapHaptic(8)
                    fileInputRef.current?.click()
                  }}
                >
                  <Image size={16} /> {t('choosePhoto')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <input ref={cameraInputRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" onChange={(event) => void handleFile(event.target.files?.[0])} />
      <input ref={fileInputRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => void handleFile(event.target.files?.[0])} />

      {error && <p className="mt-3 text-sm text-clay">{error}</p>}
      {imageDataUrl && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-graphite"
            onClick={() => {
              tapHaptic(8)
              cameraInputRef.current?.click()
            }}
          >
            <Camera size={16} /> {t('takePhoto')}
          </button>
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-graphite"
            onClick={() => {
              tapHaptic(8)
              fileInputRef.current?.click()
            }}
          >
            <Image size={16} /> {t('choosePhoto')}
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
