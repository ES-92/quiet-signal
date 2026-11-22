import { create } from 'zustand'

interface ToastPayload {
  message: string
  actionLabel?: string
  onAction?: () => void
}

interface ToastStore {
  toast: (ToastPayload & { id: number }) | null
  showToast: (payload: ToastPayload) => void
  hideToast: () => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toast: null,
  showToast: (payload) => set({ toast: { ...payload, id: Date.now() } }),
  hideToast: () => set({ toast: null })
}))

// An undo toast of an earlier action would act on a card that is no longer where it was; the next deck action dismisses it.
export function dismissUndoToast() {
  const { toast, hideToast } = useToastStore.getState()
  if (toast?.onAction) hideToast()
}
