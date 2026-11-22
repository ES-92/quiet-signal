import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { translations } from '../../i18n/translations'
import { renderWithProviders } from '../../test/render'
import { ThoughtList } from './ThoughtList'

const en = translations.en
const thoughts = [{ id: 'th-1', text: 'Erster Gedanke', createdAt: '2026-01-02T09:00:00.000Z' }]

describe('ThoughtList', () => {
  it('labels the edit field and the remove button with dedicated texts', () => {
    // Arrange / Act
    renderWithProviders(<ThoughtList thoughts={thoughts} onEdit={vi.fn()} onRemove={vi.fn()} />)

    // Assert
    expect(screen.getByLabelText(en.editThought)).toHaveValue('Erster Gedanke')
    expect(screen.getByRole('button', { name: en.removeThought })).toBeInTheDocument()
  })

  it('saves a changed, trimmed value on blur', () => {
    // Arrange
    const onEdit = vi.fn()
    renderWithProviders(<ThoughtList thoughts={thoughts} onEdit={onEdit} />)
    const input = screen.getByLabelText(en.editThought)

    // Act
    fireEvent.change(input, { target: { value: '  Neu ' } })
    fireEvent.blur(input)

    // Assert
    expect(onEdit).toHaveBeenCalledExactlyOnceWith('th-1', 'Neu')
  })

  it.each([
    ['empty', '   '],
    ['unchanged', ' Erster Gedanke ']
  ])('reverts and does not save when the value is %s', (_name, value) => {
    // Arrange
    const onEdit = vi.fn()
    renderWithProviders(<ThoughtList thoughts={thoughts} onEdit={onEdit} />)
    const input = screen.getByLabelText(en.editThought)

    // Act
    fireEvent.change(input, { target: { value } })
    fireEvent.blur(input)

    // Assert
    expect(onEdit).not.toHaveBeenCalled()
    expect(input).toHaveValue('Erster Gedanke')
  })

  it('edits in a textarea so line breaks survive', () => {
    // Arrange
    const onEdit = vi.fn()
    renderWithProviders(<ThoughtList thoughts={thoughts} onEdit={onEdit} />)
    const field = screen.getByLabelText(en.editThought)

    // Act
    fireEvent.change(field, { target: { value: 'Zeile 1\nZeile 2' } })
    fireEvent.blur(field)

    // Assert
    expect(field.tagName).toBe('TEXTAREA')
    expect(onEdit).toHaveBeenCalledExactlyOnceWith('th-1', 'Zeile 1\nZeile 2')
  })

  it('gives the remove button a touch target of at least 44px', () => {
    // Arrange / Act
    renderWithProviders(<ThoughtList thoughts={thoughts} onRemove={vi.fn()} />)

    // Assert
    const button = screen.getByRole('button', { name: en.removeThought })
    expect(button).toHaveClass('min-h-[44px]', 'min-w-[44px]')
  })
})
