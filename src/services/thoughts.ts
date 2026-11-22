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

// Puts a removed thought back (undo) on the fresh row, keeping chronological order; a thought that is already there is left alone.
export function restoreThoughtPatch(quote: Quote, thought: Thought, now = new Date()): Partial<Quote> {
  const existing = quote.thoughts ?? []
  if (existing.some((item) => item.id === thought.id)) return { thoughts: existing }
  const thoughts = [...existing, thought].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return { thoughts, updatedAt: now.toISOString() }
}

export function adoptNotePatch(quote: Quote, now = new Date()): Partial<Quote> | null {
  if (!quote.text.trim() || !quote.note?.trim()) return null
  const added = addThoughtPatch(quote, quote.note, now, { fromNote: true })
  if (!added) return null
  return { ...added, note: undefined }
}

// Undo of adoptNotePatch on the fresh row: drops only the adopted thought (by id) and puts the note back, so thoughts added since stay.
export function undoAdoptNotePatch(quote: Quote, thoughtId: string, note: string | undefined, now = new Date()): Partial<Quote> {
  return {
    thoughts: (quote.thoughts ?? []).filter((thought) => thought.id !== thoughtId),
    note,
    updatedAt: now.toISOString()
  }
}

export function thoughtsNewestFirst(quote: Pick<Quote, 'thoughts'>): Thought[] {
  return [...(quote.thoughts ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
