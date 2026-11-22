import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { translations } from '../i18n/translations'
import { makeQuote, resetFactories } from '../test/factories'
import { renderWithProviders } from '../test/render'
import { QuoteCard } from './QuoteCard'

const en = translations.en

beforeEach(() => {
  resetFactories()
})

describe('QuoteCard', () => {
  it('zeigt bei Stille „ruht“ statt eines Statusbadges', () => {
    // Arrange
    const quote = makeQuote({ status: 'rest' })

    // Act
    renderWithProviders(<QuoteCard quote={quote} />)

    // Assert
    expect(screen.getByText(en.cardResting)).toBeInTheDocument()
    expect(screen.queryByText(en.entryStatus_rest)).not.toBeInTheDocument()
  })

  it('zeigt die Zahl der Gedanken im Plural', () => {
    // Arrange
    const thoughts = [1, 2, 3].map((n) => ({ id: `t-${n}`, text: `G${n}`, createdAt: '2026-02-01T09:00:00.000Z' }))

    // Act
    renderWithProviders(<QuoteCard quote={makeQuote({ thoughts })} />)

    // Assert
    expect(screen.getByText('3 thoughts')).toBeInTheDocument()
  })

  it('zeigt einen einzelnen Gedanken im Singular', () => {
    // Arrange
    const thoughts = [{ id: 't-1', text: 'G1', createdAt: '2026-02-01T09:00:00.000Z' }]

    // Act
    renderWithProviders(<QuoteCard quote={makeQuote({ thoughts })} />)

    // Assert
    expect(screen.getByText('1 thought')).toBeInTheDocument()
  })

  it('blendet die Gedankenzahl bei 0 aus', () => {
    // Arrange / Act
    renderWithProviders(<QuoteCard quote={makeQuote({ thoughts: [] })} />)

    // Assert
    expect(screen.queryByText(/thought/i)).not.toBeInTheDocument()
  })

  it('zeigt bei Fälligkeit heute „today“', () => {
    // Arrange
    const quote = makeQuote({ status: 'signal', nextReviewAt: undefined })

    // Act
    renderWithProviders(<QuoteCard quote={quote} />)

    // Assert
    expect(screen.getByText('today')).toBeInTheDocument()
  })

  it('zeigt bei späterer Fälligkeit die relative Zeit', () => {
    // Arrange
    const due = new Date()
    due.setDate(due.getDate() + 12)
    due.setHours(6, 0, 0, 0)

    // Act
    renderWithProviders(<QuoteCard quote={makeQuote({ status: 'signal', nextReviewAt: due.toISOString() })} />)

    // Assert
    expect(screen.getByText('in 12 days')).toBeInTheDocument()
  })

  it('zeigt bei Signalen weder Statuslabel noch Stärke, Art oder Ort', () => {
    // Arrange
    const quote = makeQuote({
      status: 'signal',
      signalStrength: 'strong',
      entryType: 'idea',
      locationName: 'Eilenriede'
    })

    // Act
    const { container } = renderWithProviders(<QuoteCard quote={quote} />)

    // Assert
    expect(screen.queryByText(en.entryStatus_rest)).not.toBeInTheDocument()
    expect(screen.queryByText(en.entryStatus_inbox)).not.toBeInTheDocument()
    expect(container.textContent).not.toMatch(/Eilenriede|strong|idea/i)
  })

  it('zeigt keinen Like-Zähler und kein Minus an der Karte', () => {
    // Arrange
    const quote = makeQuote({ status: 'signal', likes: 3 })

    // Act
    const { container } = renderWithProviders(<QuoteCard quote={quote} onFavorite={() => undefined} />)

    // Assert
    expect(container.textContent).not.toContain('3')
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
