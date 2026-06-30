/** google-play-scraper response shapes used across the app */

export interface PlayHistogram {
  1?: number
  2?: number
  3?: number
  4?: number
  5?: number
}

export interface PlaySearchResult {
  appId: string
  title: string
  developer: string
  score?: number
  ratings?: number
  installs?: string
  icon?: string
  free?: boolean
  updated?: number
}

export interface PlayAppDetail {
  appId: string
  title: string
  developer: string
  developerId?: string
  icon?: string
  score?: number
  ratings?: number
  reviews?: number
  installs?: string
  minInstalls?: number
  maxInstalls?: number
  free?: boolean
  price?: string
  genre?: string
  genreId?: string
  description?: string
  descriptionHTML?: string
  summary?: string
  recentChanges?: string
  updated?: number
  version?: string
  androidVersion?: string
  contentRating?: string
  screenshots?: string[]
  headerImage?: string
  histogram?: PlayHistogram
}

export interface PlayReview {
  id?: string
  userName: string
  score: number
  text: string
  date?: string | number
  thumbsUp?: number
  replyText?: string
  replyDate?: string | number
}

export interface RankedAppResult {
  rank: number
  appId: string
  title: string
  developer: string
  score?: number
  ratings?: number
  installs?: string
  icon?: string
  free?: boolean
  isMe: boolean
}

export interface KeywordSearchResponse {
  keyword: string
  myRank: number | null
  total: number
  results: RankedAppResult[]
}

export interface RivalAppResponse {
  appId: string
  title: string
  developer: string
  developerId?: string
  icon?: string
  score?: number
  ratings?: number
  reviews?: number
  installs?: string
  minInstalls?: number
  maxInstalls?: number
  free?: boolean
  price?: string | number
  genre?: string
  genreId?: string
  description?: string
  descriptionHTML?: string
  shortDescription?: string
  recentChanges?: string
  updated?: number
  version?: string
  androidVersion?: string
  contentRating?: string
  screenshots?: string[]
  headerImage?: string
  histogram?: PlayHistogram
}

export interface BulkScanKeywordResult {
  keyword: string
  myRank: number | null
  totalResults: number
  avgCompetitorRatings: number
  avgCompetitorScore: number
  activeCompetitors: number
  hacimTahmini: string
  hacimSkoru: number
  firsatSkoru: number
  durum: string
  renk: string
  sebep: string
  aksiyon: string
  oncelik: number
  top3: Array<{ rank: number; title: string; appId: string; ratings?: number }>
  error?: string
}

export interface CountryPreset {
  gl: string
  hl?: string
  label: string
  flag?: string
}

/** Bulk Scan API request */
export interface BulkScanRequest {
  packageNames: string[]
  keywords: string[]
  language: string
  country: string
  lang: string
}

export interface ScrapedCompetitorSnapshot {
  rank: number
  packageName: string
  title: string
  score: number
  ratings?: number
  installs?: string
}

export interface KeywordScrapeBundle {
  keyword: string
  totalResults: number
  ranksByPackage: Record<string, number | null>
  topResults: ScrapedCompetitorSnapshot[]
}

export interface BulkScanScrapeContext {
  primaryApp: string
  packageNames: string[]
  languageLabel: string
  country: string
  lang: string
  appProfile: {
    packageName: string
    title: string
    genre?: string
    summary?: string
    descriptionSnippet: string
    score?: number
    ratings?: number
    installs?: string
  } | null
  keywordBundles: KeywordScrapeBundle[]
}
