import type { BulkScanKeywordResult, RankedAppResult } from './scraper'
import type { DraftAiAnalysis, ReviewAiSummary, TitleSuggestAiResponse } from './gemini'

export interface ApiErrorResponse {
  error: string
}

export interface TrackedKeyword {
  keyword: string
  country: string
  lang: string
  addedAt: string
}

export interface RankHistoryEntry {
  date: string
  rank: number | null
  totalResults: number
}

export interface KeywordCheckInDraft {
  keyword: string
  inTitle: boolean
  inFirstLines: boolean
  inDescription: boolean
  occurrences: number
  previousDurum?: string
  previousFirsatSkoru?: number
  myRank?: number | null
  totalResults?: number
  filterReason?: string
}

export interface CheckDraftResponse {
  titleLength: number
  descriptionLength: number
  totalKeywordsChecked: number
  asoSkoru: number
  missingInDraft: KeywordCheckInDraft[]
  weakInDraft: KeywordCheckInDraft[]
  strongInDraft: KeywordCheckInDraft[]
  keywordChecks: KeywordCheckInDraft[]
  malformedChecks: KeywordCheckInDraft[]
  aiAnalysis: DraftAiAnalysis | null
  aiAvailable: boolean
  aiError: string | null
}

export interface BulkScanResponse {
  appId: string | null
  myApp: { title: string; description?: string } | null
  total: number
  results: BulkScanKeywordResult[]
}

export interface TitleSuggestResponse {
  myApp: { title: string; summary?: string }
  rivalsScanned: number
  missingWords: Array<{ word: string; appearsIn: number; totalRivals: number }>
  aiSuggestion: TitleSuggestAiResponse | null
  aiAvailable: boolean
}

export interface MultiCountryResult {
  gl: string
  country: string
  myRank: number | null
  top5?: RankedAppResult[]
  error?: string
}

export interface MultiCountryResponse {
  keyword: string
  scannedCountries: number
  results: MultiCountryResult[]
}

export interface CategorizeReviewsResponse {
  totalReviews: number
  aiAvailable: boolean
  aiSummary: ReviewAiSummary | null
  categories: Array<{
    category: string
    label: string
    color: string
    count: number
    percentage: number
    avgScore: number
    topReviews: Array<{ score: number; text: string; thumbsUp?: number }>
  }>
}
