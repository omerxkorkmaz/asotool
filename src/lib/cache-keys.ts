/** Cache key namespace and TTL strategy for Play Store scraper responses */

export const CACHE_PREFIX = 'aso:v1'

export const CACHE_TTL = {
  /** App metadata — changes infrequently */
  APP: 60 * 60, // 1 hour
  /** Search results — moderate freshness */
  SEARCH: 15 * 60, // 15 min
  /** Category top lists */
  LIST: 60 * 60, // 1 hour
  /** Reviews */
  REVIEWS: 30 * 60, // 30 min
  /** Autocomplete suggestions */
  SUGGEST: 6 * 60 * 60, // 6 hours
  /** Full bulk scan Gemini analysis */
  BULK_SCAN: 6 * 60 * 60, // 6 hours
  /** Metadata optimizer Gemini output */
  METADATA_OPTIMIZER: 6 * 60 * 60, // 6 hours
  /** Full ASO audit */
  ASO_AUDIT: 6 * 60 * 60, // 6 hours
} as const

export const CACHE_KEYS = {
  app: (appId: string, country: string, lang: string) =>
    `${CACHE_PREFIX}:app:${appId}:${country}:${lang}`,

  search: (term: string, country: string, lang: string, num: number) =>
    `${CACHE_PREFIX}:search:${country}:${lang}:${num}:${normalizeTerm(term)}`,

  list: (category: string, collection: string, country: string, lang: string, num: number) =>
    `${CACHE_PREFIX}:list:${category}:${collection}:${country}:${lang}:${num}`,

  reviews: (appId: string, country: string, lang: string, sort: string, num: number, rating?: string) =>
    `${CACHE_PREFIX}:reviews:${appId}:${country}:${lang}:${sort}:${num}:${rating ?? 'all'}`,

  suggest: (term: string, country: string, lang: string) =>
    `${CACHE_PREFIX}:suggest:${country}:${lang}:${normalizeTerm(term)}`,

  /** Persistent tracking data — legacy keys (backward compatible with existing Redis data) */
  tracked: (appId: string) => `tracked:${appId}`,
  history: (appId: string, keyword: string) => `history:${appId}:${keyword}`,

  /** Rate limit counters */
  rateLimit: (ip: string, window: string) => `${CACHE_PREFIX}:rl:${window}:${ip}`,

  bulkScan: (language: string, packageName: string, keywordsHash: string) =>
    `bulkscan:${language}:${packageName}:${keywordsHash}`,

  bulkScanHistory: (packageName: string) => `bulkscan:history:${packageName}`,

  /** Dashboard app registry */
  appsList: () => 'apps:list',
  appMeta: (packageName: string) => `app:${packageName}:meta`,
  appHistory: (packageName: string) => `app:${packageName}:history`,

  metadataOptimizer: (packageName: string, lang: string, keywordsHash: string) =>
    `metadata:${packageName}:${lang}:${keywordsHash}`,

  asoAudit: (packageName: string, lang: string) => `aso:audit:${packageName}:${lang}`,
} as const

export function hashKeywords(keywords: string[]): string {
  const normalized = [...keywords]
    .map((k) => k.toLowerCase().trim())
    .filter(Boolean)
    .sort()
    .join('|')
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function normalizeTerm(term: string): string {
  return term.toLowerCase().trim().replace(/\s+/g, ' ')
}
