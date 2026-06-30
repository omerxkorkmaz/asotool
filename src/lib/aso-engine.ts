/**
 * Full ASO Audit engine — orchestrates data-layer, health score, bulk scan context, Gemini strategy.
 */

import { geminiJson, getGeminiClient } from '@/lib/gemini'
import { cacheGet, cacheSet, CACHE_TTL } from '@/lib/cache'
import { CACHE_KEYS } from '@/lib/cache-keys'
import { fetchEnrichedApp, fetchEnrichedBulkScanContext } from '@/lib/data-layer'
import { computeHealthScore } from '@/lib/health-score'
import { getLatestBulkScanKeywords } from '@/lib/app-manager'
import {
  PROMPTS,
  normalizeActionPlan,
  DEFAULT_ACTION_PLAN_FALLBACKS,
  buildAppIdentityFromEnriched,
  getWeakestCriteria,
  assessDataConfidence,
} from '@/lib/gemini-prompts'
import { BULK_SCAN_LANGUAGES } from '@/lib/languages'
import { getRedis } from '@/lib/redis'
import type { BulkScanResult } from '@/types/gemini'
import type { AsoAuditResult, CompetitorGapItem, SevenDayActionPlan } from '@/types/aso'
import type { EnrichedKeywordContext } from '@/types/aso'
import type { AppLanguage } from '@/lib/languages'

export interface RunAsoAuditParams {
  packageName: string
  language?: string
  keywords?: string[]
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

async function loadBulkScanHistory(packageName: string): Promise<BulkScanResult[]> {
  const redis = getRedis()
  if (!redis) return []
  const raw =
    (await redis.get<Array<{ savedAt: string; result: BulkScanResult }>>(
      CACHE_KEYS.bulkScanHistory(packageName.trim().toLowerCase())
    )) || []
  return raw.map((e) => e.result).filter(Boolean)
}

function resolveLanguage(gl: string): AppLanguage {
  return BULK_SCAN_LANGUAGES.find((l) => l.gl === gl) ?? BULK_SCAN_LANGUAGES[0]
}

function buildHeuristicGaps(
  keywordContexts: EnrichedKeywordContext[],
  metadataMissing: string[],
  appTitle: string
): CompetitorGapItem[] {
  const gaps: CompetitorGapItem[] = []

  for (const kc of keywordContexts) {
    const top = kc.topResults[0]
    if (kc.myRank === null || kc.myRank > 30) {
      gaps.push({
        keyword: kc.keyword,
        myRank: kc.myRank,
        topCompetitorTitle: top?.title ?? 'bilinmiyor',
        gapType: 'ranking',
        severity: kc.myRank === null ? 'kritik' : kc.myRank > 50 ? 'kritik' : 'orta',
        recommendation: kc.myRank
          ? `"${appTitle}" #${kc.myRank} → "${kc.keyword}" için ilk 20 hedefi: başlık ve kısa açıklamaya ekle`
          : `"${appTitle}" "${kc.keyword}" için ilk 100'de değil — metadata ve long-tail optimizasyonu`,
      })
    }
  }

  for (const kw of metadataMissing.slice(0, 5)) {
    gaps.push({
      keyword: kw,
      myRank: null,
      topCompetitorTitle: '—',
      gapType: 'metadata',
      severity: 'orta',
      recommendation: `"${appTitle}" metadata'sında "${kw}" eksik (başlık/özet/açıklama girişi)`,
    })
  }

  return gaps.slice(0, 12)
}

function buildHeuristicOpportunities(
  bulkScan: BulkScanResult | undefined,
  keywordContexts: EnrichedKeywordContext[]
) {
  if (bulkScan?.keywords?.length) {
    return bulkScan.keywords.slice(0, 10).map((k) => ({
      keyword: k.keyword,
      opportunityScore: clamp(k.opportunityScore, 0, 100),
      myRank: keywordContexts.find((c) => c.keyword === k.keyword)?.myRank ?? null,
      reasoning: k.reasoning,
    }))
  }
  return keywordContexts.slice(0, 8).map((kc) => ({
    keyword: kc.keyword,
    opportunityScore: clamp(Math.max(20, 100 - kc.marketStats.dominanceScore), 0, 85),
    myRank: kc.myRank,
    reasoning: `Scrape: ${kc.totalResults} sonuç, top10 ort. ${kc.marketStats.top10AvgRatings} rating, sıra: ${kc.myRank ?? 'yok'}`,
  }))
}

function buildHeuristicMetadataHighlights(
  enriched: Awaited<ReturnType<typeof fetchEnrichedApp>>
): string[] {
  const m = enriched.metadataQuality
  const title = enriched.app.title
  const highlights: string[] = []
  if (!m.titleWithinPlayLimit) highlights.push(`"${title}" başlığı ${m.titleLength} kar — Play limiti 30`)
  if (!m.summaryWithinPlayLimit) highlights.push(`"${title}" kısa açıklama ${m.summaryLength} kar — limit 80`)
  if (m.missingHighValueKeywords.length)
    highlights.push(`"${title}" için eksik keyword'ler: ${m.missingHighValueKeywords.slice(0, 5).join(', ')}`)
  if (!m.hasBulletStructure) highlights.push(`"${title}" açıklamasına madde işaretli yapı ekle`)
  if (m.firstParagraphWordCount < 20)
    highlights.push(`"${title}" ilk paragraf çok kısa — keyword + fayda cümlesi ekle`)
  if (m.keywordStuffingRisk === 'yüksek') highlights.push(`"${title}" keyword stuffing riski — yoğunluğu azalt`)
  if (highlights.length === 0) highlights.push(`"${title}" metadata temeli kabul edilebilir — A/B test önerilir`)
  return highlights
}

function sanitizeCompetitorGaps(
  raw: CompetitorGapItem[] | undefined,
  knownKeywords: Set<string>,
  fallback: CompetitorGapItem[]
): CompetitorGapItem[] {
  if (!raw?.length) return fallback
  const valid = raw.filter((g) => {
    if (!g.keyword || !knownKeywords.has(g.keyword)) return false
    const sev = g.severity
    if (sev !== 'kritik' && sev !== 'orta' && sev !== 'düşük') g.severity = 'orta'
    return true
  })
  return valid.length ? valid.slice(0, 12) : fallback
}

function sanitizeKeywordOpportunities(
  raw: AsoAuditResult['keywordOpportunities'] | undefined,
  knownKeywords: Set<string>,
  fallback: AsoAuditResult['keywordOpportunities']
): AsoAuditResult['keywordOpportunities'] {
  if (!raw?.length) return fallback
  const valid = raw
    .filter((k) => knownKeywords.has(k.keyword))
    .map((k) => ({
      ...k,
      opportunityScore: clamp(k.opportunityScore ?? 50, 0, 100),
      reasoning: k.reasoning || 'Veri tabanlı fırsat değerlendirmesi',
    }))
  return valid.length ? valid.slice(0, 12) : fallback
}

export async function runFullAsoAudit(params: RunAsoAuditParams): Promise<AsoAuditResult> {
  const pkg = params.packageName.trim().toLowerCase()
  const lang = resolveLanguage(params.language ?? 'tr')
  const cacheKey = CACHE_KEYS.asoAudit(pkg, lang.gl)

  const cached = await cacheGet<AsoAuditResult>(cacheKey)
  if (cached) return { ...cached, fromCache: true }

  const bulkHistory = await loadBulkScanHistory(pkg)
  const latestBulk = bulkHistory[0]
  const { keywords: bulkKeywords } = await getLatestBulkScanKeywords(pkg)

  const targetKeywords = params.keywords?.length
    ? params.keywords
    : bulkKeywords.length
      ? bulkKeywords
      : []

  const enriched = await fetchEnrichedApp(
    pkg,
    { country: lang.gl, lang: lang.hl, languageLabel: lang.label },
    targetKeywords
  )

  let keywordContexts: EnrichedKeywordContext[] = []
  if (targetKeywords.length) {
    const bulkCtx = await fetchEnrichedBulkScanContext({
      packageNames: [pkg],
      keywords: targetKeywords.slice(0, 10),
      country: lang.gl,
      lang: lang.hl,
      languageLabel: lang.label,
    })
    keywordContexts = bulkCtx.keywordContexts
  }

  const knownKeywords = new Set([
    ...targetKeywords,
    ...keywordContexts.map((k) => k.keyword),
    ...(latestBulk?.keywords.map((k) => k.keyword) ?? []),
  ])

  const healthBreakdown = computeHealthScore({
    app: {
      appId: enriched.app.appId,
      title: enriched.app.title,
      developer: enriched.app.developer,
      description: enriched.app.description,
      summary: enriched.app.summary,
      genre: enriched.app.genre,
      score: enriched.app.score,
      ratings: enriched.app.ratings,
      updated: enriched.app.updated,
    },
    bulkScanResults: bulkHistory,
    genreSearchResults: enriched.genreTopApps.map((a) => ({
      appId: a.appId,
      title: a.title,
      developer: '',
      score: a.score,
      ratings: a.ratings,
    })),
    genreSearchRank: enriched.genreSearchRank,
    metadataQuality: enriched.metadataQuality,
    targetKeywords,
  })

  const appTitle = enriched.app.title
  const heuristicGaps = buildHeuristicGaps(
    keywordContexts,
    enriched.metadataQuality.missingHighValueKeywords,
    appTitle
  )
  const heuristicOpportunities = buildHeuristicOpportunities(latestBulk, keywordContexts)
  const metadataHighlights = buildHeuristicMetadataHighlights(enriched)

  const weakest = getWeakestCriteria(healthBreakdown)
  const dataConfidence = assessDataConfidence({
    hasBulkScan: !!latestBulk,
    keywordCount: keywordContexts.length,
    hasGemini: !!getGeminiClient(),
  })

  const aiAvailable = !!getGeminiClient()
  let strategySummary =
    latestBulk?.strategySummary ??
    `"${appTitle}" için ASO audit — health ${healthBreakdown.total}/100. Öncelik: ${weakest.join(', ') || 'metadata optimizasyonu'}.`
  let competitorGaps = heuristicGaps
  let keywordOpportunities = heuristicOpportunities
  let actionPlan7Days: SevenDayActionPlan = normalizeActionPlan(
    latestBulk?.actionPlan7Days,
    DEFAULT_ACTION_PLAN_FALLBACKS,
    appTitle
  )
  let fallbackMode = false

  if (aiAvailable) {
    const auditPrompt = PROMPTS.asoAudit.buildUser({
      appIdentity: buildAppIdentityFromEnriched(enriched),
      healthScore: healthBreakdown.total,
      weakestCriteria: weakest,
      enriched,
      healthBreakdown,
      bulkScanLatest: latestBulk ?? null,
      keywordContexts,
      heuristicGaps,
      metadataHighlights,
      dataConfidence,
    })

    const ai = await geminiJson<{
      strategySummary?: string
      metadataHighlights?: string[]
      competitorGaps?: CompetitorGapItem[]
      keywordOpportunities?: AsoAuditResult['keywordOpportunities']
      actionPlan7Days?: SevenDayActionPlan
    }>(auditPrompt, PROMPTS.asoAudit.system)

    if (ai) {
      if (ai.strategySummary?.trim()) strategySummary = ai.strategySummary
      if (ai.metadataHighlights?.length) {
        metadataHighlights.splice(0, metadataHighlights.length, ...ai.metadataHighlights.slice(0, 8))
      }
      competitorGaps = sanitizeCompetitorGaps(ai.competitorGaps, knownKeywords, heuristicGaps)
      keywordOpportunities = sanitizeKeywordOpportunities(
        ai.keywordOpportunities,
        knownKeywords,
        heuristicOpportunities
      )
      actionPlan7Days = normalizeActionPlan(ai.actionPlan7Days, DEFAULT_ACTION_PLAN_FALLBACKS, appTitle)
    } else {
      fallbackMode = true
    }
  } else {
    fallbackMode = true
  }

  const result: AsoAuditResult = {
    success: true,
    packageName: pkg,
    language: lang.gl,
    languageLabel: lang.label,
    auditedAt: new Date().toISOString(),
    aiAvailable,
    fallbackMode,
    healthScore: healthBreakdown.total,
    healthBreakdown,
    keywordOpportunities,
    metadataHighlights,
    competitorGaps,
    strategySummary,
    actionPlan7Days,
    dataSources: enriched.autocompleteSeeds.length
      ? ['google-play-scraper', 'play-autocomplete', 'genre-search', 'play-reviews-sample']
      : ['google-play-scraper', 'genre-search'],
  }

  await cacheSet(cacheKey, result, CACHE_TTL.ASO_AUDIT)
  return result
}

/** Gemini-powered health score narrative (optional enrichment) */
export async function generateHealthInsights(
  packageName: string,
  languageGl: string
): Promise<{ insights: Record<string, unknown>; actionPlan7Days: SevenDayActionPlan } | null> {
  const lang = resolveLanguage(languageGl)
  const enriched = await fetchEnrichedApp(packageName, {
    country: lang.gl,
    lang: lang.hl,
    languageLabel: lang.label,
  })
  const bulkHistory = await loadBulkScanHistory(packageName)
  const breakdown = computeHealthScore({
    app: {
      appId: enriched.app.appId,
      title: enriched.app.title,
      developer: enriched.app.developer,
      description: enriched.app.description,
      summary: enriched.app.summary,
      genre: enriched.app.genre,
      score: enriched.app.score,
      ratings: enriched.app.ratings,
      updated: enriched.app.updated,
    },
    bulkScanResults: bulkHistory,
    genreSearchRank: enriched.genreSearchRank,
    metadataQuality: enriched.metadataQuality,
  })

  if (!getGeminiClient()) return null

  const raw = await geminiJson<Record<string, unknown>>(
    PROMPTS.healthScore.buildUser({
      appTitle: enriched.app.title,
      packageName,
      breakdown,
      metadataQuality: enriched.metadataQuality,
      bulkScanSummary: bulkHistory[0]?.strategySummary,
      genreRank: enriched.genreSearchRank,
    }),
    PROMPTS.healthScore.system
  )

  if (!raw) return null

  return {
    insights: raw,
    actionPlan7Days: normalizeActionPlan(
      raw.actionPlan7Days as SevenDayActionPlan | undefined,
      DEFAULT_ACTION_PLAN_FALLBACKS,
      enriched.app.title
    ),
  }
}
