import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { translations } from '../i18n/translations'
import { renderWithProviders } from '../test/render'
import { chunkReloadStorageKey, isChunkLoadError, reloadOnceForChunkError } from '../services/chunkReload'
import { ErrorBoundary } from './ErrorBoundary'

const en = translations.en
const reload = vi.fn()

function Boom({ error }: { error: Error }): never {
  throw error
}

beforeEach(() => {
  sessionStorage.clear()
  reload.mockReset()
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload },
    configurable: true,
    writable: true
  })
  // React logs caught render errors; keep the test output quiet.
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('zeigt bei einem Renderfehler einen ruhigen Hinweis mit Neu-laden-Knopf', () => {
    // Arrange / Act
    renderWithProviders(
      <ErrorBoundary>
        <Boom error={new RangeError('Invalid time value')} />
      </ErrorBoundary>
    )

    // Assert
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(en.errorBoundaryTitle)).toBeInTheDocument()
    expect(screen.getByText(en.errorBoundaryBody)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: en.errorBoundaryAction }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('zeigt den Hinweis auch ohne I18nProvider (Wurzel-Boundary)', () => {
    // Arrange
    localStorage.setItem('quiet-signal-language', 'de')

    // Act
    render(
      <ErrorBoundary>
        <Boom error={new Error('kaputt')} />
      </ErrorBoundary>
    )

    // Assert
    expect(screen.getByText(translations.de.errorBoundaryTitle)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: translations.de.errorBoundaryAction })).toBeInTheDocument()
    localStorage.removeItem('quiet-signal-language')
  })

  it('rendert die Kinder unverändert, solange nichts schiefgeht', () => {
    renderWithProviders(
      <ErrorBoundary>
        <p>alles gut</p>
      </ErrorBoundary>
    )
    expect(screen.getByText('alles gut')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lädt bei einem Chunk-Ladefehler einmal automatisch neu', () => {
    // Act
    renderWithProviders(
      <ErrorBoundary>
        <Boom error={new TypeError('Failed to fetch dynamically imported module: https://x/assets/Page-abc.js')} />
      </ErrorBoundary>
    )

    // Assert
    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(chunkReloadStorageKey)).not.toBeNull()
  })

  it('lädt nach einem gerade erfolgten automatischen Neuladen nicht erneut (keine Schleife)', () => {
    // Arrange
    sessionStorage.setItem(chunkReloadStorageKey, String(Date.now()))

    // Act
    renderWithProviders(
      <ErrorBoundary>
        <Boom error={new TypeError('Importing a module script failed.')} />
      </ErrorBoundary>
    )

    // Assert
    expect(reload).not.toHaveBeenCalled()
    expect(screen.getByText(en.errorBoundaryTitle)).toBeInTheDocument()
  })

  it('lädt bei gewöhnlichen Fehlern nicht automatisch neu', () => {
    renderWithProviders(
      <ErrorBoundary>
        <Boom error={new Error('Invalid time value')} />
      </ErrorBoundary>
    )
    expect(reload).not.toHaveBeenCalled()
  })

  it.each([
    ['Failed to fetch dynamically imported module: /a.js', true],
    ['Importing a module script failed.', true],
    ['error loading dynamically imported module: /a.js', true],
    ['Invalid time value', false]
  ])('erkennt Chunk-Ladefehler: %s → %s', (message, expected) => {
    expect(isChunkLoadError(new Error(message))).toBe(expected)
  })
})

describe('reloadOnceForChunkError', () => {
  const chunkError = new TypeError('Failed to fetch dynamically imported module: /a.js')

  it('behandelt einen Zeitstempel in der Zukunft (Uhr verstellt) als abgelaufen', () => {
    // Arrange
    const now = 1_000_000_000_000
    sessionStorage.setItem(chunkReloadStorageKey, String(now + 5 * 60_000))

    // Act
    const reloaded = reloadOnceForChunkError(chunkError, now)

    // Assert
    expect(reloaded).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(chunkReloadStorageKey)).toBe(String(now))
  })

  it('lädt innerhalb des Fensters nach einem Neuladen nicht erneut', () => {
    const now = 1_000_000_000_000
    sessionStorage.setItem(chunkReloadStorageKey, String(now - 1000))
    expect(reloadOnceForChunkError(chunkError, now)).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})
