import { useEffect } from 'react'
import { tapHaptic } from '../services/haptics'
import { useToastStore } from '../store/useToastStore'

const TOAST_MS = 4000

export function Toast() {
  const { toast, hideToast } = useToastStore()

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(hideToast, TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast, hideToast])

  if (!toast) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="quiet-pop fixed inset-x-0 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex w-[min(26rem,calc(100vw-1.5rem))] items-center justify-between gap-3 rounded-md border border-line bg-paper/95 px-4 py-3 text-sm text-ink shadow-[0_18px_46px_rgba(31,30,28,0.18)] backdrop-blur"
    >
      <span className="truncate">{toast.message}</span>
      {toast.actionLabel && (
        <button
          type="button"
          className="shrink-0 rounded-md border border-line px-3 py-1 text-sm text-ink transition hover:border-ink/40"
          onClick={() => {
            tapHaptic(8)
            toast.onAction?.()
            hideToast()
          }}
        >
          {toast.actionLabel}
        </button>
      )}
    </div>
  )
}
