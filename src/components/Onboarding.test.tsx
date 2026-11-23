import { act, fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { languages, translations } from '../i18n/translations'
import { captureEventName } from '../services/captureEvents'
import { onboardingEventName, onboardingKey } from '../services/onboarding'
import { renderWithProviders } from '../test/render'
import { Onboarding } from './Onboarding'

const en = translations.en

function next() {
  fireEvent.click(screen.getByRole('button', { name: en.onboardingNext }))
}

describe('Onboarding', () => {
  it('zeigt beim ersten Besuch den ersten Schritt', () => {
    // Arrange / Act
    renderWithProviders(<Onboarding />)

    // Assert
    expect(screen.getByRole('heading', { name: en.onboardingTitle })).toBeInTheDocument()
    expect(screen.getByText(en.onboardingBody)).toBeInTheDocument()
  })

  it('zeigt nichts, wenn das Onboarding bereits gesehen wurde', () => {
    // Arrange
    localStorage.setItem(onboardingKey, 'true')

    // Act
    renderWithProviders(<Onboarding />)

    // Assert
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('hat höchstens drei Schritte', () => {
    // Arrange / Act
    renderWithProviders(<Onboarding />)

    // Assert
    const dots = screen.getAllByRole('button', { name: /^Step \d of \d$/ })
    expect(dots.length).toBeLessThanOrEqual(3)
  })

  it('zeigt auf jedem Schritt genau einen Hauptbutton, der weiterschaltet', () => {
    // Arrange
    renderWithProviders(<Onboarding />)

    // Act / Assert
    expect(screen.getAllByRole('button', { name: en.onboardingNext })).toHaveLength(1)
    next()
    expect(screen.getAllByRole('button', { name: en.onboardingNext })).toHaveLength(1)
  })

  it('schaltet mit dem Hauptbutton auf Schritt 1 zu Schritt 2, ohne das Onboarding zu beenden', () => {
    // Arrange
    renderWithProviders(<Onboarding />)

    // Act
    next()

    // Assert
    expect(screen.getByRole('heading', { name: en.onboardingCaptureTitle })).toBeInTheDocument()
    expect(localStorage.getItem(onboardingKey)).toBeNull()
  })

  it('schaltet mit dem Hauptbutton auf Schritt 2 zu Schritt 3, ohne zu beenden, Erfassen zu öffnen oder zu navigieren', () => {
    // Arrange
    const captureListener = vi.fn()
    window.addEventListener(captureEventName, captureListener)
    renderWithProviders(<Onboarding />, { route: '/today' })
    next()

    // Act
    next()

    // Assert
    window.removeEventListener(captureEventName, captureListener)
    expect(screen.getByRole('heading', { name: en.onboardingTodayTitle })).toBeInTheDocument()
    expect(localStorage.getItem(onboardingKey)).toBeNull()
    expect(captureListener).not.toHaveBeenCalled()
  })

  it('beendet das Onboarding nur mit dem Hauptbutton des letzten Schritts', () => {
    // Arrange
    renderWithProviders(<Onboarding />)
    next()
    next()
    expect(localStorage.getItem(onboardingKey)).toBeNull()

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.onboardingFinish }))

    // Assert
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(localStorage.getItem(onboardingKey)).toBe('true')
  })

  it('bietet Überspringen auf den ersten Schritten an und beendet damit das Onboarding', () => {
    // Arrange
    renderWithProviders(<Onboarding />)

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.onboardingSkip }))

    // Assert
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(localStorage.getItem(onboardingKey)).toBe('true')
  })

  it('bietet Überspringen auch auf dem zweiten Schritt, aber nicht auf dem letzten', () => {
    // Arrange
    renderWithProviders(<Onboarding />)
    next()

    // Act / Assert
    expect(screen.getByRole('button', { name: en.onboardingSkip })).toBeInTheDocument()
    next()
    expect(screen.queryByRole('button', { name: en.onboardingSkip })).not.toBeInTheDocument()
  })

  it('merkt sich das Schließen über das Kreuz und blendet sich aus', () => {
    // Arrange
    renderWithProviders(<Onboarding />)

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.close }))

    // Assert
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(localStorage.getItem(onboardingKey)).toBe('true')
  })

  it('springt über die Fortschrittspunkte zu einem Schritt', () => {
    // Arrange
    renderWithProviders(<Onboarding />)

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Step 3 of 3' }))

    // Assert
    expect(screen.getByRole('heading', { name: en.onboardingTodayTitle })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en.onboardingFinish })).toBeInTheDocument()
  })

  it('lässt das Fenster scrollen, wenn der Inhalt höher als der Bildschirm ist', () => {
    // Arrange / Act
    renderWithProviders(<Onboarding />)

    // Assert
    const sheet = screen.getByRole('dialog')
    expect(sheet).toHaveClass('overflow-y-auto')
    expect(sheet).not.toHaveClass('overflow-hidden')
  })

  it('öffnet sich über das Onboarding-Event erneut beim ersten Schritt', () => {
    // Arrange
    localStorage.setItem(onboardingKey, 'true')
    renderWithProviders(<Onboarding />)

    // Act
    act(() => {
      window.dispatchEvent(new Event(onboardingEventName))
    })

    // Assert
    expect(screen.getByRole('heading', { name: en.onboardingTitle })).toBeInTheDocument()
  })

  it('beschreibt den Tagesstapel ohne Snooze', () => {
    // Arrange
    renderWithProviders(<Onboarding />)

    // Act
    next()
    next()

    // Assert
    expect(screen.getByText(en.onboardingTodayBody)).toBeInTheDocument()
    expect(en.onboardingTodayBody).not.toMatch(/snooze/i)
  })
})

describe('Onboarding-Texte', () => {
  const stepKeys = [
    ['onboardingBody', 'onboardingCaptureBody', 'onboardingTodayBody'],
    ['onboardingTitle', 'onboardingCaptureTitle', 'onboardingTodayTitle']
  ] as const

  it.each(languages.map((language) => language.code))('Sprache %s hält jeden Schritt bei höchstens zwei kurzen Sätzen', (code) => {
    // Arrange
    const table = translations[code] as Record<string, string>

    // Act
    const sentenceCounts = stepKeys[0].map((key) => (table[key].match(/[.!?](\s|$)/g) ?? []).length)
    const lengths = stepKeys[0].map((key) => table[key].length)

    // Assert
    expect(Math.max(...sentenceCounts)).toBeLessThanOrEqual(2)
    // Short enough for a 320 x 568 screen without scrolling.
    expect(Math.max(...lengths)).toBeLessThanOrEqual(150)
  })

  it.each(languages.map((language) => language.code))('Sprache %s hält die Titel kurz', (code) => {
    // Arrange
    const table = translations[code] as Record<string, string>

    // Act
    const lengths = stepKeys[1].map((key) => table[key].length)

    // Assert
    expect(Math.max(...lengths)).toBeLessThanOrEqual(32)
  })

  it('beschreibt Klären mit den vier Richtungen, ohne Art, Ort oder Daily-Stapel', () => {
    // Arrange
    const body = translations.de.onboardingCaptureBody

    // Act / Assert
    expect(body).toContain('→ Signal')
    expect(body).toContain('← später')
    expect(body).toContain('↑ Details')
    expect(body).toContain('↓ Stille')
    expect(body).not.toMatch(/\bArt\b|\bOrt\b|daily/i)
  })
})
