import { AlertTriangle, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { tapHaptic } from '../services/haptics'

interface ConfirmSheetProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void | Promise<void>
  onClose: () => void
  tone?: 'danger' | 'neutral'
}

export function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  tone = 'danger'
}: ConfirmSheetProps) {
  const titleId = useId()
  const descriptionId = useId()
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = window.requestAnimationFrame(() => cancelRef.current?.focus())

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
      if (previousActive?.isConnected) previousActive.focus()
    }
  }, [onClose, open])

  useEffect(() => {
    if (!open) setBusy(false)
  }, [open])

  if (!open) return null

  async function handleConfirm() {
    if (busy) return
    setBusy(true)
    tapHaptic([8, 24, 8])
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  const confirmClass =
    tone === 'danger'
      ? 'border-clay bg-clay text-paper shadow-[0_16px_36px_rgba(166,95,63,0.18)] hover:bg-[#925237]'
      : 'border-ink bg-ink text-paper shadow-[0_16px_36px_rgba(31,30,28,0.16)] hover:bg-[#171615]'

  return (
    <div
      className="quiet-fade fixed inset-0 z-50 flex items-end bg-ink/18 p-3 backdrop-blur-[2px] sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="quiet-sheet classical-panel grid w-full max-w-md gap-5 rounded-md p-4 sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-paper/80 text-clay">
            <AlertTriangle size={18} />
          </span>
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line text-graphite transition hover:border-ink/40 hover:text-ink"
            aria-label={cancelLabel}
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>

        <div className="grid gap-2">
          <h2 id={titleId} className="font-serif text-3xl leading-tight">
            {title}
          </h2>
          <p id={descriptionId} className="text-sm leading-6 text-graphite">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            ref={cancelRef}
            type="button"
            className="min-h-[48px] rounded-md border border-line px-4 py-2 text-sm text-graphite transition hover:border-ink/40 hover:text-ink"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={['min-h-[48px] rounded-md border px-4 py-2 text-sm transition disabled:opacity-60', confirmClass].join(' ')}
            disabled={busy}
            onClick={() => void handleConfirm()}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
