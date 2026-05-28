export type QuoteStatus = 'inbox' | 'signal'
export type SignalStrength = 'quiet' | 'normal' | 'strong'
export type EntryType = 'note' | 'memory' | 'book_quote' | 'idea' | 'conversation' | 'observation'

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
  entryType?: EntryType
  occurredAt?: string
  people?: string[]
  locationName?: string
  locationLatitude?: number
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
  signalStrength?: SignalStrength
  createdAt: string
  updatedAt: string
  reviewCount: number
  lastReviewedAt?: string
  nextReviewAt?: string
}

export type QuoteInput = Omit<
  Quote,
  'id' | 'createdAt' | 'updatedAt' | 'reviewCount' | 'lastReviewedAt' | 'nextReviewAt' | 'likes'
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

export function signalStrength(quote: Pick<Quote, 'signalStrength'>): SignalStrength {
  return quote.signalStrength ?? 'normal'
}

export function entryType(quote: Pick<Quote, 'entryType'>): EntryType {
  return quote.entryType ?? 'note'
}
