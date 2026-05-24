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
