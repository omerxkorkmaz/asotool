import { geminiJson, getGeminiClient, stripMarkdown } from '@/lib/gemini'
import { cacheGet, cacheSet, CACHE_TTL } from '@/lib/cache'
import { CACHE_KEYS, hashKeywords } from '@/lib/cache-keys'
import { getLatestBulkScanKeywords } from '@/lib/app-manager'
import { fetchEnrichedApp } from '@/lib/data-layer'
import { BULK_SCAN_LANGUAGES } from '@/lib/languages'
import { PROMPTS, normalizeActionPlan, DEFAULT_ACTION_PLAN_FALLBACKS } from '@/lib/gemini-prompts'
import type {
  CurrentMetadata,
  ExpectedImpact,
  GeminiMetadataResponse,
  MetadataComparisonRow,
  MetadataOptimizerContext,
  MetadataOptimizerRequest,
  MetadataOptimizerResult,
  MetadataSuggestion,
} from '@/types/metadata'
import type { AppLanguage } from '@/lib/languages'

const LIMITS = { title: 30, short: 80, full: 4000 } as const

function resolveLanguage(gl: string): AppLanguage {
  return BULK_SCAN_LANGUAGES.find((l) => l.gl === gl) ?? BULK_SCAN_LANGUAGES[0]
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).trim() + '…'
}

function impactScore(impact: ExpectedImpact): number {
  if (impact === 'Yüksek') return 3
  if (impact === 'Orta') return 2
  return 1
}

function normalizeSuggestion(raw: MetadataSuggestion): MetadataSuggestion {
  const title = truncate(stripMarkdown(raw.title) ?? raw.title, LIMITS.title)
  const shortDescription = truncate(stripMarkdown(raw.shortDescription) ?? raw.shortDescription, LIMITS.short)
  const fullDescription = truncate(stripMarkdown(raw.fullDescription) ?? raw.fullDescription, LIMITS.full)

  const impact: ExpectedImpact =
    raw.expectedImpact === 'Yüksek' || raw.expectedImpact === 'Orta' || raw.expectedImpact === 'Düşük'
      ? raw.expectedImpact
      : 'Orta'

  return {
    version: raw.version || '?',
    title,
    shortDescription,
    fullDescription,
    usedKeywords: (raw.usedKeywords || []).slice(0, 15),
    expectedImpact: impact,
    reasoning: stripMarkdown(raw.reasoning) ?? raw.reasoning ?? '',
    characterCount: {
      title: title.length,
      short: shortDescription.length,
      full: fullDescription.length,
    },
  }
}

function buildComparison(suggestions: MetadataSuggestion[]): MetadataComparisonRow[] {
  return suggestions.map((s) => ({
    version: s.version,
    titleChars: s.characterCount.title,
    shortChars: s.characterCount.short,
    fullChars: s.characterCount.full,
    keywordCount: s.usedKeywords.length,
    expectedImpact: s.expectedImpact,
    rankScore:
      impactScore(s.expectedImpact) * 30 +
      s.usedKeywords.length * 5 +
      (LIMITS.title - s.characterCount.title) * 0.5,
  }))
}

function pickRecommended(
  suggestions: MetadataSuggestion[],
  geminiPick: string,
  reason: string
): { version: string; reason: string } {
  const byVersion = suggestions.find((s) => s.version === geminiPick)
  if (byVersion) return { version: geminiPick, reason }

  const sorted = [...suggestions].sort((a, b) => {
    const score = (s: MetadataSuggestion) =>
      impactScore(s.expectedImpact) * 100 + s.usedKeywords.length * 10
    return score(b) - score(a)
  })
  return {
    version: sorted[0]?.version ?? 'A',
    reason: reason || 'En yüksek fırsat skoru ve keyword kapsamına göre otomatik seçildi.',
  }
}

export async function fetchMetadataContext(
  packageName: string,
  languageGl: string
): Promise<MetadataOptimizerContext> {
  const lang = resolveLanguage(languageGl)
  const enriched = await fetchEnrichedApp(packageName, {
    country: lang.gl,
    lang: lang.hl,
    languageLabel: lang.label,
  })

  const { keywords, hasBulkScan } = await getLatestBulkScanKeywords(packageName)

  return {
    packageName: packageName.trim().toLowerCase(),
    language: lang.gl,
    currentMetadata: {
      title: enriched.app.title,
      shortDescription: enriched.app.summary || '',
      fullDescription: enriched.app.description || '',
      icon: undefined,
      genre: enriched.app.genre,
      score: enriched.app.score,
    },
    bulkScanKeywords: keywords,
    hasBulkScan,
  }
}

async function callGemini(
  ctx: MetadataOptimizerContext,
  targetKeywords: string[],
  lang: AppLanguage
): Promise<GeminiMetadataResponse | null> {
  const enriched = await fetchEnrichedApp(
    ctx.packageName,
    { country: lang.gl, lang: lang.hl, languageLabel: lang.label },
    targetKeywords
  )

  return geminiJson<GeminiMetadataResponse>(
    PROMPTS.metadataOptimizer.buildUser(ctx, targetKeywords, lang.label, enriched),
    PROMPTS.metadataOptimizer.system
  )
}

function buildFallbackSuggestions(ctx: MetadataOptimizerContext, keywords: string[]): MetadataSuggestion[] {
  const kw = keywords.slice(0, 3)
  const base = ctx.currentMetadata.title
  const variants = [
    { version: 'A', suffix: kw[0] ? ` ${kw[0]}` : '', impact: 'Orta' as ExpectedImpact, note: 'Keyword odaklı' },
    { version: 'B', suffix: ' Pro', impact: 'Düşük' as ExpectedImpact, note: 'Dönüşüm odaklı' },
    { version: 'C', suffix: kw[1] ? ` - ${kw[1]}` : ' Plus', impact: 'Düşük' as ExpectedImpact, note: 'Alternatif keyword' },
  ]

  return variants.map((v) => {
    const title = truncate(base + v.suffix, LIMITS.title)
    const shortDescription = truncate(
      kw.length
        ? `${kw.join(', ')} — ${ctx.currentMetadata.shortDescription || base}`.slice(0, LIMITS.short)
        : ctx.currentMetadata.shortDescription || base,
      LIMITS.short
    )
    const fullDescription = truncate(`${ctx.currentMetadata.fullDescription}\n\n${kw.join(' ')}`.trim(), LIMITS.full)
    return normalizeSuggestion({
      version: v.version,
      title,
      shortDescription,
      fullDescription,
      usedKeywords: kw.filter(
        (k) =>
          title.toLowerCase().includes(k.toLowerCase()) ||
          fullDescription.toLowerCase().includes(k.toLowerCase())
      ),
      expectedImpact: v.impact,
      reasoning: `${v.note}. Scrape verisine dayalı heuristik — GEMINI_API_KEY ile zenginleştirin.`,
      characterCount: { title: title.length, short: shortDescription.length, full: fullDescription.length },
    })
  })
}

export async function runMetadataOptimizer(
  req: MetadataOptimizerRequest
): Promise<MetadataOptimizerResult> {
  const pkg = req.packageName.trim().toLowerCase()
  const lang = resolveLanguage(req.language)

  let targetKeywords = (req.keywords || []).map((k) => k.trim()).filter(Boolean)
  if (req.useBulkScan !== false && targetKeywords.length === 0) {
    const bulk = await getLatestBulkScanKeywords(pkg)
    targetKeywords = bulk.keywords
  }

  const keywordsHash = hashKeywords(targetKeywords.length ? targetKeywords : ['default'])
  const cacheKey = CACHE_KEYS.metadataOptimizer(pkg, lang.gl, keywordsHash)

  const cached = await cacheGet<MetadataOptimizerResult>(cacheKey)
  if (cached) return { ...cached, fromCache: true }

  const ctx = await fetchMetadataContext(pkg, lang.gl)
  const aiAvailable = !!getGeminiClient()

  let suggestions: MetadataSuggestion[]
  let recommendedVersion = 'A'
  let recommendationReason = ''
  let actionPlan7Days = normalizeActionPlan(undefined, DEFAULT_ACTION_PLAN_FALLBACKS, ctx.currentMetadata.title)

  if (aiAvailable) {
    const gemini = await callGemini(ctx, targetKeywords, lang)
    if (gemini?.suggestions?.length) {
      suggestions = gemini.suggestions.slice(0, 3).map(normalizeSuggestion)
      const pick = pickRecommended(suggestions, gemini.recommendedVersion, gemini.recommendationReason)
      recommendedVersion = pick.version
      recommendationReason = pick.reason
      actionPlan7Days = normalizeActionPlan(gemini.actionPlan7Days, DEFAULT_ACTION_PLAN_FALLBACKS, ctx.currentMetadata.title)
    } else {
      suggestions = buildFallbackSuggestions(ctx, targetKeywords)
      recommendationReason = 'Gemini yanıt veremedi — heuristik fallback.'
    }
  } else {
    suggestions = buildFallbackSuggestions(ctx, targetKeywords)
    recommendationReason = 'GEMINI_API_KEY tanımlı değil — sınırlı heuristik öneriler.'
  }

  const result: MetadataOptimizerResult = {
    success: true,
    packageName: pkg,
    language: lang.gl,
    languageLabel: lang.label,
    generatedAt: new Date().toISOString(),
    currentMetadata: ctx.currentMetadata,
    targetKeywords,
    suggestions,
    recommendedVersion,
    recommendationReason,
    comparison: buildComparison(suggestions),
    actionPlan7Days,
    aiAvailable,
  }

  await cacheSet(cacheKey, result, CACHE_TTL.METADATA_OPTIMIZER)
  return result
}
