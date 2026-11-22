import { registerSW } from 'virtual:pwa-register'

// With `skipWaiting()` + `clientsClaim()` in src/sw.ts a new version takes control on its own, but the
// open page keeps running the old code. We only tell the user and never reload by ourselves.

const CHECK_INTERVAL_MS = 60 * 60 * 1000

type Listener = () => void

const listeners = new Set<Listener>()
let updateReady = false
let started = false
let hadController = false
let checkTimer: ReturnType<typeof setInterval> | undefined
let removeVisibilityListener: (() => void) | undefined
let removeControllerListener: (() => void) | undefined

export function isUpdateReady() {
  return updateReady
}

/** Calls `listener` once an update is ready (immediately if it already is). Returns an unsubscribe function. */
export function subscribeUpdateReady(listener: Listener) {
  listeners.add(listener)
  if (updateReady) listener()
  return () => {
    listeners.delete(listener)
  }
}

export function reloadApp() {
  window.location.reload()
}

function markUpdateReady() {
  if (updateReady) return
  updateReady = true
  listeners.forEach((listener) => listener())
}

function watchForUpdates(registration: ServiceWorkerRegistration) {
  const check = () => {
    // Offline or a flaky network must never surface as an error.
    registration.update().catch(() => undefined)
  }
  checkTimer = setInterval(check, CHECK_INTERVAL_MS)
  const onVisibility = () => {
    if (document.visibilityState === 'visible') check()
  }
  document.addEventListener('visibilitychange', onVisibility)
  removeVisibilityListener = () => document.removeEventListener('visibilitychange', onVisibility)
}

/** Registers the service worker and starts watching for a newer version. Call once at startup. */
export function startAppUpdate() {
  if (started) return
  started = true

  const container = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker
  // On the very first install there is no previous controller: clientsClaim() then also fires
  // `controllerchange`, but that is no update.
  hadController = Boolean(container?.controller)
  if (container) {
    const onControllerChange = () => {
      if (hadController) markUpdateReady()
    }
    container.addEventListener('controllerchange', onControllerChange)
    removeControllerListener = () => container.removeEventListener('controllerchange', onControllerChange)
  }

  registerSW({
    // A newer worker already took over (autoUpdate mode) or is waiting (prompt mode).
    onNeedReload: markUpdateReady,
    onNeedRefresh: markUpdateReady,
    onRegisteredSW: (_url, registration) => {
      if (registration) watchForUpdates(registration)
    }
  })
}

/** Test helper: forget all state so each test starts from a fresh app start. */
export function resetAppUpdate() {
  if (checkTimer) clearInterval(checkTimer)
  removeVisibilityListener?.()
  removeControllerListener?.()
  checkTimer = undefined
  removeVisibilityListener = undefined
  removeControllerListener = undefined
  listeners.clear()
  updateReady = false
  started = false
  hadController = false
}
