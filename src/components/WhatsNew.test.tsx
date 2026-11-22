import { fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { translations } from '../i18n/translations'
import { APP_VERSION, releaseNotes } from '../services/release'
import { renderWithProviders } from '../test/render'
import { WhatsNew } from './WhatsNew'

const en = translations.en
const versionKey = 'quiet-signal-last-seen-version'

describe('WhatsNew', () => {
  const originalNotes = [...releaseNotes]
  afterEach(() => {
    releaseNotes.splice(0, releaseNotes.length, ...originalNotes)
  })

  it('zeigt bei einem Versionssprung ohne Release-Notes kein leeres Sheet und merkt sich die Version', () => {
    // Arrange
    releaseNotes.splice(0)
    localStorage.setItem(versionKey, '0.1.0')

    // Act
    renderWithProviders(<WhatsNew onSupport={vi.fn()} />)

    // Assert
    expect(screen.queryByText(en.whatsNewTitle)).not.toBeInTheDocument()
    expect(localStorage.getItem(versionKey)).toBe(APP_VERSION)
  })

  it('zeigt die Release-Notes, wenn die zuletzt gesehene Version älter ist', () => {
    // Arrange
    localStorage.setItem(versionKey, '0.1.0')

    // Act
    renderWithProviders(<WhatsNew onSupport={vi.fn()} />)

    // Assert
    expect(screen.getByText(en.whatsNewTitle)).toBeInTheDocument()
    expect(screen.getByText(en.release020Gestures)).toBeInTheDocument()
    expect(screen.getByText(en.release020Onboarding)).toBeInTheDocument()
  })

  it('zeigt für eine Nutzerin, die zuletzt 0.3.0 gesehen hat, die Notizen zu 0.4.0', () => {
    // Arrange
    localStorage.setItem(versionKey, '0.3.0')

    // Act
    renderWithProviders(<WhatsNew onSupport={vi.fn()} />)

    // Assert
    expect(screen.getByText(en.whatsNewTitle)).toBeInTheDocument()
    expect(screen.getByText(en.release040Gestures)).toBeInTheDocument()
    expect(screen.getByText(en.release040Thoughts)).toBeInTheDocument()
    expect(screen.getByText(en.release040Rest)).toBeInTheDocument()
    expect(screen.getByText(en.release040Favourites)).toBeInTheDocument()
    expect(screen.getByText(en.release040Calmer)).toBeInTheDocument()
    expect(screen.getByText(en.release040Updates)).toBeInTheDocument()
    expect(screen.queryByText(en.release030Daily)).not.toBeInTheDocument()
  })

  it('blendet sich nach dem Schließen aus und merkt sich die aktuelle Version', () => {
    // Arrange
    localStorage.setItem(versionKey, '0.1.0')
    renderWithProviders(<WhatsNew onSupport={vi.fn()} />)

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.close }))

    // Assert
    expect(screen.queryByText(en.whatsNewTitle)).not.toBeInTheDocument()
    expect(localStorage.getItem(versionKey)).toBe(APP_VERSION)
  })

  it('ruft beim Support-Button onSupport auf und schließt den Hinweis', () => {
    // Arrange
    localStorage.setItem(versionKey, '0.1.0')
    const onSupport = vi.fn()
    renderWithProviders(<WhatsNew onSupport={onSupport} />)

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.whatsNewSupportLine }))

    // Assert
    expect(onSupport).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(en.whatsNewTitle)).not.toBeInTheDocument()
  })

  it('zeigt bei der Erstinstallation nichts und merkt sich die Version', () => {
    // Arrange (kein gespeicherter Versionsstand)

    // Act
    renderWithProviders(<WhatsNew onSupport={vi.fn()} />)

    // Assert
    expect(screen.queryByText(en.whatsNewTitle)).not.toBeInTheDocument()
    expect(localStorage.getItem(versionKey)).toBe(APP_VERSION)
  })

  it('zeigt nichts, wenn die aktuelle Version bereits gesehen wurde', () => {
    // Arrange
    localStorage.setItem(versionKey, APP_VERSION)

    // Act
    renderWithProviders(<WhatsNew onSupport={vi.fn()} />)

    // Assert
    expect(screen.queryByText(en.whatsNewTitle)).not.toBeInTheDocument()
  })
})
