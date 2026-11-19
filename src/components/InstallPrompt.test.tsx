import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { translations } from '../i18n/translations'
import { renderWithProviders } from '../test/render'
import { InstallPrompt } from './InstallPrompt'

const en = translations.en
const dismissKey = 'quiet-signal-install-dismissed'
const iosUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'

function installEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>
    userChoice: Promise<{ outcome: string }>
  }
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome })
  return event
}

beforeEach(() => {
  // jsdom has no matchMedia; report "not standalone".
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('InstallPrompt', () => {
  it('zeigt zunächst nichts', () => {
    // Arrange / Act
    renderWithProviders(<InstallPrompt />)

    // Assert
    expect(screen.queryByText(en.installTitle)).not.toBeInTheDocument()
  })

  it('zeigt den Installationshinweis nach beforeinstallprompt', () => {
    // Arrange
    renderWithProviders(<InstallPrompt />)
    const event = installEvent()

    // Act
    act(() => {
      window.dispatchEvent(event)
    })

    // Assert
    expect(screen.getByText(en.installTitle)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.installAction })).toBeInTheDocument()
    expect(event.defaultPrevented).toBe(true)
  })

  it('löst beim Installieren den gemerkten Prompt aus und blendet sich dauerhaft aus', async () => {
    // Arrange
    renderWithProviders(<InstallPrompt />)
    const event = installEvent()
    act(() => {
      window.dispatchEvent(event)
    })

    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.installAction }))
    })

    // Assert
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(en.installTitle)).not.toBeInTheDocument()
    expect(localStorage.getItem(dismissKey)).toBe('1')
  })

  it('merkt sich das Wegklicken', () => {
    // Arrange
    renderWithProviders(<InstallPrompt />)
    act(() => {
      window.dispatchEvent(installEvent())
    })

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.installDismiss }))

    // Assert
    expect(screen.queryByText(en.installTitle)).not.toBeInTheDocument()
    expect(localStorage.getItem(dismissKey)).toBe('1')
  })

  it('blendet sich nach appinstalled aus', () => {
    // Arrange
    renderWithProviders(<InstallPrompt />)
    act(() => {
      window.dispatchEvent(installEvent())
    })

    // Act
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })

    // Assert
    expect(screen.queryByText(en.installTitle)).not.toBeInTheDocument()
    expect(localStorage.getItem(dismissKey)).toBe('1')
  })

  it('reagiert nicht, wenn der Hinweis zuvor weggeklickt wurde', () => {
    // Arrange
    localStorage.setItem(dismissKey, '1')
    renderWithProviders(<InstallPrompt />)

    // Act
    act(() => {
      window.dispatchEvent(installEvent())
    })

    // Assert
    expect(screen.queryByText(en.installTitle)).not.toBeInTheDocument()
  })

  it('reagiert nicht, wenn die App bereits als Standalone läuft', () => {
    // Arrange
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    renderWithProviders(<InstallPrompt />)

    // Act
    act(() => {
      window.dispatchEvent(installEvent())
    })

    // Assert
    expect(screen.queryByText(en.installTitle)).not.toBeInTheDocument()
  })

  it('zeigt auf iOS Safari den manuellen Hinweis ohne Installieren-Button', () => {
    // Arrange
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(iosUserAgent)

    // Act
    renderWithProviders(<InstallPrompt />)

    // Assert
    expect(screen.getByText(en.installIosHint)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en.installAction })).not.toBeInTheDocument()
  })
})
