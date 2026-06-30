import type { NextApiRequest, NextApiResponse } from 'next'
import { withApiHandler, sendJson } from '@/lib/api-handler'
import { cachedApp, cachedSearch, extractWords } from '@/lib/gplay'
import { getGeminiClient, GEMINI_MODEL } from '@/lib/gemini'
import { PROMPTS } from '@/lib/gemini-prompts'
import type { TitleSuggestAiResponse } from '@/types/gemini'
import { ValidationError } from '@/lib/errors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { appId, seedKeyword, country = 'tr', lang = 'tr' } = req.body
  if (!appId) throw new ValidationError('appId zorunlu')

  const myApp = await cachedApp({ appId, country, lang })
  const searchTerm = seedKeyword || myApp.genre || myApp.title
  const rivals = await cachedSearch({ term: searchTerm, country, lang, num: 15 })
  const otherRivals = rivals.filter((r) => r.appId !== appId).slice(0, 10)

  const wordFreq: Record<string, number> = {}
  otherRivals.forEach((app) => {
    const words = [
      ...extractWords(app.title),
      ...extractWords((app as { summary?: string }).summary || ''),
    ]
    const unique = new Set(words)
    unique.forEach((w) => {
      wordFreq[w] = (wordFreq[w] || 0) + 1
    })
  })

  const myWords = new Set([
    ...extractWords(myApp.title),
    ...extractWords(myApp.summary || ''),
    ...extractWords(myApp.description || ''),
  ])

  const missingWords = Object.entries(wordFreq)
    .filter(([word, count]) => count >= 2 && !myWords.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, appearsIn: count, totalRivals: otherRivals.length }))

  let aiSuggestion: TitleSuggestAiResponse | null = null
  const ai = getGeminiClient()
  if (ai) {
    try {
      const rivalSummaries = otherRivals
        .slice(0, 5)
        .map((r) => `- ${r.title}: ${(r as { summary?: string }).summary || ''}`)
        .join('\n')

      const prompt = `Sen bir Google Play ASO (App Store Optimization) uzmanısın. Aşağıdaki bilgilere göre SADECE JSON formatında yanıt ver, başka metin ekleme.

MEVCUT UYGULAMA:
Başlık: ${myApp.title}
Alt başlık/özet: ${myApp.summary || 'yok'}
Açıklama (ilk 500 karakter): ${(myApp.description || '').slice(0, 500)}

RAKİPLERİN BAŞLIK VE ÖZETLERİ:
${rivalSummaries}

RAKİPLERDE SIK GEÇEN AMA BENDE OLMAYAN KELİMELER:
${missingWords.map((w) => w.word).join(', ') || 'yok'}

GÖREV: Mevcut uygulamanın başlığını ve özetini (kısa açıklama, max 80 karakter) ASO açısından güçlendirecek somut öneriler ver. Mevcut markayı/ismi koru ama Play Store aramalarında daha görünür olacak kelimeler ekle.

JSON formatı:
{
  "mevcut_baslik_analizi": "Mevcut başlığın güçlü ve zayıf yönleri hakkında 1-2 cümle",
  "onerilen_basliklar": [
    {"baslik": "öneri 1 (50 karakter altı)", "neden": "neden bu öneri iyi, kısa açıklama"},
    {"baslik": "öneri 2", "neden": "..."},
    {"baslik": "öneri 3", "neden": "..."}
  ],
  "onerilen_ozet": "80 karakteri geçmeyen, anahtar kelime içeren alt başlık önerisi",
  "aciklama_ilk_satir_onerisi": "Açıklamanın ilk satırı için, anahtar kelime yoğun ama doğal bir cümle önerisi",
  "eklenmesi_gereken_kelimeler": ["kelime1", "kelime2", "kelime3"]
}`

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json', systemInstruction: PROMPTS.titleSuggest.system },
      })
      aiSuggestion = JSON.parse(response.text ?? '{}') as TitleSuggestAiResponse
    } catch (err) {
      console.error('Gemini öneri hatası:', err)
      aiSuggestion = null
    }
  }

  sendJson(res, {
    appId,
    myApp: {
      title: myApp.title,
      summary: myApp.summary,
      description: myApp.description,
    },
    rivalsScanned: otherRivals.length,
    missingWords,
    aiSuggestion,
    aiAvailable: !!ai,
  })
}

export default withApiHandler(handler, { methods: ['POST'], routeName: 'title-suggest' })
