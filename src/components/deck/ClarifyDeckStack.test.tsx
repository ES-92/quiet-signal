import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeQuote } from '../../test/factories'
import { renderWithProviders } from '../../test/render'
import { ClarifyDeckStack } from './ClarifyDeckStack'

const deck = {
  drag: { x: 0, y: 0, active: false },
  exit: null,
  bind: {},
  hints: { left: 0, right: 0, up: 0, down: 0 },
  exitMs: 200
} as unknown as Parameters<typeof ClarifyDeckStack>[0]['deck']

describe('ClarifyDeckStack', () => {
  it('hält die Vorschaukarten nicht höher als die oberste Karte, damit kein Text darunter sichtbar wird', () => {
    // Arrange / Act
    const { container } = renderWithProviders(
      <ClarifyDeckStack
        quote={makeQuote({ text: 'Kurz' })}
        nextQuote={makeQuote({ text: 'Zweite Karte mit langem Text' })}
        thirdQuote={makeQuote({ text: 'Dritte Karte' })}
        deck={deck}
        coachVisible={false}
        onDismissCoach={() => undefined}
      />
    )

    // Assert
    const top = container.querySelector('.clarify-top-card') as HTMLElement
    const previews = container.querySelectorAll('article[aria-hidden="true"]')
    expect(screen.getByText('Kurz')).toBeInTheDocument()
    expect(top.className).toContain('min-h-[16.5rem]')
    expect(previews).toHaveLength(2)
    previews.forEach((preview) => {
      expect(preview.className).toContain('min-h-[16.5rem]')
      expect(preview.className).toContain('max-h-[16.5rem]')
    })
  })
})
