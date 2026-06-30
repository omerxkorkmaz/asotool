/**
 * Unified ASO data layer — combines google-play-scraper + suggest + genre peers.
 *
 * Extensible for future sources (SerpAPI, App Store scraper) via DATA_SOURCE adapters.
 * Vercel-safe: no puppeteer, no heavy deps.
 */

import {
  cachedApp,
  cachedSearch,
  cachedSuggest,
  cachedReviews,
  findMyRank,
  extractWords,
  runInBatches,
} from '@/lib/gplay'
import { cacheGet, cacheSet } from '@/lib/cache'
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cache-keys'
import type { PlayAppDetail, PlaySearchResult } from '@/types/scraper'
import type {
  EnrichedAppContext,
  EnrichedBulkScanContext,
  EnrichedKeywordContext,
  CompetitorMarketStats,
} from '@/types/aso'
import { analyzeMetadataQuality } from '@/lib/metadata-quality'

const DATA_SOURCES = ['google-play-scraper', 'play-autocomplete', 'genre-search', 'play-reviews-sample'] as const

interface CachedEnvelope<T> {
  value: T
  fetchedAt: number
}

interface MarketOptions {
  country: string
  lang: string
  languageLabel?: string
}

/** Stale-while-revalidate: return stale data up to staleTtl, refresh if older than freshTtl */
export async function cacheThroughSmart<T>(
  key: string,
  freshTtl: number,
  staleTtl: number,
  fetcher: () => Promise<T>
): Promise<{ data: T; fromCache: boolean; stale: boolean }> {
  const wrapped = await cacheGet<CachedEnvelope<T>>(key)
  const now = Date.now()

  if (wrapped?.value != null) {
    const ageSec = (now - wrapped.fetchedAt) / 1000
    if (ageSec < freshTtl) {
      return { data: wrapped.value, fromCache: true, stale: false }
    }
    if (ageSec < staleTtl) {
      return { data: wrapped.value, fromCache: true, stale: true }
    }
  }

  const fresh = await fetcher()
  await cacheSet(key, { value: fresh, fetchedAt: now } satisfies CachedEnvelope<T>, staleTtl)
  return { data: fresh, fromCache: false, stale: false }
}

function parseInstallsMid(installs?: string): number {
  if (!installs) return 0
  const m = installs.match(/([\d,.]+)\s*([KMB])?/i)
  if (!m) return 0
  let n = parseFloat(m[1].replace(/,/g, ''))
  const suffix = (m[2] || '').toUpperCase()
  if (suffix === 'K') n *= 1_000
  if (suffix === 'M') n *= 1_000_000
  if (suffix === 'B') n *= 1_000_000_000
  return n
}

function computeMarketStats(
  keyword: string,
  results: PlaySearchResult[],
  myRank: number | null,
  suggestVariants: string[]
): CompetitorMarketStats {
  const top10 = results.slice(0, 10)
  const top10AvgScore = top10.length
    ? top10.reduce((s, a) => s + (a.score ?? 0), 0) / top10.length
    : 0
  const top10AvgRatings = top10.length
    ? top10.reduce((s, a) => s + (a.ratings ?? 0), 0) / top10.length
    : 0
  const installs = top10.map((a) => parseInstallsMid(a.installs)).filter((n) => n > 0).sort((a, b) => a - b)
  const top10MedianInstalls =
    installs.length > 0 ? top10[installs.length >> 1]?.installs ?? null : null

  const dominanceScore = Math.min(
    100,
    Math.round(top10AvgRatings / 500 + results.length * 0.3 + (myRank && myRank <= 10 ? 20 : 0))
  )

  return {
    keyword,
    myRank,
    totalResults: results.length,
    top10AvgScore: Math.round(top10AvgScore * 10) / 10,
    top10AvgRatings: Math.round(top10AvgRatings),
    top10MedianInstalls,
    dominanceScore,
    suggestVariants,
  }
}

export async function fetchEnrichedApp(
  packageName: string,
  market: MarketOptions,
  targetKeywords: string[] = []
): Promise<EnrichedAppContext> {
  const pkg = packageName.trim().toLowerCase()
  const { country, lang, languageLabel = country } = market
  const cacheKey = `${CACHE_KEYS.app(pkg, country, lang)}:enriched`

  const { data } = await cacheThroughSmart(
    cacheKey,
    CACHE_TTL.APP,
    CACHE_TTL.APP * 3,
    async () => {
      const app = await cachedApp({ appId: pkg, country, lang })
      const metadataQuality = analyzeMetadataQuality(app, targetKeywords)

      const seedTerms = [
        ...extractWords(app.title).slice(0, 2),
        ...(app.genre ? [app.genre.split(' ')[0]] : []),
      ].filter(Boolean)

      const suggestSets = await Promise.all(
        seedTerms.slice(0, 3).map((term) =>
          cachedSuggest(term, country, lang).catch(() => [] as string[])
        )
      )
      const autocompleteSeeds = [...new Set(suggestSets.flat())].slice(0, 20)

      const genreTerm = app.genre || app.title
      let genreResults: PlaySearchResult[] = []
      let genreSearchRank: number | null = null
      try {
        genreResults = await cachedSearch({ term: genreTerm, country, lang, num: 50 })
        genreSearchRank = findMyRank(genreResults, pkg)
      } catch {
        genreResults = []
      }

      let reviewAvgScore: number | null = null
      let reviewSampleSize = 0
      try {
        const reviews = await cachedReviews({ appId: pkg, country, lang, num: 40, sort: 2 })
        reviewSampleSize = reviews.length
        if (reviews.length) {
          reviewAvgScore = Math.round((reviews.reduce((s, r) => s + r.score, 0) / reviews.length) * 10) / 10
        }
      } catch {
        /* optional */
      }

      return {
        packageName: pkg,
        country,
        lang,
        languageLabel,
        fetchedAt: new Date().toISOString(),
        app: {
          appId: app.appId,
          title: app.title,
          developer: app.developer,
          genre: app.genre,
          genreId: app.genreId,
          summary: app.summary,
          description: app.description || '',
          score: app.score,
          ratings: app.ratings,
          installs: app.installs,
          updated: app.updated,
          version: app.version,
          recentChanges: app.recentChanges,
          histogram: app.histogram as Record<string, number> | undefined,
        },
        metadataQuality,
        autocompleteSeeds,
        genreSearchRank,
        genrePeerCount: genreResults.length,
        genreTopApps: genreResults.slice(0, 10).map((a) => ({
          appId: a.appId,
          title: a.title,
          score: a.score,
          ratings: a.ratings,
        })),
        reviewSampleSize,
        reviewAvgScore,
      } satisfies EnrichedAppContext
    }
  )

  return data
}

export async function fetchEnrichedBulkScanContext(params: {
  packageNames: string[]
  keywords: string[]
  country: string
  lang: string
  languageLabel: string
}): Promise<EnrichedBulkScanContext> {
  const { packageNames, keywords, country, lang, languageLabel } = params
  const primaryApp = packageNames[0] || 'unknown'
  const keywordsHash = keywords.join('|')
  const cacheKey = `aso:v1:enriched-bulk:${country}:${lang}:${primaryApp}:${keywordsHash}`

  const { data, fromCache, stale } = await cacheThroughSmart(
    cacheKey,
    CACHE_TTL.SEARCH,
    CACHE_TTL.BULK_SCAN,
    async () => {
      const appContext = await fetchEnrichedApp(primaryApp, { country, lang, languageLabel }, keywords)

      const keywordContexts = await runInBatches(keywords, 3, async (keyword) => {
        const [results, suggestVariants] = await Promise.all([
          cachedSearch({ term: keyword, country, lang, num: 100 }),
          cachedSuggest(keyword, country, lang).catch(() => [] as string[]),
        ])

        const ranksByPackage: Record<string, number | null> = {}
        for (const pkg of packageNames) {
          ranksByPackage[pkg] = findMyRank(results, pkg)
        }
        const myRank = primaryApp ? ranksByPackage[primaryApp] : null

        const topResults = results.slice(0, 12).map((a, i) => ({
          rank: i + 1,
          packageName: a.appId,
          title: a.title,
          score: a.score ?? 0,
          ratings: a.ratings,
          installs: a.installs,
        }))

        const marketStats = computeMarketStats(keyword, results, myRank, suggestVariants.slice(0, 8))

        return {
          keyword,
          totalResults: results.length,
          myRank,
          ranksByPackage,
          topResults,
          marketStats,
        } satisfies EnrichedKeywordContext
      })

      return {
        primaryApp,
        packageNames,
        languageLabel,
        country,
        lang,
        appContext,
        keywordContexts,
        dataSources: [...DATA_SOURCES],
        cacheMeta: { fromCache: false, stale: false },
      } satisfies EnrichedBulkScanContext
    }
  )

  return {
    ...data,
    cacheMeta: { fromCache, stale },
  }
}

/** Genre peer search — used by health score & app manager */
export async function fetchGenrePeers(
  app: { genre?: string; title?: string; appId?: string },
  country: string,
  lang: string
): Promise<{ results: PlaySearchResult[]; myRank: number | null }> {
  const term = app.genre || app.title || ''
  if (!term) return { results: [], myRank: null }
  try {
    const results = await cachedSearch({ term, country, lang, num: 50 })
    return { results, myRank: app.appId ? findMyRank(results, app.appId) : null }
  } catch {
    return { results: [], myRank: null }
  }
}

export { DATA_SOURCES }
export { analyzeMetadataQuality } from '@/lib/metadata-quality'
