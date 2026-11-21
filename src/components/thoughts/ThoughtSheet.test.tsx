import { act, fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { translations } from '../../i18n/translations'
import { renderWithProviders } from '../../test/render'
import { ThoughtSheet } from './ThoughtSheet'

const en = translations.en

describe('ThoughtSheet', () => {
  it('disables saving while the text is blank', () => {
    // Arrange
    renderWithProviders(<ThoughtSheet thoughts={[]} onSave={vi.fn()} onClose={vi.fn()} />)

    // Act
    fireEvent.change(screen.getByPlaceholderText(en.thoughtPlaceholder), { target: { value: '   ' } })

    // Assert
    expect(screen.getByRole('button', { name: en.save })).toBeDisabled()
  })

  it('saves the trimmed text', () => {
    // Arrange
    const onSave = vi.fn()
    renderWithProviders(<ThoughtSheet thoughts={[]} onSave={onSave} onClose={vi.fn()} />)

    // Act
    fireEvent.change(screen.getByPlaceholderText(en.thoughtPlaceholder), { target: { value: '  Ein Gedanke ' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))

    // Assert
    expect(onSave).toHaveBeenCalledExactlyOnceWith('Ein Gedanke')
  })

  it('focuses the text field and lists existing thoughts newest first', () => {
    // Arrange / Act
    renderWithProviders(
      <ThoughtSheet
        thoughts={[
          { id: 'b', text: 'Neu', createdAt: '2026-08-01T10:00:00.000Z' },
          { id: 'a', text: 'Alt', createdAt: '2026-01-01T10:00:00.000Z' }
        ]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    )

    // Assert
    expect(screen.getByPlaceholderText(en.thoughtPlaceholder)).toHaveFocus()
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Neu'),
      expect.stringContaining('Alt')
    ])
  })

  it('closes on cancel, Escape and backdrop click', () => {
    // Arrange
    const onClose = vi.fn()
    const { container } = renderWithProviders(<ThoughtSheet thoughts={[]} onSave={vi.fn()} onClose={onClose} />)

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.cancel }))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(container.firstElementChild as HTMLElement)

    // Assert
    expect(onClose).toHaveBeenCalledTimes(3)
  })
  it('ignores further saves while onSave is pending', async () => {
    // Arrange
    let resolve: () => void = () => {}
    const onSave = vi.fn(() => new Promise<void>((done) => (resolve = done)))
    renderWithProviders(<ThoughtSheet thoughts={[]} onSave={onSave} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(en.thoughtPlaceholder), { target: { value: 'Gedanke' } })

    // Act
    fireEvent.click(screen.getByRole('button', { name: en.save }))
    fireEvent.submit(screen.getByRole('dialog'))

    // Assert
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: en.save })).toBeDisabled()
    await act(async () => resolve())
    expect(screen.getByRole('button', { name: en.save })).toBeEnabled()
  })

  it('is modal and restores focus to the previously focused element on close', () => {
    // Arrange
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()

    // Act
    const { unmount } = renderWithProviders(<ThoughtSheet thoughts={[]} onSave={vi.fn()} onClose={vi.fn()} />)
    const modal = screen.getByRole('dialog').getAttribute('aria-modal')
    unmount()

    // Assert
    expect(modal).toBe('true')
    expect(opener).toHaveFocus()
    opener.remove()
  })
})
