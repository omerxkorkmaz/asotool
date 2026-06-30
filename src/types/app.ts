/** Dashboard & App Health Score types */

export type HealthCriterionKey =
  | 'keywordCoverage'
  | 'titleMetadata'
  | 'competitorPositioning'
  | 'opportunityAverage'
  | 'recentActivity'

export interface HealthScoreCriterion {
  key: HealthCriterionKey
  label: string
  weight: number
  score: number
  weightedScore: number
  explanation: string
}

export interface HealthScoreBreakdown {
  total: number
  criteria: HealthScoreCriterion[]
  computedAt: string
}

export interface AppProfile {
  packageName: string
  title: string
  icon?: string
  developer?: string
  genre?: string
  score?: number
  ratings?: number
  installs?: string
  version?: string
  updated?: number
  healthScore: number
  healthBreakdown: HealthScoreBreakdown
  lastScannedAt: string
  addedAt: string
  country: string
  lang: string
}

export type AnalysisType = 'bulk-scan' | 'health-refresh' | 'manual'

export interface AnalysisSnapshot {
  id: string
  type: AnalysisType
  analyzedAt: string
  healthScore: number
  opportunityAvg?: number
  keywordCount?: number
  summary?: string
}

export interface OpportunityTrendPoint {
  date: string
  score: number
  label?: string
}

export interface DashboardData {
  profile: AppProfile
  recentAnalyses: AnalysisSnapshot[]
  opportunityTrend: OpportunityTrendPoint[]
}

export interface AppListItem {
  packageName: string
  title: string
  icon?: string
  healthScore: number
  lastScannedAt: string
}

export interface AppsListResponse {
  apps: AppListItem[]
  redisAvailable: boolean
}
