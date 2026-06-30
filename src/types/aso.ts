/** Shared ASO analysis output types */

export interface ActionPlanDay {
  day: number
  title: string
  action: string
  priority: 'yüksek' | 'orta' | 'düşük'
  expectedOutcome: string
}

/** Numaralandırılmış 7 günlük aksiyon planı */
export interface SevenDayActionPlan {
  summary: string
  days: ActionPlanDay[]
}

export interface MetadataQualitySignals {
  titleLength: number
  summaryLength: number
  descriptionLength: number
  titleWithinPlayLimit: boolean
  summaryWithinPlayLimit: boolean
  descriptionWithinPlayLimit: boolean
  keywordsInTitle: string[]
  keywordsInSummary: string[]
  keywordsInDescriptionLead: string[]
  missingHighValueKeywords: string[]
  firstParagraphWordCount: number
  hasBulletStructure: boolean
  keywordStuffingRisk: 'düşük' | 'orta' | 'yüksek'
}

export interface CompetitorMarketStats {
  keyword: string
  myRank: number | null
  totalResults: number
  top10AvgScore: number
  top10AvgRatings: number
  top10MedianInstalls: string | null
  dominanceScore: number
  suggestVariants: string[]
}

export interface EnrichedAppContext {
  packageName: string
  country: string
  lang: string
  languageLabel: string
  fetchedAt: string
  app: {
    appId: string
    title: string
    developer: string
    genre?: string
    genreId?: string
    summary?: string
    description: string
    score?: number
    ratings?: number
    installs?: string
    updated?: number
    version?: string
    recentChanges?: string
    histogram?: Record<string, number>
  }
  metadataQuality: MetadataQualitySignals
  autocompleteSeeds: string[]
  genreSearchRank: number | null
  genrePeerCount: number
  genreTopApps: Array<{ appId: string; title: string; score?: number; ratings?: number }>
  reviewSampleSize: number
  reviewAvgScore: number | null
}

export interface EnrichedKeywordContext {
  keyword: string
  totalResults: number
  myRank: number | null
  ranksByPackage: Record<string, number | null>
  topResults: Array<{
    rank: number
    packageName: string
    title: string
    score: number
    ratings?: number
    installs?: string
  }>
  marketStats: CompetitorMarketStats
}

export interface EnrichedBulkScanContext {
  primaryApp: string
  packageNames: string[]
  languageLabel: string
  country: string
  lang: string
  appContext: EnrichedAppContext
  keywordContexts: EnrichedKeywordContext[]
  dataSources: string[]
  cacheMeta: { fromCache: boolean; stale: boolean }
}

export interface CompetitorGapItem {
  keyword: string
  myRank: number | null
  topCompetitorTitle: string
  gapType: 'ranking' | 'metadata' | 'volume'
  severity: 'kritik' | 'orta' | 'düşük'
  recommendation: string
}

export interface AsoAuditResult {
  success: boolean
  packageName: string
  language: string
  languageLabel: string
  auditedAt: string
  fromCache?: boolean
  aiAvailable: boolean
  fallbackMode?: boolean
  healthScore: number
  healthBreakdown: import('@/types/app').HealthScoreBreakdown
  keywordOpportunities: Array<{
    keyword: string
    opportunityScore: number
    myRank: number | null
    reasoning: string
  }>
  metadataHighlights: string[]
  competitorGaps: CompetitorGapItem[]
  strategySummary: string
  actionPlan7Days: SevenDayActionPlan
  dataSources: string[]
}
