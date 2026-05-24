// Earthy, vintage book-spine palette tuned to the paper/ink theme. A book's
// cover is derived deterministically from its title + author, so the same book
// always wears the same colours without storing anything.
const spines = [
  { base: '#52624b', edge: '#3c4a37', text: '#eef0e6' }, // moss
  { base: '#a65f3f', edge: '#834325', text: '#fbeee4' }, // clay
  { base: '#3a5a5c', edge: '#264143', text: '#e6f1f1' }, // teal
  { base: '#6e3b3b', edge: '#532727', text: '#f6e6e2' }, // burgundy
  { base: '#3b4664', edge: '#28304a', text: '#e7eaf4' }, // indigo
  { base: '#8a6d3b', edge: '#6a5128', text: '#f7eed8' }, // ochre
  { base: '#5a4763', edge: '#42334b', text: '#efe7f3' }, // aubergine
  { base: '#404f3a', edge: '#2c3927', text: '#eaf0e2' } // forest
] as const

export interface BookCover {
  base: string
  edge: string
  text: string
  initials: string
  /** 0..1 used to nudge the decorative band so covers don't look stamped. */
  bandOffset: number
}

function hash(seed: string) {
  let value = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

export function bookCover(title: string, author?: string): BookCover {
  const seed = `${title}::${author ?? ''}`
  const h = hash(seed)
  const palette = spines[h % spines.length]
  return {
    ...palette,
    initials: initialsFor(title),
    bandOffset: ((h >>> 8) % 100) / 100
  }
}

function initialsFor(title: string) {
  const words = title
    .replace(/^(the|a|an|der|die|das|le|la|les|el|los)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return '··'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}
