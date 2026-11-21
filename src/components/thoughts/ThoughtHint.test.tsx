import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { translations } from '../../i18n/translations'
import { renderWithProviders } from '../../test/render'
import type { Thought } from '../../types/quote'
import { ThoughtHint } from './ThoughtHint'

const now = new Date('2026-11-21T12:00:00+01:00')

function thought(id: string, text: string, createdAt: string, fromNote?: boolean): Thought {
  return { id, text, createdAt, ...(fromNote ? { fromNote } : {}) }
}

beforeEach(() => {
  localStorage.setItem('quiet-signal-language', 'de')
})

describe('ThoughtHint', () => {
  it('renders nothing without thoughts', () => {
    // Arrange / Act
    const { container } = renderWithProviders(<ThoughtHint thoughts={[]} now={now} />)

    // Assert
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the newest thought with a relative date and the extra count', () => {
    // Arrange
    const thoughts = [
      thought('a', 'Älter', '2026-05-01T10:00:00.000Z'),
      thought('b', 'Jüngster', '2026-08-21T10:00:00.000Z'),
      thought('c', 'Mitte', '2026-06-21T10:00:00.000Z')
    ]

    // Act
    renderWithProviders(<ThoughtHint thoughts={thoughts} now={now} />)

    // Assert
    expect(screen.getByText(/vor 3 Monaten: Jüngster/)).toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('expands to all thoughts, newest first, and collapses again', () => {
    // Arrange
    const thoughts = [
      thought('a', 'Älter', '2026-05-01T10:00:00.000Z'),
      thought('b', 'Jüngster', '2026-08-21T10:00:00.000Z', true)
    ]
    renderWithProviders(<ThoughtHint thoughts={thoughts} now={now} />)

    // Act
    fireEvent.click(screen.getByRole('button'))

    // Assert
    const items = screen.getAllByRole('listitem').map((item) => item.textContent ?? '')
    expect(items).toHaveLength(2)
    expect(items[0]).toContain('Jüngster')
    expect(items[0]).toContain(translations.de.fromNote)
    expect(items[1]).toContain('Älter')
    fireEvent.click(screen.getByRole('button', { expanded: true }))
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('does not start a swipe when pressed', () => {
    // Arrange
    const onPointerDown = vi.fn()
    renderWithProviders(
      <div onPointerDown={onPointerDown}>
        <ThoughtHint thoughts={[thought('a', 'X', '2026-11-21T10:00:00.000Z')]} now={now} />
      </div>
    )

    // Act
    fireEvent.pointerDown(screen.getByRole('button'))

    // Assert
    expect(onPointerDown).not.toHaveBeenCalled()
  })
})
