import { geminiJson, getGeminiClient } from '@/lib/gemini'
import { cacheGet, cacheSet, CACHE_TTL } from '@/lib/cache'
import { CACHE_KEYS, hashKeywords } from '@/lib/cache-keys'
import { fetchEnrichedBulkScanContext } from '@/lib/data-layer'
import { PROMPTS, normalizeActionPlan, DEFAULT_ACTION_PLAN_FALLBACKS } from '@/lib/gemini-prompts'
import type {
  BulkScanResult,
  CompetitionLevel,
  KeywordAnalysis,
} from '@/types/gemini'
import type { EnrichedBulkScanContext, EnrichedKeywordContext } from '@/types/aso'
import type { AppLanguage } from '@/lib/languages'

export interface RunBulkScanParams {
  packageNames: string[]
  keywords: string[]
  language: AppLanguage
}

/** @deprecated use fetchEnrichedBulkScanContext — kept for backward compat */
export async function collectScrapeContext(params: RunBulkScanParams) {
  const ctx = await fetchEnrichedBulkScanContext({
    packageNames: params.packageNames,
    keywords: params.keywords,
    country: params.language.gl,
    lang: params.language.hl,
    languageLabel: params.language.label,
  })
  return {
    primaryApp: ctx.primaryApp,
    packageNames: ctx.packageNames,
    languageLabel: ctx.languageLabel,
    country: ctx.country,
    lang: ctx.lang,
    appProfile: ctx.appContext
      ? {
          packageName: ctx.appContext.packageName,
          title: ctx.appContext.app.title,
          genre: ctx.appContext.app.genre,
          summary: ctx.appContext.app.summary,
          descriptionSnippet: ctx.appContext.app.description.slice(0, 600),
          score: ctx.appContext.app.score,
          ratings: ctx.appContext.app.ratings,
          installs: ctx.appContext.app.installs,
        }
      : null,
    keywordBundles: ctx.keywordContexts.map((k) => ({
      keyword: k.keyword,
      totalResults: k.totalResults,
      ranksByPackage: k.ranksByPackage,
      topResults: k.topResults,
    })),
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function competitionFromDifficulty(d: number): CompetitionLevel {
  if (d < 40) return 'Low'
  if (d < 70) return 'Medium'
  return 'High'
}

function buildHeuristicFromEnriched(ctx: EnrichedBulkScanContext, languageLabel: string): BulkScanResult {
  const keywords: KeywordAnalysis[] = ctx.keywordContexts.map((bundle: EnrichedKeywordContext) => {
    const stats = bundle.marketStats
    const myRank = bundle.myRank
    const top = bundle.topResults.slice(0, 10)
    const avgRatings = stats.top10AvgRatings

    const volumeBase = clamp(
      Math.round(stats.totalResults * 60 + avgRatings / 25 + stats.dominanceScore * 2),
      50,
      50000
    )
    const difficulty = clamp(
      Math.round(stats.dominanceScore * 0.7 + (stats.totalResults > 80 ? 15 : 0) + (myRank && myRank > 40 ? 10 : 0)),
      5,
      95
    )
    const opportunity = clamp(
      100 - difficulty + (myRank === null ? 8 : myRank > 30 ? 3 : 18) + (stats.suggestVariants.length > 2 ? 5 : 0),
      5,
      95
    )

    const longTail = stats.suggestVariants.slice(0, 3).length
      ? stats.suggestVariants.slice(0, 4)
      : [`${bundle.keyword} ücretsiz`, `en iyi ${bundle.keyword}`].filter((s) => s.length < 40)

    return {
      keyword: bundle.keyword,
      estimatedVolume: volumeBase,
      difficulty,
      opportunityScore: opportunity,
      competitionLevel: competitionFromDifficulty(difficulty),
      longTailSuggestions: longTail,
      relevanceToApp: myRank ? clamp(100 - myRank * 1.2, 10, 95) : 40,
      reasoning: myRank
        ? `"${bundle.keyword}": sıra #${myRank}, ${stats.totalResults} sonuç, top10 ort. ${avgRatings} rating (scrape verisi).`
        : `"${bundle.keyword}": ilk 100'de yok. ${stats.totalResults} sonuç — metadata ve long-tail odaklan.`,
    }
  })

  const topCompetitors = aggregateTopCompetitors(ctx.keywordContexts)

  return {
    success: true,
    analyzedAt: new Date().toISOString(),
    primaryApp: ctx.primaryApp,
    language: languageLabel,
    keywords: keywords.sort((a, b) => b.opportunityScore - a.opportunityScore),
    topCompetitors,
    recommendedTitleKeywords: keywords
      .filter((k) => k.opportunityScore >= 55)
      .slice(0, 5)
      .map((k) => k.keyword),
    strategySummary:
      'Heuristik analiz — google-play-scraper + autocomplete verisine dayalı. GEMINI_API_KEY ile daha derin strateji alın.',
    quickActions: [
      'Eksik keyword\'leri başlık ve kısa açıklamaya ekle',
      'Autocomplete long-tail varyantlarını Bulk Scan\'de test et',
      'Keyword Tracker ile sıralama trendini izle',
    ],
    actionPlan7Days: normalizeActionPlan(undefined, DEFAULT_ACTION_PLAN_FALLBACKS, ctx.appContext.app.title),
    fallbackMode: true,
  }
}

function aggregateTopCompetitors(bundles: EnrichedKeywordContext[]) {
  const map = new Map<string, { packageName: string; title: string; score: number; count: number }>()
  for (const b of bundles) {
    for (const r of b.topResults.slice(0, 5)) {
      const existing = map.get(r.packageName)
      if (existing) {
        existing.count++
        existing.score = Math.max(existing.score, r.score)
      } else {
        map.set(r.packageName, {
          packageName: r.packageName,
          title: r.title,
          score: r.score,
          count: 1,
        })
      }
    }
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || b.score - a.score)
    .slice(0, 8)
    .map(({ packageName, title, score }) => ({ packageName, title, score }))
}

async function analyzeWithGemini(ctx: EnrichedBulkScanContext): Promise<BulkScanResult | null> {
  const raw = await geminiJson<
    Omit<BulkScanResult, 'fromCache' | 'fallbackMode'> & {
      actionPlan7Days?: import('@/types/aso').SevenDayActionPlan
    }
  >(PROMPTS.bulkScan.buildUser(ctx), PROMPTS.bulkScan.system)

  if (!raw?.keywords?.length) return null

  return {
    ...raw,
    success: true,
    analyzedAt: raw.analyzedAt || new Date().toISOString(),
    primaryApp: ctx.primaryApp,
    language: ctx.languageLabel,
    keywords: raw.keywords.map((k) => ({
      ...k,
      estimatedVolume: clamp(k.estimatedVolume ?? 100, 1, 100000),
      difficulty: clamp(k.difficulty ?? 50, 0, 100),
      opportunityScore: clamp(k.opportunityScore ?? 50, 0, 100),
      relevanceToApp: clamp(k.relevanceToApp ?? 50, 0, 100),
      longTailSuggestions: k.longTailSuggestions?.slice(0, 6) ?? [],
      competitionLevel: k.competitionLevel ?? competitionFromDifficulty(k.difficulty ?? 50),
    })),
    topCompetitors: raw.topCompetitors?.slice(0, 10) ?? aggregateTopCompetitors(ctx.keywordContexts),
    recommendedTitleKeywords: raw.recommendedTitleKeywords ?? [],
    strategySummary: raw.strategySummary ?? '',
    quickActions: raw.quickActions ?? [],
    actionPlan7Days: normalizeActionPlan(raw.actionPlan7Days, [
      ...(raw.quickActions ?? []),
      ...DEFAULT_ACTION_PLAN_FALLBACKS,
    ], ctx.appContext.app.title),
  }
}

export async function runBulkScan(params: RunBulkScanParams): Promise<BulkScanResult> {
  const { packageNames, keywords, language } = params
  const primaryApp = packageNames[0] || 'unknown'
  const keywordsHash = hashKeywords(keywords)
  const cacheKey = CACHE_KEYS.bulkScan(language.gl, primaryApp, keywordsHash)

  const cached = await cacheGet<BulkScanResult>(cacheKey)
  if (cached) {
    return { ...cached, fromCache: true }
  }

  const ctx = await fetchEnrichedBulkScanContext({
    packageNames,
    keywords,
    country: language.gl,
    lang: language.hl,
    languageLabel: language.label,
  })

  let result: BulkScanResult
  if (getGeminiClient()) {
    const geminiResult = await analyzeWithGemini(ctx)
    result = geminiResult ?? buildHeuristicFromEnriched(ctx, language.label)
    if (!geminiResult) result.fallbackMode = true
  } else {
    result = buildHeuristicFromEnriched(ctx, language.label)
  }

  if (!result.actionPlan7Days) {
    result.actionPlan7Days = normalizeActionPlan(undefined, DEFAULT_ACTION_PLAN_FALLBACKS, ctx.appContext.app.title)
  }

  await cacheSet(cacheKey, result, CACHE_TTL.BULK_SCAN)
  return result
}
