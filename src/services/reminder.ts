import { REMINDER_TAG, readReminderConfig, writeReminderConfig } from './reminderShared'

export interface ReminderText {
  time: string
  title: string
  body: string
}

export interface EnableResult {
  ok: boolean
  permission: NotificationPermission
  /** Whether a true background (Periodic Sync) reminder could be registered. */
  background: boolean
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
}

export function notificationPermission(): NotificationPermission {
  return isNotificationSupported() ? Notification.permission : 'denied'
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

async function registerPeriodicSync(): Promise<boolean> {
  try {
    const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> }
    }
    if (!registration.periodicSync) return false
    const status = await navigator.permissions
      ?.query({ name: 'periodic-background-sync' as PermissionName })
      .catch(() => null)
    if (status && status.state === 'denied') return false
    await registration.periodicSync.register(REMINDER_TAG, { minInterval: 12 * 60 * 60 * 1000 })
    return true
  } catch {
    return false
  }
}

async function unregisterPeriodicSync(): Promise<void> {
  try {
    const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      periodicSync?: { unregister: (tag: string) => Promise<void> }
    }
    await registration.periodicSync?.unregister(REMINDER_TAG)
  } catch {
    /* not supported — nothing to clean up */
  }
}

export async function enableReminder(text: ReminderText): Promise<EnableResult> {
  const permission = await requestNotificationPermission()
  if (permission !== 'granted') return { ok: false, permission, background: false }
  await writeReminderConfig({ enabled: true, ...text })
  const background = await registerPeriodicSync()
  return { ok: true, permission, background }
}

export async function disableReminder(): Promise<void> {
  const existing = await readReminderConfig()
  if (existing) await writeReminderConfig({ ...existing, enabled: false })
  await unregisterPeriodicSync()
}

/** Refresh the cached text/time without re-prompting (e.g. on language change). */
export async function refreshReminderConfig(text: ReminderText): Promise<void> {
  const existing = await readReminderConfig()
  if (!existing?.enabled) return
  await writeReminderConfig({ enabled: true, lastShown: existing.lastShown, ...text })
}

export async function sendTestReminder(title: string, body: string): Promise<boolean> {
  if (notificationPermission() !== 'granted') return false
  try {
    const registration = await navigator.serviceWorker.ready
    if (registration.active) {
      registration.active.postMessage({ type: 'quiet-signal-test-reminder', title, body })
      return true
    }
    await registration.showNotification(title, { body, icon: '/pwa-192x192.svg' })
    return true
  } catch {
    return false
  }
}
