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
  it('zeigt bei Stille das Statuslabel Rest', () => {
    // Arrange
    const quote = makeQuote({ status: 'rest' })

    // Act
    renderWithProviders(<QuoteCard quote={quote} />)

    // Assert
    expect(screen.getByText(en.entryStatus_rest)).toBeInTheDocument()
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
