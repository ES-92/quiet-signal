import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmSheet } from './ConfirmSheet'

function sheet(overrides: Partial<Parameters<typeof ConfirmSheet>[0]> = {}) {
  return (
    <ConfirmSheet
      open
      title="Löschen?"
      description="Das kann nicht rückgängig gemacht werden."
      confirmLabel="Ja, löschen"
      cancelLabel="Abbrechen"
      onConfirm={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />
  )
}

describe('ConfirmSheet', () => {
  it('rendert nichts, solange es geschlossen ist', () => {
    // Arrange / Act
    render(sheet({ open: false }))

    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('zeigt Titel und Beschreibung als zugänglichen Dialog, wenn es geöffnet ist', () => {
    // Arrange / Act
    render(sheet())

    // Assert
    const dialog = screen.getByRole('dialog', { name: 'Löschen?' })
    expect(dialog).toHaveAccessibleDescription('Das kann nicht rückgängig gemacht werden.')
  })

  it('fokussiert den Abbrechen-Button nach dem Öffnen', async () => {
    // Arrange
    vi.useFakeTimers()
    try {
      // Act
      render(sheet())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50)
      })

      // Assert
      const cancelButtons = screen.getAllByRole('button', { name: 'Abbrechen' })
      expect(cancelButtons[cancelButtons.length - 1]).toHaveFocus()
    } finally {
      vi.useRealTimers()
    }
  })

  it('ruft onClose bei Escape auf', () => {
    // Arrange
    const onClose = vi.fn()
    render(sheet({ onClose }))

    // Act
    fireEvent.keyDown(window, { key: 'Escape' })

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('reagiert nicht auf Escape, wenn es geschlossen ist', () => {
    // Arrange
    const onClose = vi.fn()
    render(sheet({ open: false, onClose }))

    // Act
    fireEvent.keyDown(window, { key: 'Escape' })

    // Assert
    expect(onClose).not.toHaveBeenCalled()
  })

  it('ruft onConfirm auf und sperrt den Bestätigen-Button, bis die Aktion fertig ist', async () => {
    // Arrange
    let finish: () => void = () => undefined
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    render(sheet({ onConfirm }))
    const confirm = screen.getByRole('button', { name: 'Ja, löschen' })

    // Act
    fireEvent.click(confirm)

    // Assert
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(confirm).toBeDisabled()
    await act(async () => finish())
    expect(confirm).toBeEnabled()
  })

  it('setzt den Busy-Zustand beim Schließen zurück, auch wenn die Aktion noch läuft', () => {
    // Arrange
    const onConfirm = vi.fn(() => new Promise<void>(() => undefined))
    const { rerender } = render(sheet({ onConfirm }))
    fireEvent.click(screen.getByRole('button', { name: 'Ja, löschen' }))
    expect(screen.getByRole('button', { name: 'Ja, löschen' })).toBeDisabled()

    // Act
    rerender(sheet({ onConfirm, open: false }))
    rerender(sheet({ onConfirm, open: true }))

    // Assert
    expect(screen.getByRole('button', { name: 'Ja, löschen' })).toBeEnabled()
  })
})
