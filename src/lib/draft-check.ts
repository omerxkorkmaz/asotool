import type { GoogleGenAI } from '@google/genai'
import { GEMINI_MODEL, stripMarkdown } from '@/lib/gemini'
import { PROMPTS } from '@/lib/gemini-prompts'
import type { DraftAiAnalysis } from '@/types/gemini'
import type { KeywordCheckInDraft } from '@/types/api'
import type { BulkScanKeywordResult } from '@/types/scraper'

export function checkKeywordInDraft(
  keyword: string,
  title: string,
  description: string
): Omit<KeywordCheckInDraft, 'previousDurum' | 'previousFirsatSkoru' | 'myRank' | 'totalResults'> {
  const kw = keyword.toLowerCase()
  const t = (title || '').toLowerCase()
  const d = (description || '').toLowerCase()
  const inTitle = t.includes(kw)
  const inFirstLines = d.slice(0, 200).includes(kw)
  const inDescription = d.includes(kw)
  const occurrences = d.split(kw).length - 1 + (t.split(kw).length - 1)
  return { keyword, inTitle, inFirstLines, inDescription, occurrences }
}

export function isStructurallyMalformed(keyword: string): { malformed: boolean; reason?: string } {
  const words = keyword.trim().split(/\s+/)
  if (words.length >= 5) return { malformed: true, reason: 'çok uzun öbek (5+ kelime)' }
  const lower = words.map((w) => w.toLowerCase().replace(/[,.-]/g, ''))
  const uniqueRatio = new Set(lower).size / lower.length
  if (lower.length >= 3 && uniqueRatio < 0.6) {
    return { malformed: true, reason: 'aynı kelime tekrar tekrar geçiyor' }
  }
  return { malformed: false }
}

async function analyzeWithGemini(opts: {
  ai: GoogleGenAI
  draftTitle: string
  draftDescription: string
  candidateKeywords: KeywordCheckInDraft[]
  language: string
}): Promise<DraftAiAnalysis> {
  const { ai, draftTitle, draftDescription, candidateKeywords, language } = opts

  const keywordList = candidateKeywords
    .map((k) => {
      const status = k.inTitle
        ? 'GÜÇLÜ (başlıkta)'
        : k.inFirstLines
          ? 'GÜÇLÜ (açıklama ilk satırlarında)'
          : k.inDescription
            ? 'ZAYIF (açıklamada geç konumda)'
            : 'HİÇ YOK'
      return `- "${k.keyword}" → ${status}`
    })
    .join('\n')

  const prompt = `Sen bir Google Play ASO (App Store Optimization) uzmanısın. Bir geliştirici henüz YAYINLAMADIĞI bir başlık + açıklama taslağı hazırladı (dil: ${language}). Bu taslağı değerlendireceksin.

TASLAK BAŞLIK:
${draftTitle || '(girilmedi)'}

TASLAK AÇIKLAMA:
${draftDescription || '(girilmedi)'}

KELİMELER VE TASLAKTAKİ DURUMU:
${keywordList || '(kelime listesi boş)'}

Yukarıdaki kelime listesinde geçersiz olanları işaretle (marka adı, kişi adı, anlamsız diziler, gerçek arama terimi olmayanlar).
SADECE geçerli kelimeleri baz alarak taslağı değerlendir.

KRİTİK KURALLAR:
1. "GÜÇLÜ" kelimeler için eksik deme.
2. "HİÇ YOK" geçerli kelimeleri TAM İFADE olarak öneride kullan.
3. Markdown kullanma.
4. Rapor alanları TÜRKÇE, iyilestirilmis_baslik_onerisi ve iyilestirilmis_aciklama_ilk_paragraf_onerisi ${language} dilinde.

JSON formatı:
{
  "gecersiz_kelimeler": [{"kelime": "...", "sebep": "..."}],
  "genel_degerlendirme": "...",
  "iyi_yapilanlar": ["..."],
  "kritik_eksikler": ["..."],
  "risk_uyarilari": ["..."],
  "iyilestirilmis_baslik_onerisi": "...",
  "iyilestirilmis_aciklama_ilk_paragraf_onerisi": "..."
}`

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { responseMimeType: 'application/json', systemInstruction: PROMPTS.draftCheck.system },
  })

  return JSON.parse(response.text ?? '{}') as DraftAiAnalysis
}

export async function runDraftCheck(opts: {
  draftTitle: string
  draftDescription: string
  scanResults: BulkScanKeywordResult[]
  language: string
  apiKey?: string
}) {
  const { draftTitle, draftDescription, scanResults, language, apiKey } = opts

  const allChecks: KeywordCheckInDraft[] = scanResults
    .filter((r) => !r.error)
    .map((r) => ({
      ...checkKeywordInDraft(r.keyword, draftTitle, draftDescription),
      previousDurum: r.durum,
      previousFirsatSkoru: r.firsatSkoru,
      myRank: r.myRank,
      totalResults: r.totalResults,
    }))

  const structurallyFiltered: KeywordCheckInDraft[] = []
  const afterStructuralFilter: KeywordCheckInDraft[] = []

  for (const check of allChecks) {
    const struct = isStructurallyMalformed(check.keyword)
    if (struct.malformed) {
      structurallyFiltered.push({ ...check, filterReason: struct.reason })
    } else if (check.previousDurum === 'Düşük Hacim') {
      structurallyFiltered.push({ ...check, filterReason: 'düşük arama hacmi' })
    } else {
      afterStructuralFilter.push(check)
    }
  }

  let aiAnalysis: DraftAiAnalysis | null = null
  let aiError: string | null = null
  let semanticallyFiltered: KeywordCheckInDraft[] = []
  let finalValidChecks = afterStructuralFilter

  if (apiKey && afterStructuralFilter.length > 0) {
    try {
      const { GoogleGenAI } = await import('@google/genai')
      const ai = new GoogleGenAI({ apiKey })

      aiAnalysis = await analyzeWithGemini({
        ai,
        draftTitle,
        draftDescription,
        candidateKeywords: afterStructuralFilter,
        language,
      })

      const invalidKeywordSet = new Set(
        (aiAnalysis.gecersiz_kelimeler || [])
          .map((g) => g.kelime?.toLowerCase().trim())
          .filter(Boolean)
      )

      semanticallyFiltered = afterStructuralFilter
        .filter((k) => invalidKeywordSet.has(k.keyword.toLowerCase().trim()))
        .map((k) => ({
          ...k,
          filterReason:
            aiAnalysis!.gecersiz_kelimeler?.find(
              (g) => g.kelime?.toLowerCase().trim() === k.keyword.toLowerCase().trim()
            )?.sebep || 'AI tarafından geçersiz işaretlendi',
        }))

      finalValidChecks = afterStructuralFilter.filter(
        (k) => !invalidKeywordSet.has(k.keyword.toLowerCase().trim())
      )

      aiAnalysis.iyilestirilmis_baslik_onerisi = stripMarkdown(aiAnalysis.iyilestirilmis_baslik_onerisi)
      aiAnalysis.iyilestirilmis_aciklama_ilk_paragraf_onerisi = stripMarkdown(
        aiAnalysis.iyilestirilmis_aciklama_ilk_paragraf_onerisi
      )

      const finalMissing = finalValidChecks.filter((k) => !k.inTitle && !k.inDescription)
      const suggestedText = `${aiAnalysis.iyilestirilmis_baslik_onerisi || ''} ${aiAnalysis.iyilestirilmis_aciklama_ilk_paragraf_onerisi || ''}`.toLowerCase()
      aiAnalysis.onerideEksikKalanlar = finalMissing
        .map((k) => k.keyword)
        .filter((kw) => !suggestedText.includes(kw.toLowerCase()))
    } catch (err) {
      aiAnalysis = null
      aiError = err instanceof Error ? err.message : String(err)
    }
  }

  const missingInDraft = finalValidChecks.filter((k) => !k.inTitle && !k.inDescription)
  const weakInDraft = finalValidChecks.filter(
    (k) => k.inDescription && !k.inFirstLines && !k.inTitle
  )
  const strongInDraft = finalValidChecks.filter((k) => k.inTitle || k.inFirstLines)

  const total = finalValidChecks.length || 1
  const asoSkoru = Math.round(
    ((strongInDraft.length + weakInDraft.length * 0.4) / total) * 100
  )

  if (aiAnalysis) aiAnalysis.aso_skoru = asoSkoru

  return {
    titleLength: (draftTitle || '').length,
    descriptionLength: (draftDescription || '').length,
    totalKeywordsChecked: finalValidChecks.length,
    asoSkoru,
    missingInDraft,
    weakInDraft,
    strongInDraft,
    keywordChecks: finalValidChecks,
    malformedChecks: [...structurallyFiltered, ...semanticallyFiltered],
    aiAnalysis,
    aiAvailable: !!apiKey,
    aiError,
  }
}
