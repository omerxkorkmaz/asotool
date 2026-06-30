import type { SevenDayActionPlan } from '@/types/aso'

/** AI Metadata Optimizer types */

export type ExpectedImpact = 'Yüksek' | 'Orta' | 'Düşük'

export interface MetadataCharacterCount {
  title: number
  short: number
  full: number
}

export interface MetadataSuggestion {
  version: string
  title: string
  shortDescription: string
  fullDescription: string
  usedKeywords: string[]
  expectedImpact: ExpectedImpact
  reasoning: string
  characterCount: MetadataCharacterCount
}

export interface CurrentMetadata {
  title: string
  shortDescription: string
  fullDescription: string
  icon?: string
  genre?: string
  score?: number
}

export interface MetadataComparisonRow {
  version: string
  titleChars: number
  shortChars: number
  fullChars: number
  keywordCount: number
  expectedImpact: ExpectedImpact
  rankScore: number
}

export interface MetadataOptimizerResult {
  success: boolean
  packageName: string
  language: string
  languageLabel: string
  generatedAt: string
  currentMetadata: CurrentMetadata
  targetKeywords: string[]
  suggestions: MetadataSuggestion[]
  recommendedVersion: string
  recommendationReason: string
  comparison: MetadataComparisonRow[]
  actionPlan7Days?: SevenDayActionPlan
  fromCache?: boolean
  aiAvailable: boolean
}

export interface MetadataOptimizerContext {
  packageName: string
  language: string
  currentMetadata: CurrentMetadata
  bulkScanKeywords: string[]
  hasBulkScan: boolean
}

export interface MetadataOptimizerRequest {
  packageName: string
  language: string
  useBulkScan?: boolean
  keywords?: string[]
}

/** Raw Gemini response shape */
export interface GeminiMetadataResponse {
  suggestions: MetadataSuggestion[]
  recommendedVersion: string
  recommendationReason: string
  actionPlan7Days?: SevenDayActionPlan
}
