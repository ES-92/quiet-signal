/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'
import {
  REMINDER_TAG,
  isAfterTime,
  localDateKey,
  readReminderConfig,
  writeReminderConfig
} from './services/reminderShared'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

// Precache the build output (injected by vite-plugin-pwa).
precacheAndRoute(self.__WB_MANIFEST)

self.skipWaiting()
clientsClaim()

// Periodic Background Sync: best-effort daily wake-up (Chromium / installed PWA).
// The browser controls the cadence, so we fire on the first sync after the
// chosen time on a day we haven't reminded yet.
self.addEventListener('periodicsync', (event: Event) => {
  const syncEvent = event as Event & { tag: string; waitUntil: (p: Promise<unknown>) => void }
  if (syncEvent.tag === REMINDER_TAG) {
    syncEvent.waitUntil(maybeShowReminder())
  }
})

// Lets the app trigger an immediate test notification from Settings.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string; title?: string; body?: string } | undefined
  if (data?.type === 'commonplace-test-reminder') {
    event.waitUntil(showReminder(data.title, data.body))
  }
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  event.waitUntil(openApp())
})

async function maybeShowReminder(): Promise<void> {
  const config = await readReminderConfig()
  if (!config?.enabled) return
  const today = localDateKey()
  if (config.lastShown === today) return
  if (!isAfterTime(config.time)) return
  await showReminder(config.title, config.body)
  await writeReminderConfig({ ...config, lastShown: today })
}

async function showReminder(title?: string, body?: string): Promise<void> {
  await self.registration.showNotification(title || 'Commonplace', {
    body: body || '',
    icon: '/pwa-192x192.svg',
    badge: '/pwa-192x192.svg',
    tag: 'commonplace-daily-reminder',
    data: { url: '/today' }
  })
}

async function openApp(): Promise<void> {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of windows) {
    if ('focus' in client) {
      await (client as WindowClient).navigate('/today').catch(() => undefined)
      await (client as WindowClient).focus()
      return
    }
  }
  await self.clients.openWindow('/today')
}
