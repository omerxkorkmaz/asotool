import type { AppSnapshot, DeepReport } from './types'
import { formatGeminiError, getGeminiClient, getGeminiDeepReportModel } from '@/lib/gemini'

export async function generateReport(
  snapshots: AppSnapshot[]
): Promise<DeepReport['analysis']> {
  const myApp = snapshots[0]
  const competitors = snapshots.slice(1)

  const systemInstruction = `Sen dünya çapında bir ASO (App Store Optimization) stratejisti ve rekabet istihbaratı analistisin.
Görevin, detaylı uygulama verilerini analiz ederek rakiplerin neden daha üst sıralarda olduğunu ve ne yapmam gerektiğini söylemek.

Spesifik, veriye dayalı ve aksiyon odaklı ol. Asla "ASO'nu geliştir" gibi belirsiz tavsiyeler verme.
Her zaman verideki belirli anahtar kelimelere, metriklere veya sinyallere atıfta bulun.

TÜM çıktılarını TÜRKÇE yaz. Sadece JSON formatında cevap ver, başka metin ekleme.`

  const prompt = `## MY APP
${JSON.stringify(myApp, null, 2)}

## COMPETITORS
${competitors.map((c, i) => `### Competitor ${i + 1}: ${c.title}\n${JSON.stringify(c, null, 2)}`).join('\n')}

## YOUR TASK
Analyze this data and return a JSON object with this EXACT structure:

{
  "executiveSummary": "3-sentence summary of the competitive landscape and my position",
  "competitors": [
    {
      "appId": "string",
      "title": "string",
      "strengths": ["3 specific strengths with data evidence"],
      "weaknesses": ["3 specific weaknesses I can exploit"],
      "whyTheyRankHigher": "2-3 specific, data-backed reasons"
    }
  ],
  "opportunities": [
    "List 3-5 specific opportunities based on competitor weaknesses or market gaps"
  ],
  "keywordGapAnalysis": {
    "missingKeywords": ["Keywords competitors rank for that I don't"],
    "lowCompetitionKeywords": ["Keywords where competition seems weak and I could enter"]
  },
  "actionPlan": {
    "immediate": [
      "3-5 actions to take in the next 7 days. Be specific: include exact keywords to add, metadata changes, etc."
    ],
    "shortTerm": [
      "3-5 actions for days 7-30. Include marketing, content, and external signal improvement ideas."
    ]
  },
  "externalSignalInsights": "Analysis of off-store presence. Which competitor has strongest external signals? What can I learn from their strategy? Mention specific YouTube channels, web mentions, or ad patterns if available."
}

Kurallar:
- Verideki belirli veri noktalarına atıfta bulun (puanlar, anahtar kelime sıralamaları, yorum sayıları, sinyal skorları)
- Veri eksikse (null), bunu belirt ve mevcut veriyle en iyi tahmini yap
- Doğrudan ve aksiyonlanabilir ol. Bir savaş planı istiyorum, teori değil.
- "whyTheyRankHigher" açıklamasını somut yap. "Daha iyi ASO" deme — "başlık hedef anahtar kelimeyle başlıyor, 3 kat daha fazla yorumu var ve Facebook reklamı veriyor" gibi spesifik ol.
- Tüm açıklamalar TÜRKÇE olmalı.`

  const ai = getGeminiClient()
  if (!ai) {
    throw new Error('GEMINI_API_KEY tanımlı değil. Vercel Production ortamına ekleyip redeploy edin.')
  }

  const model = getGeminiDeepReportModel()

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 4096,
      },
    })

    const text = response.text || '{}'

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Failed to parse Gemini response as JSON')

    return JSON.parse(jsonMatch[0])
  } catch (err) {
    throw new Error(formatGeminiError(err))
  }
}
