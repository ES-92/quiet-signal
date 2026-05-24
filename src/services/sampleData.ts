import type { Book } from '../types/book'
import type { Quote } from '../types/quote'

interface SampleSeed {
  books: Book[]
  quotes: Quote[]
}

export function sampleSeed(): SampleSeed {
  const now = new Date().toISOString()
  const philosophy: Book = {
    id: crypto.randomUUID(),
    title: 'The Story of Philosophy',
    author: 'Will Durant',
    weight: 'often',
    source: 'manual',
    createdAt: now,
    updatedAt: now
  }
  const meditations: Book = {
    id: crypto.randomUUID(),
    title: 'Meditations',
    author: 'Marcus Aurelius',
    weight: 'normal',
    source: 'manual',
    createdAt: now,
    updatedAt: now
  }
  const grace: Book = {
    id: crypto.randomUUID(),
    title: 'Gravity and Grace',
    author: 'Simone Weil',
    weight: 'rare',
    source: 'manual',
    createdAt: now,
    updatedAt: now
  }

  const quotes: Quote[] = [
    {
      id: crypto.randomUUID(),
      text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
      author: 'Will Durant',
      source: 'The Story of Philosophy',
      work: 'The Story of Philosophy',
      bookId: philosophy.id,
      year: '1926',
      tags: ['philosophy', 'habit'],
      note: 'Often misattributed to Aristotle, but still useful.',
      favorite: true,
      likes: 4,
      createdAt: now,
      updatedAt: now,
      reviewCount: 0
    },
    {
      id: crypto.randomUUID(),
      text: 'The impediment to action advances action. What stands in the way becomes the way.',
      author: 'Marcus Aurelius',
      source: 'Meditations',
      work: 'Meditations',
      bookId: meditations.id,
      tags: ['stoicism', 'resilience'],
      favorite: false,
      likes: 1,
      createdAt: now,
      updatedAt: now,
      reviewCount: 0
    },
    {
      id: crypto.randomUUID(),
      text: 'Attention is the rarest and purest form of generosity.',
      author: 'Simone Weil',
      source: 'Gravity and Grace',
      work: 'Gravity and Grace',
      bookId: grace.id,
      tags: ['attention', 'ethics'],
      favorite: true,
      likes: 2,
      createdAt: now,
      updatedAt: now,
      reviewCount: 0
    }
  ]

  return { books: [philosophy, meditations, grace], quotes }
}
