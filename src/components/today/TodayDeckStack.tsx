import type { ReactNode } from 'react'
import type { useSwipeDeck } from '../../hooks/useSwipeDeck'
import type { Quote } from '../../types/quote'
import { DeckPreview } from '../deck/DeckPreview'
import { TodayTopCard } from './TodayTopCard'

interface TodayDeckStackProps {
  quote: Quote
  nextQuote?: Quote
  thirdQuote?: Quote
  position: number
  total: number
  deck: ReturnType<typeof useSwipeDeck>
  children?: ReactNode
}

// Swipe surface with the top card and up to two preview cards behind it; children (menu, coach) overlay the surface.
export function TodayDeckStack({ quote, nextQuote, thirdQuote, position, total, deck, children }: TodayDeckStackProps) {
  const deckLift = deck.exit ? 1 : Math.min(1, Math.hypot(deck.drag.x, deck.drag.y) / 140 + deck.hints.right * 0.6)

  return (
    <section className="flex min-h-0 flex-col gap-4 lg:flex-row">
      <div
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden px-2 py-2 sm:px-4 sm:py-4"
        style={{ perspective: '1200px' }}
        {...deck.bind}
      >
        {thirdQuote && <DeckPreview quote={thirdQuote} depth={2} lift={deckLift} />}
        {nextQuote && <DeckPreview quote={nextQuote} depth={1} lift={deckLift} />}
        <TodayTopCard quote={quote} position={position} total={total} deck={deck} />
        {children}
      </div>
    </section>
  )
}
