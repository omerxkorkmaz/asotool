import type { SevenDayActionPlan } from '@/types/aso'

/** Gemini Flash 2.5 JSON response contracts */

export interface GeminiInvalidKeyword {
  kelime: string
  sebep: string
}

export interface DraftAiAnalysis {
  gecersiz_kelimeler?: GeminiInvalidKeyword[]
  genel_degerlendirme?: string
  iyi_yapilanlar?: string[]
  kritik_eksikler?: string[]
  risk_uyarilari?: string[]
  iyilestirilmis_baslik_onerisi?: string
  iyilestirilmis_aciklama_ilk_paragraf_onerisi?: string
  aso_skoru?: number
  onerideEksikKalanlar?: string[]
}

export interface TitleSuggestAiResponse {
  mevcut_baslik_analizi?: string
  onerilen_basliklar?: Array<{ baslik: string; neden: string }>
  onerilen_ozet?: string
  aciklama_ilk_satir_onerisi?: string
  eklenmesi_gereken_kelimeler?: string[]
}

export interface ReviewAiSummary {
  ozet?: string
  en_buyuk_sorun?: string
  en_buyuk_guc?: string
  onerilen_aksiyon?: string
  kategoriler?: Array<{ isim: string; yuzde: number; ornek_cumle?: string }>
}

/** Bulk Scan — Gemini structured output per keyword */
export type CompetitionLevel = 'Low' | 'Medium' | 'High'

export interface KeywordAnalysis {
  keyword: string
  estimatedVolume: number
  difficulty: number
  opportunityScore: number
  competitionLevel: CompetitionLevel
  longTailSuggestions: string[]
  relevanceToApp: number
  reasoning: string
}

export interface BulkScanCompetitor {
  packageName: string
  title: string
  score: number
}

export interface BulkScanResult {
  success: boolean
  analyzedAt: string
  primaryApp: string
  language: string
  keywords: KeywordAnalysis[]
  topCompetitors: BulkScanCompetitor[]
  recommendedTitleKeywords: string[]
  strategySummary: string
  quickActions: string[]
  actionPlan7Days?: SevenDayActionPlan
  /** true when served from Redis cache */
  fromCache?: boolean
  /** Gemini unavailable — heuristic fallback used */
  fallbackMode?: boolean
}
