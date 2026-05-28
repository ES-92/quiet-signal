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
