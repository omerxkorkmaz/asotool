import type { BulkScanResult } from '@/types/gemini'
import type { HealthScoreBreakdown, HealthScoreCriterion } from '@/types/app'
import type { PlayAppDetail, PlaySearchResult } from '@/types/scraper'
import type { MetadataQualitySignals } from '@/types/aso'
import { analyzeMetadataQuality } from '@/lib/metadata-quality'

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9ğüşıöç\s-]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
}

export interface HealthScoreInput {
  app: PlayAppDetail
  bulkScanResults?: BulkScanResult[]
  genreSearchResults?: PlaySearchResult[]
  genreSearchRank?: number | null
  metadataQuality?: MetadataQualitySignals
  targetKeywords?: string[]
}

const WEIGHTS = {
  keywordCoverage: 0.28,
  titleMetadata: 0.27,
  competitorPositioning: 0.2,
  opportunityAverage: 0.15,
  recentActivity: 0.1,
} as const

const PLAY_LIMITS = { title: 30, summary: 80, description: 4000 } as const

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function scoreKeywordCoverage(
  app: PlayAppDetail,
  bulkScans: BulkScanResult[],
  meta: MetadataQualitySignals,
  targetKeywords: string[]
): { score: number; explanation: string } {
  const latest = bulkScans[0]
  const titleLower = (app.title || '').toLowerCase()
  const summaryLower = (app.summary || '').toLowerCase()
  const descLead = (app.description || '').slice(0, 300).toLowerCase()

  if (latest?.keywords?.length) {
    let inTitle = 0
    let inSummary = 0
    let inDescLead = 0
    let rankedCount = 0

    for (const kw of latest.keywords) {
      const k = kw.keyword.toLowerCase()
      if (titleLower.includes(k)) inTitle++
      if (summaryLower.includes(k)) inSummary++
      if (descLead.includes(k)) inDescLead++
      if (kw.relevanceToApp >= 55) rankedCount++
    }
    const n = latest.keywords.length
    const metadataCoverage = ((inTitle * 3 + inSummary * 2 + inDescLead) / (n * 6)) * 100
    const avgRelevance = latest.keywords.reduce((s, k) => s + k.relevanceToApp, 0) / n
    const avgOpp = latest.keywords.reduce((s, k) => s + k.opportunityScore, 0) / n
    const score = clamp(metadataCoverage * 0.45 + avgRelevance * 0.35 + (avgOpp > 50 ? 15 : 5))

    return {
      score,
      explanation: `Bulk scan (${n} kelime): ${inTitle} başlıkta, ${inSummary} özette, ${inDescLead} açıklama girişinde. Ort. uyumluluk %${Math.round(avgRelevance)}.`,
    }
  }

  const keywords = targetKeywords.length ? targetKeywords : tokenize(`${app.genre || ''} ${app.title}`).slice(0, 6)
  const covered = keywords.filter(
    (k) =>
      titleLower.includes(k) || summaryLower.includes(k) || descLead.includes(k.toLowerCase())
  ).length
  const coverageRatio = keywords.length ? covered / keywords.length : 0
  const metaBonus =
    meta.keywordsInTitle.length * 8 + meta.keywordsInSummary.length * 5 + meta.keywordsInDescriptionLead.length * 3
  const score = clamp(coverageRatio * 55 + Math.min(metaBonus, 35))

  return {
    score,
    explanation: `${keywords.length} hedef kelimeden ${covered} tanesi metadata'da. Bulk Scan ile kesinleşir.`,
  }
}

function scoreTitleMetadata(meta: MetadataQualitySignals): { score: number; explanation: string } {
  let score = 0
  const parts: string[] = []

  if (meta.titleLength === 0) {
    parts.push('başlık eksik')
  } else if (meta.titleWithinPlayLimit && meta.titleLength >= 10) {
    score += 35
    parts.push(`başlık ${meta.titleLength}/${PLAY_LIMITS.title} — Play limiti içinde`)
  } else if (meta.titleLength > PLAY_LIMITS.title) {
    score += 10
    parts.push(`başlık ${meta.titleLength} kar — Play limiti (${PLAY_LIMITS.title}) aşılmış`)
  } else {
    score += 20
    parts.push(`başlık kısa (${meta.titleLength} kar)`)
  }

  if (meta.summaryLength === 0) {
    parts.push('kısa açıklama boş')
  } else if (meta.summaryWithinPlayLimit && meta.summaryLength >= 25) {
    score += 30
    parts.push(`özet ${meta.summaryLength}/${PLAY_LIMITS.summary} — ideal aralık`)
  } else if (meta.summaryLength > PLAY_LIMITS.summary) {
    score += 8
    parts.push(`özet limit aşımı (${meta.summaryLength}/${PLAY_LIMITS.summary})`)
  } else {
    score += 15
    parts.push(`özet kısa (${meta.summaryLength} kar)`)
  }

  if (meta.descriptionLength >= 800) {
    score += 25
    parts.push('açıklama kapsamlı')
  } else if (meta.descriptionLength >= 350) {
    score += 18
    parts.push('açıklama orta uzunlukta')
  } else if (meta.descriptionLength >= 120) {
    score += 10
    parts.push('açıklama kısa — genişlet')
  } else {
    score += 4
    parts.push('açıklama çok zayıf')
  }

  if (meta.firstParagraphWordCount >= 25) score += 5
  if (meta.hasBulletStructure) score += 5
  if (meta.keywordStuffingRisk === 'yüksek') {
    score -= 10
    parts.push('keyword stuffing riski yüksek')
  } else if (meta.keywordStuffingRisk === 'düşük' && meta.keywordsInTitle.length > 0) {
    score += 5
  }

  if (meta.missingHighValueKeywords.length > 0) {
    parts.push(`${meta.missingHighValueKeywords.length} hedef keyword metadata'da yok`)
  }

  return { score: clamp(score), explanation: parts.join('; ') + '.' }
}

function scoreCompetitorPositioning(
  app: PlayAppDetail,
  genreResults: PlaySearchResult[],
  genreSearchRank: number | null | undefined
): { score: number; explanation: string } {
  const myScore = app.score ?? 0
  const myRatings = app.ratings ?? 0

  if (genreResults.length > 0) {
    const top10 = genreResults.slice(0, 10)
    const avgScore = top10.reduce((s, a) => s + (a.score ?? 0), 0) / top10.length
    const avgRatings = top10.reduce((s, a) => s + (a.ratings ?? 0), 0) / top10.length
    const rank = genreSearchRank ?? genreResults.findIndex((a) => a.appId === app.appId) + 1
    const effectiveRank = rank > 0 ? rank : null

    let score = 35
    if (myScore >= avgScore + 0.2) score += 20
    else if (myScore >= avgScore - 0.3) score += 10
    else score -= 5

    if (myRatings >= avgRatings) score += 15
    else if (myRatings >= avgRatings * 0.4) score += 8
    else score += 2

    if (effectiveRank && effectiveRank <= 5) score += 25
    else if (effectiveRank && effectiveRank <= 15) score += 15
    else if (effectiveRank && effectiveRank <= 30) score += 8
    else score += 0

    return {
      score: clamp(score),
      explanation: effectiveRank
        ? `Genre aramasında #${effectiveRank}. Rakip ort. ${avgScore.toFixed(1)}★ / ${Math.round(avgRatings).toLocaleString('tr-TR')} rating. Sen: ${myScore.toFixed(1)}★.`
        : `Genre ilk 50'de görünmüyorsun. Rakip ort. ${avgScore.toFixed(1)}★.`,
    }
  }

  const ratingScore = myRatings > 50000 ? 35 : myRatings > 5000 ? 25 : myRatings > 500 ? 15 : 8
  const scoreScore = overlayScore(myScore)
  return {
    score: clamp(ratingScore + scoreScore),
    explanation: `Puan ${myScore.toFixed(1)}, ${myRatings.toLocaleString('tr-TR')} rating. Genre karşılaştırması için arama yapılamadı.`,
  }
}

function overlayScore(myScore: number): number {
  if (myScore >= 4.5) return 35
  if (myScore >= 4.2) return 28
  if (myScore >= 4.0) return 20
  if (myScore >= 3.5) return 12
  return 5
}

function scoreOpportunityAverage(bulkScans: BulkScanResult[]): { score: number; explanation: string } {
  const latest = bulkScans[0]
  if (!latest?.keywords?.length) {
    return { score: 38, explanation: 'Bulk scan yok — fırsat skoru tahmini düşük güvenilirlikte.' }
  }
  const avg = latest.keywords.reduce((s, k) => s + k.opportunityScore, 0) / latest.keywords.length
  const highOpp = latest.keywords.filter((k) => k.opportunityScore >= 65).length
  const unranked = latest.keywords.filter((k) => k.relevanceToApp < 40).length
  let score = avg
  if (highOpp >= 3) score += 8
  if (unranked > latest.keywords.length / 2) score -= 10
  return {
    score: clamp(score),
    explanation: `Ort. fırsat ${Math.round(avg)}/100. ${highOpp} yüksek fırsat (≥65). ${unranked} kelimede zayıf görünürlük.`,
  }
}

function scoreRecentActivity(app: PlayAppDetail): { score: number; explanation: string } {
  const updated = app.updated
  if (!updated) return { score: 35, explanation: 'Son güncelleme bilinmiyor.' }
  const days = Math.floor((Date.now() - updated) / (1000 * 60 * 60 * 24))
  if (days <= 21) return { score: 100, explanation: `${days} gün önce güncellendi — aktif.` }
  if (days <= 60) return { score: 75, explanation: `${days} gün önce — kabul edilebilir.` }
  if (days <= 120) return { score: 45, explanation: `${days} gün önce — güncelleme önerilir.` }
  if (days <= 365) return { score: 20, explanation: `${days} gün önce — algoritma için risk.` }
  return { score: 8, explanation: `${days} gün önce — kritik güncelleme gecikmesi.` }
}

function buildCriterion(
  key: HealthScoreCriterion['key'],
  label: string,
  weight: number,
  score: number,
  explanation: string
): HealthScoreCriterion {
  return {
    key,
    label,
    weight,
    score: clamp(score),
    weightedScore: clamp(score * weight),
    explanation,
  }
}

export function computeHealthScore(input: HealthScoreInput): HealthScoreBreakdown {
  const {
    app,
    bulkScanResults = [],
    genreSearchResults = [],
    genreSearchRank,
    targetKeywords = [],
  } = input

  const meta = input.metadataQuality ?? analyzeMetadataQuality(app, targetKeywords)

  const kw = scoreKeywordCoverage(app, bulkScanResults, meta, targetKeywords)
  const metaScore = scoreTitleMetadata(meta)
  const comp = scoreCompetitorPositioning(app, genreSearchResults, genreSearchRank)
  const opp = scoreOpportunityAverage(bulkScanResults)
  const activity = scoreRecentActivity(app)

  const criteria: HealthScoreCriterion[] = [
    buildCriterion('keywordCoverage', 'Keyword Coverage', WEIGHTS.keywordCoverage, kw.score, kw.explanation),
    buildCriterion('titleMetadata', 'Title & Metadata', WEIGHTS.titleMetadata, metaScore.score, metaScore.explanation),
    buildCriterion('competitorPositioning', 'Competitor Positioning', WEIGHTS.competitorPositioning, comp.score, comp.explanation),
    buildCriterion('opportunityAverage', 'Opportunity Score Ort.', WEIGHTS.opportunityAverage, opp.score, opp.explanation),
    buildCriterion('recentActivity', 'Recent Activity', WEIGHTS.recentActivity, activity.score, activity.explanation),
  ]

  const total = clamp(criteria.reduce((s, c) => s + c.weightedScore, 0))

  return {
    total,
    criteria,
    computedAt: new Date().toISOString(),
  }
}

export function healthScoreColor(score: number): 'red' | 'yellow' | 'green' {
  if (score >= 70) return 'green'
  if (score >= 45) return 'yellow'
  return 'red'
}

export const HEALTH_COLOR_MAP = {
  red: { stroke: 'var(--red)', bg: 'var(--red-dim)', text: 'var(--red)' },
  yellow: { stroke: 'var(--warn)', bg: 'var(--warn-dim)', text: 'var(--warn)' },
  green: { stroke: 'var(--accent)', bg: 'var(--accent-dim)', text: 'var(--accent)' },
} as const
