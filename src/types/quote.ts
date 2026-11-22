export type QuoteStatus = 'inbox' | 'signal' | 'rest'
/** @deprecated No longer used by the app; kept so stored values and backups pass through unchanged. */
export type SignalStrength = 'quiet' | 'normal' | 'strong'
/** @deprecated No longer used by the app; kept so stored values and backups pass through unchanged. */
export type EntryType = 'note' | 'memory' | 'book_quote' | 'idea' | 'conversation' | 'observation'

export interface Thought {
  id: string
  text: string
  createdAt: string
  fromNote?: boolean
}

export type ActivityType = 'more' | 'less' | 'rest' | 'wake' | 'thought'

// One deck/detail action on an entry, for the Rückblick strip. Stored inside the quote, so the vault encrypts it with the rest.
export interface ActivityEvent {
  at: string
  type: ActivityType
}

export interface Quote {
  id: string
  text: string
  author?: string
  source?: string
  work?: string
  year?: string
  bookId?: string
  tags: string[]
  note?: string
  /** @deprecated Not written for new entries and not evaluated anywhere; existing values stay in rows and backups. */
  entryType?: EntryType
  occurredAt?: string
  people?: string[]
  /** @deprecated Location fields are no longer written or shown; existing values stay in rows and backups. */
  locationName?: string
  /** @deprecated See locationName. */
  locationLatitude?: number
  /** @deprecated See locationName. */
  locationLongitude?: number
  audioDataUrl?: string
  audioMimeType?: string
  audioDurationMs?: number
  imageDataUrl?: string
  imageMimeType?: string
  encrypted?: boolean
  encryptedPayload?: string
  encryptionIv?: string
  favorite: boolean
  likes: number
  status?: QuoteStatus
  /** @deprecated Not written for new entries and not evaluated anywhere; existing values stay in rows and backups. */
  signalStrength?: SignalStrength
  createdAt: string
  updatedAt: string
  reviewCount: number
  lastReviewedAt?: string
  nextReviewAt?: string
  snoozedUntil?: string
  reviewIntervalDays?: number
  thoughts?: Thought[]
  // The last few actions (capped, oldest dropped first); missing on legacy entries.
  activity?: ActivityEvent[]
  deletedAt?: string
}

export type QuoteInput = Omit<
  Quote,
  'id' | 'createdAt' | 'updatedAt' | 'reviewCount' | 'lastReviewedAt' | 'nextReviewAt' | 'likes' | 'snoozedUntil' | 'deletedAt'
>

export interface QuoteFilters {
  query: string
  tag: string
  author: string
  source: string
  book: string
  favoritesOnly: boolean
}

export function quoteStatus(quote: Pick<Quote, 'status'>): QuoteStatus {
  return quote.status ?? 'signal'
}

export function isSnoozed(quote: Pick<Quote, 'snoozedUntil'>, now = Date.now()): boolean {
  return Boolean(quote.snoozedUntil) && new Date(quote.snoozedUntil as string).getTime() > now
}

export function isDeleted(quote: Pick<Quote, 'deletedAt'>): boolean {
  return Boolean(quote.deletedAt)
}
