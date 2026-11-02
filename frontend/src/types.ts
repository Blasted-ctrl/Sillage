export interface Fragrance {
  id: string
  name: string
  brand: string
  gender: string
  url: string
  notes: { top: string[]; middle: string[]; base: string[] }
  accords: string[]
}

export interface Match extends Fragrance {
  similarity: number
  matched_notes: string[]
  sample_advice: string
}

export interface SearchResponse {
  results: Match[]
  recognized_notes: string[]
  excluded_notes: string[]
  message: string | null
  source?: Fragrance
}

export interface ShelfItem extends Fragrance {
  preference: 'saved' | 'liked' | 'disliked'
}
