import type { AppSnapshot, DeepReport } from './types'
import {
  formatGeminiError,
  getGeminiClient,
  getGeminiDeepReportModel,
  parseGeminiJsonText,
} from '@/lib/gemini'

type Analysis = DeepReport['analysis']

const SYSTEM_INSTRUCTION = `Sen dünya çapında bir ASO stratejisti ve rekabet analistisin.
Rakiplerin neden üstte olduğunu ve ne yapılması gerektiğini veriye dayalı, somut ve aksiyon odaklı anlat.
TÜM metin değerlerini TÜRKÇE yaz. Sadece geçerli JSON döndür.`

function normalizeAnalysis(parsed: Partial<Analysis>, snapshots: AppSnapshot[]): Analysis {
  const competitorIds = snapshots.slice(1).map((s) => s.appId)

  const competitors = Array.isArray(parsed.competitors)
    ? parsed.competitors.map((c, i) => ({
        appId: c?.appId || competitorIds[i] || `competitor-${i + 1}`,
        title: c?.title || snapshots[i + 1]?.title || 'Rakip',
        strengths: Array.isArray(c?.strengths) ? c.strengths.map(String) : [],
        weaknesses: Array.isArray(c?.weaknesses) ? c.weaknesses.map(String) : [],
        whyTheyRankHigher: c?.whyTheyRankHigher || 'Veri yetersiz.',
      }))
    : competitorIds.map((appId, i) => ({
        appId,
        title: snapshots[i + 1]?.title || 'Rakip',
        strengths: [],
        weaknesses: [],
        whyTheyRankHigher: 'Analiz tamamlanamadı.',
      }))

  return {
    executiveSummary: parsed.executiveSummary || 'Rekabet analizi tamamlandı.',
    competitors,
    opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities.map(String) : [],
    keywordGapAnalysis: {
      missingKeywords: Array.isArray(parsed.keywordGapAnalysis?.missingKeywords)
        ? parsed.keywordGapAnalysis.missingKeywords.map(String)
        : [],
      lowCompetitionKeywords: Array.isArray(parsed.keywordGapAnalysis?.lowCompetitionKeywords)
        ? parsed.keywordGapAnalysis.lowCompetitionKeywords.map(String)
        : [],
    },
    actionPlan: {
      immediate: Array.isArray(parsed.actionPlan?.immediate)
        ? parsed.actionPlan.immediate.map(String)
        : [],
      shortTerm: Array.isArray(parsed.actionPlan?.shortTerm)
        ? parsed.actionPlan.shortTerm.map(String)
        : [],
    },
    externalSignalInsights: parsed.externalSignalInsights || 'Dış sinyal verisi sınırlı.',
  }
}

function buildPrompt(snapshots: AppSnapshot[], compact = false): string {
  const payload = snapshots.map((s) => ({
    appId: s.appId,
    title: s.title,
    current: s.current,
    trends: s.trends,
    keywordRankings: s.keywordRankings,
    externalSignals: s.externalSignals,
  }))

  const lengthRule = compact
    ? '- Her string en fazla 120 karakter olsun.\n- competitors: her rakip için 2 strengths, 2 weaknesses.\n- opportunities: en fazla 3 madde.\n- actionPlan: immediate ve shortTerm için en fazla 3 madde.'
    : '- competitors: her rakip için en fazla 3 strengths, 3 weaknesses.\n- opportunities: en fazla 4 madde.\n- actionPlan: her liste en fazla 4 madde.'

  return `Uygulama verileri:
${JSON.stringify(payload)}

Aşağıdaki JSON yapısını doldur (anahtarlar İngilizce, değerler TÜRKÇE):
{
  "executiveSummary": "3 cümle",
  "competitors": [{"appId":"","title":"","strengths":[],"weaknesses":[],"whyTheyRankHigher":""}],
  "opportunities": [],
  "keywordGapAnalysis": {"missingKeywords":[],"lowCompetitionKeywords":[]},
  "actionPlan": {"immediate":[],"shortTerm":[]},
  "externalSignalInsights": ""
}

Kurallar:
${lengthRule}
- String içinde çift tırnak kullanma; gerekirse tek tırnak kullan.
- JSON dışında metin yazma.`
}

async function callGemini(
  snapshots: AppSnapshot[],
  options: { compact?: boolean; structuredJson?: boolean } = {}
): Promise<string> {
  const ai = getGeminiClient()
  if (!ai) {
    throw new Error('GEMINI_API_KEY tanımlı değil. Vercel Production ortamına ekleyip redeploy edin.')
  }

  const { compact = false, structuredJson = true } = options

  try {
    const response = await ai.models.generateContent({
      model: getGeminiDeepReportModel(),
      contents: buildPrompt(snapshots, compact),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: compact ? 0.1 : 0.2,
        topP: 0.9,
        maxOutputTokens: 8192,
        ...(structuredJson ? { responseMimeType: 'application/json' as const } : {}),
      },
    })

    return response.text || '{}'
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const isJsonError =
      message.includes('JSON') ||
      message.includes('position') ||
      message.includes("Expected ','")

    if (structuredJson && isJsonError) {
      console.warn('[deep-report] Structured JSON modu başarısız, düz metin moduna geçiliyor')
      return callGemini(snapshots, { ...options, structuredJson: false })
    }
    throw err
  }
}

export async function generateReport(snapshots: AppSnapshot[]): Promise<Analysis> {
  const attempts: Array<{ compact: boolean; structuredJson: boolean }> = [
    { compact: false, structuredJson: true },
    { compact: true, structuredJson: true },
    { compact: true, structuredJson: false },
  ]

  let lastError: unknown

  for (const attempt of attempts) {
    try {
      const text = await callGemini(snapshots, attempt)
      const parsed = parseGeminiJsonText<Partial<Analysis>>(text)
      return normalizeAnalysis(parsed, snapshots)
    } catch (err) {
      lastError = err
      console.warn('[deep-report] Analiz denemesi başarısız:', err)
    }
  }

  throw new Error(formatGeminiError(lastError))
}
