import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface RegisterOptions {
  onNeedRefresh?: () => void
  onNeedReload?: () => void
  onRegisteredSW?: (url: string, registration: ServiceWorkerRegistration | undefined) => void
}

const register = vi.hoisted(() => ({ registerSW: vi.fn(), options: undefined as undefined | RegisterOptions }))

vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: RegisterOptions) => {
    register.options = options
    register.registerSW(options)
    return vi.fn()
  }
}))

import { isUpdateReady, reloadApp, resetAppUpdate, startAppUpdate, subscribeUpdateReady } from './appUpdate'

class FakeServiceWorkerContainer extends EventTarget {
  controller: object | null
  constructor(controller: object | null) {
    super()
    this.controller = controller
  }
}

function stubServiceWorker(controller: object | null) {
  const container = new FakeServiceWorkerContainer(controller)
  Object.defineProperty(navigator, 'serviceWorker', { value: container, configurable: true })
  return container
}

beforeEach(() => {
  resetAppUpdate()
  register.registerSW.mockClear()
  register.options = undefined
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

describe('startAppUpdate', () => {
  it('registriert den Service Worker über das PWA-Register-Modul', () => {
    // Arrange
    stubServiceWorker({})

    // Act
    startAppUpdate()

    // Assert
    expect(register.registerSW).toHaveBeenCalledTimes(1)
  })

  it('meldet kein Update direkt nach dem Start', () => {
    // Arrange
    stubServiceWorker({})

    // Act
    startAppUpdate()

    // Assert
    expect(isUpdateReady()).toBe(false)
  })

  it('meldet ein Update, wenn eine neue Version die Kontrolle übernommen hat', () => {
    // Arrange
    stubServiceWorker({})
    const listener = vi.fn()
    subscribeUpdateReady(listener)
    startAppUpdate()

    // Act
    register.options?.onNeedReload?.()

    // Assert
    expect(isUpdateReady()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('meldet ein Update, wenn eine neue Version wartet', () => {
    // Arrange
    stubServiceWorker({})
    startAppUpdate()

    // Act
    register.options?.onNeedRefresh?.()

    // Assert
    expect(isUpdateReady()).toBe(true)
  })

  it('meldet ein Update bei einem Controller-Wechsel, wenn es vorher einen Controller gab', () => {
    // Arrange
    const container = stubServiceWorker({})
    startAppUpdate()

    // Act
    container.dispatchEvent(new Event('controllerchange'))

    // Assert
    expect(isUpdateReady()).toBe(true)
  })

  it('meldet bei der Erstinstallation (kein vorheriger Controller) nichts', () => {
    // Arrange
    const container = stubServiceWorker(null)
    startAppUpdate()

    // Act
    container.dispatchEvent(new Event('controllerchange'))

    // Assert
    expect(isUpdateReady()).toBe(false)
  })

  it('benachrichtigt Hörer nur einmal, auch wenn mehrere Signale eintreffen', () => {
    // Arrange
    const container = stubServiceWorker({})
    const listener = vi.fn()
    subscribeUpdateReady(listener)
    startAppUpdate()

    // Act
    register.options?.onNeedReload?.()
    container.dispatchEvent(new Event('controllerchange'))
    register.options?.onNeedRefresh?.()

    // Assert
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('informiert spät registrierte Hörer sofort, wenn das Update schon bereitliegt', () => {
    // Arrange
    stubServiceWorker({})
    startAppUpdate()
    register.options?.onNeedReload?.()
    const listener = vi.fn()

    // Act
    subscribeUpdateReady(listener)

    // Assert
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('hört nach dem Abmelden nicht mehr zu', () => {
    // Arrange
    stubServiceWorker({})
    const listener = vi.fn()
    const unsubscribe = subscribeUpdateReady(listener)
    startAppUpdate()

    // Act
    unsubscribe()
    register.options?.onNeedReload?.()

    // Assert
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('Update-Prüfung bei geöffneter App', () => {
  function registration() {
    return { update: vi.fn().mockResolvedValue(undefined) } as unknown as ServiceWorkerRegistration & { update: ReturnType<typeof vi.fn> }
  }

  it('prüft stündlich auf eine neue Version', () => {
    // Arrange
    vi.useFakeTimers()
    stubServiceWorker({})
    const reg = registration()
    startAppUpdate()
    register.options?.onRegisteredSW?.('/sw.js', reg)

    // Act
    vi.advanceTimersByTime(60 * 60 * 1000)
    vi.advanceTimersByTime(60 * 60 * 1000)

    // Assert
    expect(reg.update).toHaveBeenCalledTimes(2)
  })

  it('prüft, wenn die App wieder sichtbar wird, aber nicht beim Ausblenden', () => {
    // Arrange
    stubServiceWorker({})
    const reg = registration()
    startAppUpdate()
    register.options?.onRegisteredSW?.('/sw.js', reg)
    const visibility = vi.spyOn(document, 'visibilityState', 'get')

    // Act
    visibility.mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    // Assert
    expect(reg.update).toHaveBeenCalledTimes(1)
  })

  it('fängt Fehler der Prüfung ab, etwa ohne Netz', () => {
    // Arrange
    stubServiceWorker({})
    const pending = Promise.reject(new Error('offline'))
    const catchSpy = vi.spyOn(pending, 'catch')
    const reg = { update: vi.fn().mockReturnValue(pending) } as unknown as ServiceWorkerRegistration
    startAppUpdate()
    register.options?.onRegisteredSW?.('/sw.js', reg)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')

    // Act
    document.dispatchEvent(new Event('visibilitychange'))

    // Assert
    expect(catchSpy).toHaveBeenCalledTimes(1)
  })
})

describe('reloadApp', () => {
  it('lädt die Seite neu', () => {
    // Arrange
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })

    // Act
    reloadApp()

    // Assert
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
