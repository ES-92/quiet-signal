import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { translations } from '../i18n/translations'
import { makeQuote, resetFactories } from '../test/factories'
import { renderWithProviders } from '../test/render'
import { EntryInfoLine } from './EntryInfoLine'
import { QuoteCard } from './QuoteCard'

const en = translations.en

beforeEach(() => {
  resetFactories()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 2, 10, 12))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('card and info line agree on the same quote', () => {
  it('both call a signal overdue, the info line with the day count', () => {
    // Arrange
    const quote = makeQuote({ status: 'signal', nextReviewAt: new Date(2026, 2, 7, 6).toISOString() })

    // Act
    renderWithProviders(
      <>
        <QuoteCard quote={quote} />
        <EntryInfoLine quote={quote} />
      </>
    )

    // Assert
    expect(screen.getByText(en.cardOverdue)).toBeInTheDocument()
    expect(screen.getByText('Overdue for 3 days')).toBeInTheDocument()
  })

  it('uses the singular for one day overdue', () => {
    // Arrange
    const quote = makeQuote({ status: 'signal', nextReviewAt: new Date(2026, 2, 9, 6).toISOString() })

    // Act
    renderWithProviders(<EntryInfoLine quote={quote} />)

    // Assert
    expect(screen.getByText('Overdue for 1 day')).toBeInTheDocument()
  })

  it.each([
    ['due today', new Date(2026, 2, 10, 6).toISOString(), 'today', 'Due today'],
    ['undated', undefined, 'today', 'Due today']
  ])('both stay on today for a signal that is %s', (_name, nextReviewAt, cardText, lineText) => {
    // Arrange
    const quote = makeQuote({ status: 'signal', nextReviewAt })

    // Act
    renderWithProviders(
      <>
        <QuoteCard quote={quote} />
        <EntryInfoLine quote={quote} />
      </>
    )

    // Assert
    expect(screen.getByText(cardText)).toBeInTheDocument()
    expect(screen.getByText(lineText)).toBeInTheDocument()
  })

  it('both use the 30-day cap of a legacy favourite', () => {
    // Arrange
    const quote = makeQuote({
      status: 'signal',
      favorite: true,
      lastReviewedAt: new Date(2026, 2, 10, 9).toISOString(),
      nextReviewAt: new Date(2026, 8, 1, 6).toISOString()
    })

    // Act
    renderWithProviders(
      <>
        <QuoteCard quote={quote} />
        <EntryInfoLine quote={quote} />
      </>
    )

    // Assert
    expect(screen.getByText('in 30 days')).toBeInTheDocument()
    expect(screen.getByText('Comes back on April 9')).toBeInTheDocument()
  })
})
