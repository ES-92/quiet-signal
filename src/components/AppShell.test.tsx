import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { db } from '../db/database'
import { I18nProvider } from '../i18n/I18nProvider'
import { translations } from '../i18n/translations'
import { captureEventName } from '../services/captureEvents'
import { onboardingKey } from '../services/onboarding'
import { AppShell } from './AppShell'

const en = translations.en

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname + location.search}</p>
}

function renderShell(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <I18nProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<LocationProbe />} />
            <Route path="/today" element={<LocationProbe />} />
            <Route path="/inbox" element={<LocationProbe />} />
          </Route>
        </Routes>
      </I18nProvider>
    </MemoryRouter>
  )
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  // Keep the first-run onboarding overlay out of the way.
  localStorage.setItem(onboardingKey, 'true')
  // jsdom has no matchMedia (used by InstallPrompt); report "not standalone".
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AppShell', () => {
  it('rendert die Seite im Outlet mit Menü-Button und geschlossenem Capture-Sheet', async () => {
    // Arrange / Act
    renderShell('/today')

    // Assert
    expect(await screen.findByTestId('location')).toHaveTextContent('/today')
    expect(screen.getByRole('button', { name: en.openCommandMenu })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('öffnet das Capture-Sheet im Foto-Modus über ?capture=photo und bereinigt die URL', async () => {
    // Arrange / Act
    renderShell('/today?capture=photo')

    // Assert
    expect(await screen.findByRole('button', { name: en.photoNote })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/today$/))
  })

  it('ignoriert ungültige capture-Parameter', async () => {
    // Arrange / Act
    renderShell('/today?capture=bogus')

    // Assert
    expect(await screen.findByTestId('location')).toHaveTextContent('/today?capture=bogus')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('öffnet das Capture-Sheet im angeforderten Modus über das Capture-Event', async () => {
    // Arrange
    renderShell('/inbox')
    await screen.findByTestId('location')

    // Act
    act(() => {
      window.dispatchEvent(new CustomEvent(captureEventName, { detail: { mode: 'audio' } }))
    })

    // Assert
    expect(screen.getByRole('button', { name: en.voiceNote })).toHaveAttribute('aria-pressed', 'true')
  })

  it.each(['/today', '/inbox'])('zeigt auf %s keinen Unterstützen-Button im Kopf', async (route) => {
    // Arrange / Act
    renderShell(route)

    // Assert
    await screen.findByTestId('location')
    expect(screen.queryByRole('button', { name: 'Support' })).not.toBeInTheDocument()
  })

  it('öffnet über das Command-Menü das Unterstützungs-Sheet mit Ko-fi und PayPal', async () => {
    // Arrange
    renderShell('/inbox')
    await screen.findByTestId('location')

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.openCommandMenu }))

    fireEvent.click(screen.getByRole('button', { name: en.supportProjectAction }))

    // Assert
    expect(screen.getByRole('link', { name: /PayPal/ })).toHaveAttribute('href', 'https://paypal.me/ErikSchroeder92')
    expect(screen.getByRole('link', { name: /Ko-fi/ })).toBeInTheDocument()
  })

  it('öffnet das Command-Menü per Button und per Strg+K', async () => {
    // Arrange
    renderShell('/inbox')
    await screen.findByTestId('location')

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.openCommandMenu }))

    // Assert
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
