import { act, fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { translations } from '../i18n/translations'
import { onboardingEventName, onboardingKey } from '../services/onboarding'
import { renderWithProviders } from '../test/render'
import { Onboarding } from './Onboarding'

const en = translations.en

describe('Onboarding', () => {
  it('zeigt beim ersten Besuch den ersten Schritt', () => {
    // Arrange / Act
    renderWithProviders(<Onboarding />)

    // Assert
    expect(screen.getByRole('heading', { name: en.onboardingTitle })).toBeInTheDocument()
  })

  it('nennt auf dem ersten Schritt Rauschen, Signal und Stille mit ihren Leitfragen', () => {
    // Arrange / Act
    renderWithProviders(<Onboarding />)

    // Assert
    expect(screen.getByText(en.onboardingNoise)).toBeInTheDocument()
    expect(screen.getByText(en.onboardingSignal)).toBeInTheDocument()
    expect(screen.getByText(en.onboardingRest)).toBeInTheDocument()
  })

  it('beschreibt die Gesten mit dem neuen Lebenszyklus statt mit Snooze', () => {
    // Arrange / Act
    renderWithProviders(<Onboarding />)

    // Assert
    expect(screen.getByText(en.onboardingGestureBody)).toBeInTheDocument()
    expect(en.onboardingGestureBody).not.toMatch(/snooze/i)
  })

  it('zeigt nichts, wenn das Onboarding bereits gesehen wurde', () => {
    // Arrange
    localStorage.setItem(onboardingKey, 'true')

    // Act
    renderWithProviders(<Onboarding />)

    // Assert
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('zeigt auf dem ersten Schritt nur einen Weiter-Button', () => {
    // Arrange / Act
    renderWithProviders(<Onboarding />)

    // Assert
    expect(screen.getAllByRole('button', { name: en.onboardingNext })).toHaveLength(1)
  })

  it('bietet auf Schritten mit eigener Aktion zusätzlich Weiter an', () => {
    // Arrange
    renderWithProviders(<Onboarding />)

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.onboardingNext }))

    // Assert
    expect(screen.getByRole('button', { name: en.onboardingTryCapture })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: en.onboardingNext })).toHaveLength(1)
  })

  it('lässt das Fenster scrollen, wenn der Inhalt höher als der Bildschirm ist', () => {
    // Arrange / Act
    renderWithProviders(<Onboarding />)

    // Assert
    const sheet = screen.getByRole('dialog')
    expect(sheet).toHaveClass('overflow-y-auto')
    expect(sheet).not.toHaveClass('overflow-hidden')
  })

  it('wechselt mit Weiter zum nächsten Schritt', () => {
    // Arrange
    renderWithProviders(<Onboarding />)

    // Act
    fireEvent.click(screen.getAllByRole('button', { name: en.onboardingNext })[0])

    // Assert
    expect(screen.getByRole('heading', { name: en.onboardingCaptureTitle })).toBeInTheDocument()
  })

  it('merkt sich das Schließen und blendet sich aus', () => {
    // Arrange
    renderWithProviders(<Onboarding />)

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.close }))

    // Assert
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(localStorage.getItem(onboardingKey)).toBe('true')
  })

  it('schließt nach dem letzten Schritt über den Abschluss-Button', () => {
    // Arrange
    renderWithProviders(<Onboarding />)
    fireEvent.click(screen.getByRole('button', { name: en.onboardingStep.replace('{current}', '4').replace('{total}', '4') }))

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.onboardingFinish }))

    // Assert
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(localStorage.getItem(onboardingKey)).toBe('true')
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
})
