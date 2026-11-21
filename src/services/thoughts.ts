import type { Quote, Thought } from '../types/quote'

export function addThoughtPatch(
  quote: Quote,
  text: string,
  now = new Date(),
  options: { fromNote?: boolean } = {}
): Partial<Quote> | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const thought: Thought = {
    id: crypto.randomUUID(),
    text: trimmed,
    createdAt: now.toISOString(),
    ...(options.fromNote ? { fromNote: true } : {})
  }
  return { thoughts: [...(quote.thoughts ?? []), thought], updatedAt: now.toISOString() }
}

export function editThoughtPatch(
  quote: Quote,
  thoughtId: string,
  text: string,
  now = new Date()
): Partial<Quote> | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  return {
    thoughts: (quote.thoughts ?? []).map((thought) =>
      thought.id === thoughtId ? { ...thought, text: trimmed } : thought
    ),
    updatedAt: now.toISOString()
  }
}

export function removeThoughtPatch(quote: Quote, thoughtId: string, now = new Date()): Partial<Quote> {
  return {
    thoughts: (quote.thoughts ?? []).filter((thought) => thought.id !== thoughtId),
    updatedAt: now.toISOString()
  }
}

export function adoptNotePatch(quote: Quote, now = new Date()): Partial<Quote> | null {
  if (!quote.text.trim() || !quote.note?.trim()) return null
  const added = addThoughtPatch(quote, quote.note, now, { fromNote: true })
  if (!added) return null
  return { ...added, note: undefined }
}

export function thoughtsNewestFirst(quote: Pick<Quote, 'thoughts'>): Thought[] {
  return [...(quote.thoughts ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
