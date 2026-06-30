import gplay from 'google-play-scraper'
import { CACHE_KEYS, CACHE_TTL } from './cache-keys'
import { cacheThrough } from './cache'
import type { PlayAppDetail, PlayReview, PlaySearchResult } from '@/types/scraper'

export interface SearchOptions {
  term: string
  country?: string
  lang?: string
  num?: number
}

export interface AppOptions {
  appId: string
  country?: string
  lang?: string
}

export async function cachedSearch(opts: SearchOptions): Promise<PlaySearchResult[]> {
  const { term, country = 'tr', lang = 'tr', num = 100 } = opts
  const capped = Math.min(num, 100)
  const key = CACHE_KEYS.search(term, country, lang, capped)

  return cacheThrough(key, CACHE_TTL.SEARCH, async () => {
    return gplay.search({ term, country, lang, num: capped, fullDetail: false }) as unknown as Promise<PlaySearchResult[]>
  })
}

export async function cachedApp(opts: AppOptions): Promise<PlayAppDetail> {
  const { appId, country = 'tr', lang = 'tr' } = opts
  const key = CACHE_KEYS.app(appId, country, lang)

  return cacheThrough(key, CACHE_TTL.APP, async () => {
    return gplay.app({ appId, country, lang }) as unknown as Promise<PlayAppDetail>
  })
}

export async function cachedSuggest(term: string, country = 'tr', lang = 'tr'): Promise<string[]> {
  const key = CACHE_KEYS.suggest(term, country, lang)
  return cacheThrough(key, CACHE_TTL.SUGGEST, async () => {
    return gplay.suggest({ term, country, lang }) as Promise<string[]>
  })
}

export async function cachedList(opts: {
  category: string
  collection: string
  country?: string
  lang?: string
  num?: number
}): Promise<PlaySearchResult[]> {
  const { category, collection, country = 'tr', lang = 'tr', num = 50 } = opts
  const key = CACHE_KEYS.list(category, collection, country, lang, num)

  return cacheThrough(key, CACHE_TTL.LIST, async () => {
    return gplay.list({
      category: category as never,
      collection: collection as never,
      country,
      lang,
      num,
    }) as unknown as Promise<PlaySearchResult[]>
  })
}

export async function cachedReviews(opts: {
  appId: string
  country?: string
  lang?: string
  sort?: number
  num?: number
}) {
  const { appId, country = 'tr', lang = 'tr', sort = 1, num = 100 } = opts
  const key = CACHE_KEYS.reviews(appId, country, lang, String(sort), num)

  return cacheThrough(key, CACHE_TTL.REVIEWS, async () => {
    const result = await gplay.reviews({ appId, country, lang, sort, num })
    return ('data' in result && Array.isArray(result.data) ? result.data : result) as PlayReview[]
  })
}

export function findMyRank<T extends { appId: string }>(results: T[], appId?: string): number | null {
  if (!appId) return null
  const idx = results.findIndex((a) => a.appId === appId)
  return idx >= 0 ? idx + 1 : null
}

export const STOPWORDS = new Set([
  've', 'ile', 'için', 'bir', 'bu', 'da', 'de', 'en', 'the', 'and', 'for', 'with', 'app',
  'free', 'pro', 'plus', 'lite', 'new', 'best', 'top', 'your', 'you', 'all', 'get',
  'und', 'der', 'die', 'das', 'für', 'mit', 'ein', 'eine',
  'el', 'la', 'los', 'las', 'de', 'del', 'para', 'con', 'una', 'un',
])

export function extractWords(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9ğüşıöçäöüßáéíóúñ\s-]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

export async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
  }
  return results
}
