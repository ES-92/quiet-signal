import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { translations } from '../i18n/translations'
import { firstUseKey } from '../services/firstUse'
import { onboardingKey } from '../services/onboarding'
import { renderWithProviders } from '../test/render'
import { InstallPrompt } from './InstallPrompt'
import { Onboarding } from './Onboarding'

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
  // Day 1 is 22 Nov 2026; most tests start on day 2 with onboarding long finished.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 23, 10, 0))
  localStorage.setItem(firstUseKey, '2026-11-22')
  localStorage.setItem(onboardingKey, 'true')
})

afterEach(() => {
  vi.useRealTimers()
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

  it('lässt den iOS-Hinweis vollständig umbrechen und überdeckt die Aktionsleiste nicht', () => {
    // Arrange
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(iosUserAgent)
    renderWithProviders(<InstallPrompt />)

    // Act
    const hint = screen.getByText(en.installIosHint)

    // Assert
    expect(hint.className).not.toContain('truncate')
    expect(hint.className).toContain('break-words')
    // In normal flow below the header: nothing is overlaid, so the Today action bar stays reachable.
    const wrapper = hint.closest('[data-install-prompt]') as HTMLElement
    expect(wrapper).not.toBeNull()
    expect(wrapper.className).not.toContain('fixed')
    expect(wrapper.className).toContain('shrink-0')
  })

  describe('erst ab dem zweiten Nutzungstag', () => {
    it('merkt sich beim ersten Start das Datum der ersten Nutzung', () => {
      // Arrange
      localStorage.removeItem(firstUseKey)

      // Act
      renderWithProviders(<InstallPrompt />)

      // Assert
      expect(localStorage.getItem(firstUseKey)).toBe('2026-11-23')
    })

    it('überschreibt das Datum der ersten Nutzung nicht', () => {
      // Arrange / Act
      renderWithProviders(<InstallPrompt />)

      // Assert
      expect(localStorage.getItem(firstUseKey)).toBe('2026-11-22')
    })

    it('zeigt am ersten Tag nichts, auch wenn der Browser die Installation anbietet', () => {
      // Arrange
      localStorage.removeItem(firstUseKey)
      renderWithProviders(<InstallPrompt />)
      const event = installEvent()

      // Act
      act(() => {
        window.dispatchEvent(event)
      })

      // Assert
      expect(screen.queryByText(en.installTitle)).not.toBeInTheDocument()
    })

    it('zeigt am ersten Tag auch den iOS-Hinweis nicht', () => {
      // Arrange
      localStorage.removeItem(firstUseKey)
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(iosUserAgent)

      // Act
      renderWithProviders(<InstallPrompt />)

      // Assert
      expect(screen.queryByText(en.installIosHint)).not.toBeInTheDocument()
    })

    it('zeigt am Abend des ersten Tages noch nichts', () => {
      // Arrange
      localStorage.setItem(firstUseKey, '2026-11-23')
      vi.setSystemTime(new Date(2026, 10, 23, 23, 59))
      renderWithProviders(<InstallPrompt />)

      // Act
      act(() => {
        window.dispatchEvent(installEvent())
      })

      // Assert
      expect(screen.queryByText(en.installTitle)).not.toBeInTheDocument()
    })

    it('zeigt den Hinweis, sobald der zweite Kalendertag beginnt', () => {
      // Arrange
      localStorage.setItem(firstUseKey, '2026-11-23')
      vi.setSystemTime(new Date(2026, 10, 23, 23, 59))
      renderWithProviders(<InstallPrompt />)
      act(() => {
        window.dispatchEvent(installEvent())
      })

      // Act
      vi.setSystemTime(new Date(2026, 10, 24, 0, 1))
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })

      // Assert
      expect(screen.getByText(en.installTitle)).toBeInTheDocument()
    })

    it('zeigt den Hinweis beim nächsten Start am zweiten Tag', () => {
      // Arrange
      localStorage.setItem(firstUseKey, '2026-11-23')
      const first = renderWithProviders(<InstallPrompt />)
      first.unmount()
      vi.setSystemTime(new Date(2026, 10, 24, 9, 0))

      // Act
      renderWithProviders(<InstallPrompt />)
      act(() => {
        window.dispatchEvent(installEvent())
      })

      // Assert
      expect(screen.getByText(en.installTitle)).toBeInTheDocument()
    })

    it('zeigt auf iOS Safari den manuellen Hinweis am zweiten Tag', () => {
      // Arrange
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(iosUserAgent)

      // Act
      renderWithProviders(<InstallPrompt />)

      // Assert
      expect(screen.getByText(en.installIosHint)).toBeInTheDocument()
    })
  })

  describe('nie während der Einführung', () => {
    it('hält den Hinweis zurück, solange die Einführung offen ist, und zeigt ihn danach', () => {
      // Arrange
      localStorage.removeItem(onboardingKey)
      renderWithProviders(
        <>
          <InstallPrompt />
          <Onboarding />
        </>
      )

      // Act
      act(() => {
        window.dispatchEvent(installEvent())
      })

      // Assert
      expect(screen.queryByText(en.installTitle)).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: en.onboardingSkip }))
      expect(screen.getByText(en.installTitle)).toBeInTheDocument()
    })

    it('zeigt den iOS-Hinweis nicht über der Einführung', () => {
      // Arrange
      localStorage.removeItem(onboardingKey)
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(iosUserAgent)

      // Act
      renderWithProviders(
        <>
          <InstallPrompt />
          <Onboarding />
        </>
      )

      // Assert
      expect(screen.queryByText(en.installIosHint)).not.toBeInTheDocument()
    })
  })
})
