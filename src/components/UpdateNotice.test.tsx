import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { translations } from '../i18n/translations'
import { resetAppUpdate, startAppUpdate } from '../services/appUpdate'
import { renderWithProviders } from '../test/render'
import { UpdateNotice } from './UpdateNotice'

interface RegisterOptions {
  onNeedReload?: () => void
}

const register = vi.hoisted(() => ({ options: undefined as undefined | RegisterOptions }))

vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: RegisterOptions) => {
    register.options = options
    return vi.fn()
  }
}))

const en = translations.en

function stubServiceWorker(controller: object | null) {
  const container = Object.assign(new EventTarget(), { controller })
  Object.defineProperty(navigator, 'serviceWorker', { value: container, configurable: true })
  return container
}

beforeEach(() => {
  resetAppUpdate()
  register.options = undefined
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

describe('UpdateNotice', () => {
  it('zeigt zunächst nichts', () => {
    // Arrange
    stubServiceWorker({})
    startAppUpdate()

    // Act
    renderWithProviders(<UpdateNotice />)

    // Assert
    expect(screen.queryByText(en.updateNoticeTitle)).not.toBeInTheDocument()
  })

  it('zeigt den Hinweis, wenn eine neue Version die Kontrolle übernommen hat', () => {
    // Arrange
    stubServiceWorker({})
    startAppUpdate()
    renderWithProviders(<UpdateNotice />)

    // Act
    act(() => {
      register.options?.onNeedReload?.()
    })

    // Assert
    expect(screen.getByText(en.updateNoticeTitle)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.updateNoticeAction })).toBeInTheDocument()
  })

  it('zeigt bei der Erstinstallation keinen Hinweis', () => {
    // Arrange
    const container = stubServiceWorker(null)
    startAppUpdate()
    renderWithProviders(<UpdateNotice />)

    // Act
    act(() => {
      container.dispatchEvent(new Event('controllerchange'))
    })

    // Assert
    expect(screen.queryByText(en.updateNoticeTitle)).not.toBeInTheDocument()
  })

  it('lädt erst nach Tippen auf die Aktion neu', () => {
    // Arrange
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    stubServiceWorker({})
    startAppUpdate()
    renderWithProviders(<UpdateNotice />)

    // Act
    act(() => {
      register.options?.onNeedReload?.()
    })
    const reloadedBeforeTap = reload.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: en.updateNoticeAction }))

    // Assert
    expect(reloadedBeforeTap).toBe(0)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('bleibt im normalen Fluss unter der Kopfzeile und überdeckt die Aktionsleiste nicht', () => {
    // Arrange
    stubServiceWorker({})
    startAppUpdate()
    renderWithProviders(<UpdateNotice />)

    // Act
    act(() => {
      register.options?.onNeedReload?.()
    })
    const wrapper = screen.getByText(en.updateNoticeTitle).closest('[data-update-notice]') as HTMLElement

    // Assert
    expect(wrapper).not.toBeNull()
    expect(wrapper.className).not.toContain('fixed')
    expect(wrapper.className).toContain('shrink-0')
  })

  it('kündigt sich ruhig an, ohne den Fokus zu stehlen', () => {
    // Arrange
    stubServiceWorker({})
    startAppUpdate()
    renderWithProviders(<UpdateNotice />)

    // Act
    act(() => {
      register.options?.onNeedReload?.()
    })

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(en.updateNoticeTitle)
  })
})
