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

  it('zeigt bei Signalen weiterhin die Signalstärke', () => {
    // Arrange
    const quote = makeQuote({ status: 'signal', signalStrength: 'strong' })

    // Act
    renderWithProviders(<QuoteCard quote={quote} />)

    // Assert
    expect(screen.getByText(en.signalStrength_strong)).toBeInTheDocument()
    expect(screen.queryByText(en.entryStatus_rest)).not.toBeInTheDocument()
  })
})
