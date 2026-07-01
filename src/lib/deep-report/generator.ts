import type { AppSnapshot, DeepReport } from './types'
import {
  formatGeminiError,
  getGeminiClient,
  getGeminiDeepReportModel,
  parseGeminiJsonText,
} from '@/lib/gemini'

const DEEP_REPORT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    executiveSummary: { type: 'string' },
    competitors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          appId: { type: 'string' },
          title: { type: 'string' },
          strengths: { type: 'array', items: { type: 'string' } },
          weaknesses: { type: 'array', items: { type: 'string' } },
          whyTheyRankHigher: { type: 'string' },
        },
        required: ['appId', 'title', 'strengths', 'weaknesses', 'whyTheyRankHigher'],
      },
    },
    opportunities: { type: 'array', items: { type: 'string' } },
    keywordGapAnalysis: {
      type: 'object',
      properties: {
        missingKeywords: { type: 'array', items: { type: 'string' } },
        lowCompetitionKeywords: { type: 'array', items: { type: 'string' } },
      },
      required: ['missingKeywords', 'lowCompetitionKeywords'],
    },
    actionPlan: {
      type: 'object',
      properties: {
        immediate: { type: 'array', items: { type: 'string' } },
        shortTerm: { type: 'array', items: { type: 'string' } },
      },
      required: ['immediate', 'shortTerm'],
    },
    externalSignalInsights: { type: 'string' },
  },
  required: [
    'executiveSummary',
    'competitors',
    'opportunities',
    'keywordGapAnalysis',
    'actionPlan',
    'externalSignalInsights',
  ],
} as const

function buildPrompt(snapshots: AppSnapshot[], strictJson = false): string {
  const myApp = snapshots[0]
  const competitors = snapshots.slice(1)

  const strictNote = strictJson
    ? `\n\nÖNEMLİ: Yanıtın SADECE geçerli JSON olmalı. String değerlerinde çift tırnak varsa \\" ile escape et. Markdown veya açıklama ekleme.\n`
    : ''

  return `## BENİM UYGULAMAM
${JSON.stringify(myApp, null, 2)}

## RAKİPLER
${competitors.map((c, i) => `### Rakip ${i + 1}: ${c.title}\n${JSON.stringify(c, null, 2)}`).join('\n')}

## GÖREV
Bu veriyi analiz et ve aşağıdaki yapıda JSON nesnesi döndür (anahtar adları İngilizce kalsın, tüm metin değerleri TÜRKÇE olsun):

{
  "executiveSummary": "Rekabet ortamı ve konumum hakkında 3 cümlelik özet",
  "competitors": [
    {
      "appId": "string",
      "title": "string",
      "strengths": ["veri kanıtlı 3 güçlü yan"],
      "weaknesses": ["istismar edebileceğim 3 zayıf yan"],
      "whyTheyRankHigher": "2-3 somut, veriye dayalı neden"
    }
  ],
  "opportunities": ["3-5 spesifik fırsat"],
  "keywordGapAnalysis": {
    "missingKeywords": ["benim sıralanmadığım ama rakiplerin sıralandığı kelimeler"],
    "lowCompetitionKeywords": ["düşük rekabetli girilebilecek kelimeler"]
  },
  "actionPlan": {
    "immediate": ["7 gün içinde 3-5 aksiyon"],
    "shortTerm": ["7-30 gün için 3-5 aksiyon"]
  },
  "externalSignalInsights": "Mağaza dışı sinyal analizi"
}

Kurallar:
- Verideki belirli veri noktalarına atıfta bulun (puanlar, anahtar kelime sıralamaları, yorum sayıları, sinyal skorları)
- Veri eksikse (null), bunu belirt ve mevcut veriyle en iyi tahmini yap
- Doğrudan ve aksiyonlanabilir ol. Bir savaş planı istiyorum, teori değil.
- "whyTheyRankHigher" açıklamasını somut yap. "Daha iyi ASO" deme — "başlık hedef anahtar kelimeyle başlıyor, 3 kat daha fazla yorumu var ve Facebook reklamı veriyor" gibi spesifik ol.
- Tüm açıklamalar TÜRKÇE olmalı.
- JSON dışında hiçbir metin yazma.${strictNote}`
}

async function requestAnalysis(
  snapshots: AppSnapshot[],
  strictJson: boolean
): Promise<string> {
  const ai = getGeminiClient()
  if (!ai) {
    throw new Error('GEMINI_API_KEY tanımlı değil. Vercel Production ortamına ekleyip redeploy edin.')
  }

  const response = await ai.models.generateContent({
    model: getGeminiDeepReportModel(),
    contents: [{ role: 'user', parts: [{ text: buildPrompt(snapshots, strictJson) }] }],
    config: {
      systemInstruction: `Sen dünya çapında bir ASO (App Store Optimization) stratejisti ve rekabet istihbaratı analistisin.
Görevin, detaylı uygulama verilerini analiz ederek rakiplerin neden daha üst sıralarda olduğunu ve ne yapmam gerektiğini söylemek.

Spesifik, veriye dayalı ve aksiyon odaklı ol. Asla "ASO'nu geliştir" gibi belirsiz tavsiyeler verme.
Her zaman verideki belirli anahtar kelimelere, metriklere veya sinyallere atıfta bulun.

TÜM çıktılarını TÜRKÇE yaz. Sadece JSON formatında cevap ver, başka metin ekleme.`,
      temperature: strictJson ? 0.1 : 0.3,
      topP: 0.9,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: DEEP_REPORT_JSON_SCHEMA,
    },
  })

  return response.text || '{}'
}

export async function generateReport(
  snapshots: AppSnapshot[]
): Promise<DeepReport['analysis']> {
  try {
    const text = await requestAnalysis(snapshots, false)
    return parseGeminiJsonText<DeepReport['analysis']>(text)
  } catch (firstErr) {
    console.warn('[deep-report] İlk JSON parse başarısız, tekrar deneniyor:', firstErr)

    try {
      const retryText = await requestAnalysis(snapshots, true)
      return parseGeminiJsonText<DeepReport['analysis']>(retryText)
    } catch (retryErr) {
      throw new Error(formatGeminiError(retryErr))
    }
  }
}
