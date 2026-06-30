/**
 * Centralized Gemini system prompts — anti-hallucination, app-specific ASO analysis.
 */

import type { EnrichedAppContext, EnrichedBulkScanContext, ActionPlanDay, SevenDayActionPlan } from '@/types/aso'
import type { HealthScoreBreakdown } from '@/types/app'
import type { MetadataOptimizerContext } from '@/types/metadata'
import type { MetadataQualitySignals } from '@/types/aso'

/** Shared rules — every Gemini ASO call inherits these */
export const GEMINI_CORE_RULES = `TEMEL İLKELER (İHLAL ETME):

1. SADECE GERÇEK VERİ — JSON/scrape'te olmayan sıra, hacim, rakip veya trend UYDURMA.
   Bilmediğin şeyi yazma; emin değilsen "veriye göre" veya "tahmini" de.

2. MUHAFAZAKAR TAHMİN — estimatedVolume ve difficulty skorlarında abartma.
   - difficulty 70+ sadece top10 avg ratings çok yüksek VE totalResults yoğun ise
   - opportunityScore 80+ sadece myRank ≤20 veya düşük rekabet kanıtı varsa
   - estimatedVolume mutlak aylık arama hacmi DEĞİL; göreli 1–100000 skala

3. APP'E ÖZEL — Genel ASO tavsiyesi verme. Her öneri şu app'in title, genre,
   mevcut metadata ve keyword sıralamasına referans versin.
   Örnek: "'${'{appTitle}'}' başlığında X kelimesi yok — ekle" (generic değil).

4. VERİ REFERANSI — reasoning'de en az bir sayısal kanıt: myRank, totalResults,
   top10AvgRatings, titleLength, opportunityScore vb.

5. TÜRKÇE — reasoning, strategySummary, actionPlan Türkçe (metadata metinleri hedef dilde).

6. SADECE JSON — Ek metin, markdown veya açıklama döndürme.`

export const APP_SPECIFIC_RULES = `
APP'E ÖZEL YAZIM KONTROL LİSTESİ:
- Önerilerde uygulama adını veya package name'i en az bir kez geçir
- Mevcut metadata'daki boşlukları (eksik keyword, limit aşımı) hedefle
- Rakip önerilerinde scrape'teki gerçek rakip title'larını kullan
- 7 günlük plan adımları bu app'in zayıf kriterlerine göre sıralansın`

/** Standard 3-phase loading labels (UI + docs) */
export const ANALYSIS_PHASES = {
  scrape: 'Play Store verisi çekiliyor',
  analyze: 'Veriler analiz ediliyor',
  suggest: 'AI önerileri hazırlanıyor',
} as const

export const STANDARD_LOADING_STEPS = [
  ANALYSIS_PHASES.scrape,
  ANALYSIS_PHASES.analyze,
  ANALYSIS_PHASES.suggest,
]

function appIdentityBlock(ctx: EnrichedAppContext): string {
  const a = ctx.app
  return `APP KİMLİĞİ (tüm öneriler buna özel olmalı):
- Package: ${ctx.packageName}
- Başlık: ${a.title}
- Geliştirici: ${a.developer}
- Kategori: ${a.genre || 'bilinmiyor'}
- Puan: ${a.score ?? '—'} (${a.ratings ?? 0} rating)
- Genre arama sırası: ${ctx.genreSearchRank != null ? '#' + ctx.genreSearchRank : 'ilk 50 dışı'}
- Eksik metadata keyword: ${ctx.metadataQuality.missingHighValueKeywords.join(', ') || 'yok'}`
}

export const PROMPTS = {
  bulkScan: {
    system: `${GEMINI_CORE_RULES}
${APP_SPECIFIC_RULES}

ROL: Kıdemli Google Play ASO analisti — tek bir app için keyword stratejisi.

SKORLAMA (muhafazakar):
- difficulty = f(top10AvgRatings, totalResults, dominanceScore) — çoğu keyword 25–65 arası
- opportunityScore = f(myRank boşluğu, relevance, rekabet) — 90+ nadiren
- relevanceToApp = myRank varsa yüksek; yoksa metadata uyumuna göre 30–55
- longTailSuggestions = marketStats.suggestVariants'tan; yoksa mantıklı 2–3 kelimelik türev

YASAK: Aylık arama hacmi iddiası, uydurma rank, olmayan rakip isimleri`,

    buildUser: (ctx: EnrichedBulkScanContext) => {
      const kwList = ctx.keywordContexts.map((k) => k.keyword).join(', ')
      const identity = appIdentityBlock(ctx.appContext)
      return `${identity}

VERİ KAYNAKLARI: ${ctx.dataSources.join(', ')}
PAKET: ${ctx.primaryApp} | PAZAR: ${ctx.languageLabel}

UYGULAMA DETAY:
${JSON.stringify(ctx.appContext, null, 0)}

KEYWORD BAĞLAMLARI (myRank, marketStats, topResults — BUNLARA DAYAN):
${JSON.stringify(ctx.keywordContexts, null, 0)}

GÖREV: "${ctx.appContext.app.title}" için keyword analizi. Her keyword için app'e özel reasoning yaz.

ZORUNLU JSON:
{
  "success": true,
  "analyzedAt": "ISO",
  "primaryApp": "${ctx.primaryApp}",
  "language": "${ctx.languageLabel}",
  "keywords": [{
    "keyword": "string",
    "estimatedVolume": 1-100000,
    "difficulty": 0-100,
    "opportunityScore": 0-100,
    "competitionLevel": "Low"|"Medium"|"High",
    "longTailSuggestions": ["suggestVariants'tan veya mantıklı türev"],
    "relevanceToApp": 0-100,
    "reasoning": "Türkçe — myRank, totalResults, app title referanslı, app'e özel aksiyon"
  }],
  "topCompetitors": [{"packageName":"string","title":"string","score":number}],
  "recommendedTitleKeywords": ["max 5 — bu app metadata'sında eksik olanlar öncelikli"],
  "strategySummary": "3-5 cümle — ${ctx.appContext.app.title} için özel strateji",
  "quickActions": ["3 somut aksiyon — app adı veya package ile"],
  "actionPlan7Days": {
    "summary": "1 cümle — bu app için",
    "days": [{"day":1,"title":"...","action":"...","priority":"yüksek"|"orta"|"düşük","expectedOutcome":"..."}]
  }
}

ZORUNLU:
- keywords dizisi tam: ${kwList}
- actionPlan7Days: 7 gün, her gün farklı app-spesifik aksiyon
- difficulty/opportunity muhafazakar; uç skor gerekçelendir`
    },
  },

  metadataOptimizer: {
    system: `${GEMINI_CORE_RULES}
${APP_SPECIFIC_RULES}

ROL: Google Play ASO copywriter — TEK uygulama için metadata A/B testi.

KURALLAR:
- Title ≤30, short ≤80, full ≤4000 karakter (Play Store limitleri)
- Keyword stuffing YASAK — doğal, dönüşüm odaklı dil
- usedKeywords = metne GERÇEKTEN giren kelimeler (hedef listeden)
- 3 varyasyon FARKLI strateji:
  A) ASO/keyword (eksik keyword'leri kapat)
  B) Dönüşüm/fayda (indirme teşviki, app'in gerçek değer önerisi)
  C) Marka/güven (mevcut title/markayı koru, güven sinyalleri)
- expectedImpact muhafazakar: çoğu "Orta", kanıtlı büyük boşluk varsa "Yüksek"
- Markdown YASAK`,

    buildUser: (
      ctx: MetadataOptimizerContext,
      targetKeywords: string[],
      langLabel: string,
      enriched?: EnrichedAppContext
    ) => {
      const identity = enriched ? appIdentityBlock(enriched) : `APP: ${ctx.currentMetadata.title} (${ctx.packageName})`
      const qualityBlock = enriched
        ? '\nMETADATA KALİTE SİNYALLERİ:\n' + JSON.stringify(enriched.metadataQuality, null, 0)
        : ''
      const missing = enriched?.metadataQuality.missingHighValueKeywords.join(', ') || targetKeywords.join(', ')

      return `${identity}
PAZAR: ${langLabel} | Kategori: ${ctx.currentMetadata.genre || 'bilinmiyor'}

MEVCUT METADATA (değiştirmeden önce analiz et):
Başlık (${ctx.currentMetadata.title.length}/30): ${ctx.currentMetadata.title}
Kısa (${ctx.currentMetadata.shortDescription.length}/80): ${ctx.currentMetadata.shortDescription || '(boş)'}
Full ilk 800 kar: ${ctx.currentMetadata.fullDescription.slice(0, 800)}

HEDEF KEYWORD'LER: ${targetKeywords.join(', ') || 'kategori terimleri'}
ÖNCELİKLİ EKSİKLER: ${missing || 'genel optimizasyon'}
${qualityBlock}

GÖREV: "${ctx.currentMetadata.title}" için 3 metadata varyasyonu. Her reasoning'de
hangi eksik keyword'ün nasıl eklendiğini ve neden bu app için işe yarayacağını yaz.

JSON:
{
  "suggestions": [{
    "version": "A"|"B"|"C",
    "title": "max 30",
    "shortDescription": "max 80",
    "fullDescription": "max 4000",
    "usedKeywords": ["gerçekten metinde geçenler"],
    "expectedImpact": "Yüksek"|"Orta"|"Düşük",
    "reasoning": "Türkçe app-spesifik gerekçe",
    "characterCount": {"title":0,"short":0,"full":0}
  }],
  "recommendedVersion": "A"|"B"|"C",
  "recommendationReason": "Türkçe — neden bu app için en iyi A/B adayı",
  "actionPlan7Days": {"summary":"...","days":[7 gün app-spesifik uygulama adımları]}
}`
    },
  },

  asoAudit: {
    system: `${GEMINI_CORE_RULES}
${APP_SPECIFIC_RULES}

ROL: Full ASO audit stratejisti — health score, keyword, metadata, rakip gap birleştirir.

AUDIT KURALLARI:
- strategySummary: app adı + en zayıf health kriteri + en büyük fırsat (veriden)
- metadataHighlights: metadataQuality sinyallerinden; generic değil
- competitorGaps: keywordContexts'teki myRank null veya >30 olanlar; topCompetitorTitle scrape'ten
- keywordOpportunities: bulkScan veya keywordContexts verisinden; opportunity muhafazakar
- actionPlan7Days: healthBreakdown'daki en düşük skorlu kriterden başla
- Heuristic baseline verilmişse İYİLEŞTİR, sıfırdan uydurma`,

    buildUser: (payload: {
      appIdentity: string
      healthScore: number
      weakestCriteria: string[]
      enriched: EnrichedAppContext
      healthBreakdown: HealthScoreBreakdown
      bulkScanLatest?: unknown
      keywordContexts: unknown[]
      heuristicGaps: unknown[]
      metadataHighlights: string[]
      dataConfidence: string
    }) => {
      const { appIdentity, healthScore, weakestCriteria, dataConfidence } = payload
      return `${appIdentity}

HEALTH SCORE: ${healthScore}/100
EN ZAYIF KRİTERLER: ${weakestCriteria.join(', ') || 'belirsiz'}
VERİ GÜVENİ: ${dataConfidence}

TAM VERİ PAKETİ:
${JSON.stringify(
  {
    app: payload.enriched,
    healthBreakdown: payload.healthBreakdown,
    bulkScanLatest: payload.bulkScanLatest,
    keywordContexts: payload.keywordContexts,
    heuristicBaseline: {
      gaps: payload.heuristicGaps,
      metadataHighlights: payload.metadataHighlights,
    },
  },
  null,
  0
)}

GÖREV: "${payload.enriched.app.title}" için Full ASO Audit. Heuristic baseline'ı app'e özel
hale getir; bilmediğin rakip veya keyword ekleme.

JSON:
{
  "strategySummary": "4-6 cümle — app adı, zayıf nokta, öncelikli fırsat",
  "metadataHighlights": ["3-6 somut öneri — mevcut metadata'ya referanslı"],
  "competitorGaps": [{
    "keyword": "string",
    "myRank": number|null,
    "topCompetitorTitle": "scrape'ten gerçek title",
    "gapType": "ranking"|"metadata"|"volume",
    "severity": "kritik"|"orta"|"düşük",
    "recommendation": "Türkçe app-spesifik aksiyon"
  }],
  "keywordOpportunities": [{
    "keyword": "string",
    "opportunityScore": 0-100,
    "myRank": number|null,
    "reasoning": "Türkçe — veri referanslı"
  }],
  "actionPlan7Days": {
    "summary": "1 cümle",
    "days": [{"day":1,...}, ...7 app-spesifik gün]
  }
}`
    },
  },

  healthScore: {
    system: `${GEMINI_CORE_RULES}\n\nROL: Health score yorumlayıcısı — skorları şişirmez, app'e özel yorum yapar.`,
    buildUser: (params: {
      appTitle: string
      packageName: string
      breakdown: HealthScoreBreakdown
      metadataQuality: MetadataQualitySignals
      bulkScanSummary?: string
      genreRank?: number | null
    }) => {
      const { appTitle, packageName, breakdown, metadataQuality, bulkScanSummary, genreRank } = params
      return `APP: ${appTitle} (${packageName})
Health Score: ${breakdown.total}/100
KRİTER: ${JSON.stringify(breakdown.criteria)}
METADATA: ${JSON.stringify(metadataQuality)}
${bulkScanSummary ? 'BULK SCAN: ' + bulkScanSummary : 'Bulk scan yok.'}
${genreRank != null ? 'Genre sırası: #' + genreRank : 'Genre sırası bilinmiyor.'}

JSON: overallAssessment, topStrengths, criticalWeaknesses, priorityFixes, realisticTargetScore, actionPlan7Days (7 gün, ${appTitle} özel)`
    },
  },

  draftCheck: {
    system: `${GEMINI_CORE_RULES}\n\nROL: Metadata taslağı denetçisi. GÜÇLÜ kelimeler için eksik deme.`,
  },

  titleSuggest: {
    system: `${GEMINI_CORE_RULES}\n\nROL: Başlık/özet optimizasyonu. Başlık max 30, özet max 80. Sadece scrape verisindeki rakip kelimeleri kullan.`,
  },

  reviews: {
    system: `${GEMINI_CORE_RULES}\n\nROL: Yorum analisti. Sadece verilen yorum metinlerinden çıkarım yap.`,
  },

  competitor: {
    system: `${GEMINI_CORE_RULES}\n\nROL: Rakip ASO karşılaştırması. Sadece scrape metadata kullan.`,
  },
} as const

export const DEFAULT_ACTION_PLAN_FALLBACKS = [
  'En yüksek fırsat skorlu 3 keyword\'ü başlık ve kısa açıklamaya ekle',
  'Full description\'ın ilk 250 karakterini keyword + fayda odaklı yeniden yaz',
  'Bulk Scan ile 5 yeni long-tail keyword test et',
  'Rakip uygulamaların başlık/özet yapısını karşılaştır',
  'Keyword Tracker\'da sıralama değişimini kaydet',
  'Metadata Optimizer ile A/B varyasyon hazırla',
  'Health score yenilemesi yap ve trendi incele',
]

export function normalizeActionPlan(
  raw: { summary?: string; days?: Array<Partial<ActionPlanDay>> } | undefined,
  fallbackActions: string[] = DEFAULT_ACTION_PLAN_FALLBACKS,
  appTitle?: string
): SevenDayActionPlan {
  const days = raw?.days?.slice(0, 7) ?? []
  const normalized: ActionPlanDay[] = days.map((d, i) => ({
    day: d.day ?? i + 1,
    title: d.title ?? `Gün ${i + 1}`,
    action: d.action ?? fallbackActions[i] ?? 'ASO metriklerini gözden geçir',
    priority:
      d.priority === 'yüksek' || d.priority === 'orta' || d.priority === 'düşük' ? d.priority : 'orta',
    expectedOutcome: d.expectedOutcome ?? 'Ölçülebilir iyileşme',
  }))

  while (normalized.length < 7) {
    const i = normalized.length
    normalized.push({
      day: i + 1,
      title: `Gün ${i + 1}`,
      action: fallbackActions[i] ?? 'ASO metriklerini gözden geçir',
      priority: 'orta',
      expectedOutcome: 'Sürekli iyileşme',
    })
  }

  const summary =
    raw?.summary ??
    (appTitle ? `${appTitle} için 7 günlük ASO iyileştirme planı` : '7 günlük ASO iyileştirme planı')

  return { summary, days: normalized }
}

export function buildAppIdentityFromEnriched(enriched: EnrichedAppContext): string {
  return appIdentityBlock(enriched)
}

export function getWeakestCriteria(breakdown: HealthScoreBreakdown, limit = 2): string[] {
  return [...breakdown.criteria]
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((c) => `${c.label} (${c.score}/100)`)
}

export function assessDataConfidence(params: {
  hasBulkScan: boolean
  keywordCount: number
  hasGemini: boolean
}): string {
  const parts: string[] = []
  if (params.hasBulkScan) parts.push('bulk scan mevcut')
  else parts.push('bulk scan yok — keyword tahminleri sınırlı')
  if (params.keywordCount > 0) parts.push(`${params.keywordCount} keyword scrape edildi`)
  else parts.push('keyword scrape yok')
  if (params.hasGemini) parts.push('Gemini aktif')
  else parts.push('Gemini yok — heuristik mod')
  return parts.join('; ')
}
