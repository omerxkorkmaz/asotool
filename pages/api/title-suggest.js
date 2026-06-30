import gplay from 'google-play-scraper'
import { GoogleGenAI } from '@google/genai'

const STOPWORDS = new Set([
  've', 'ile', 'için', 'bu', 'bir', 'de', 'da', 'mi', 'mı', 'mu', 'mü',
  'the', 'and', 'for', 'with', 'app', 'apps', 'free', 'best', 'new',
  'on', 'in', 'to', 'of', 'a', 'is', 'your', 'you', 'all'
])

function extractWords(text) {
  if (!text) return []
  return text
    .toLowerCase()
    .replace(/[^\wığüşöçİĞÜŞÖÇ\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { appId, seedKeyword, country = 'tr', lang = 'tr' } = req.body
  if (!appId) return res.status(400).json({ error: 'appId zorunlu' })

  try {
    // 1) Kendi uygulama bilgisini çek
    const myApp = await gplay.app({ appId, country, lang })

    // 2) Rakipleri bul: seedKeyword verilmişse onunla ara, yoksa kategori adıyla ara
    const searchTerm = seedKeyword || myApp.genre || myApp.title
    const rivals = await gplay.search({ term: searchTerm, country, lang, num: 15, fullDetail: false })
    const otherRivals = rivals.filter(r => r.appId !== appId).slice(0, 10)

    // 3) Rakiplerin başlık + özet kelimelerini frekansla
    const wordFreq = {}
    otherRivals.forEach(app => {
      const words = [...extractWords(app.title), ...extractWords(app.summary)]
      const unique = new Set(words)
      unique.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1 })
    })

    const myWords = new Set([
      ...extractWords(myApp.title),
      ...extractWords(myApp.summary),
      ...extractWords(myApp.description),
    ])

    // Rakiplerde sık geçen ama bende hiç geçmeyen kelimeler = eksik fırsatlar
    const missingWords = Object.entries(wordFreq)
      .filter(([word, count]) => count >= 2 && !myWords.has(word))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word, count]) => ({ word, appearsIn: count, totalRivals: otherRivals.length }))

    // 4) Gemini ile somut başlık/açıklama önerisi üret (key varsa)
    let aiSuggestion = null
    const apiKey = process.env.GEMINI_API_KEY
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey })
        const rivalSummaries = otherRivals.slice(0, 5).map(r => `- ${r.title}: ${r.summary || ''}`).join('\n')

        const prompt = `Sen bir Google Play ASO (App Store Optimization) uzmanısın. Aşağıdaki bilgilere göre SADECE JSON formatında yanıt ver, başka metin ekleme.

MEVCUT UYGULAMA:
Başlık: ${myApp.title}
Alt başlık/özet: ${myApp.summary || 'yok'}
Açıklama (ilk 500 karakter): ${(myApp.description || '').slice(0, 500)}

RAKİPLERİN BAŞLIK VE ÖZETLERİ:
${rivalSummaries}

RAKİPLERDE SIK GEÇEN AMA BENDE OLMAYAN KELİMELER:
${missingWords.map(w => w.word).join(', ') || 'yok'}

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
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        })
        aiSuggestion = JSON.parse(response.text)
      } catch (err) {
        console.error('Gemini öneri hatası:', err.message)
        aiSuggestion = null
      }
    }

    return res.status(200).json({
      appId,
      myApp: {
        title: myApp.title,
        summary: myApp.summary,
        description: myApp.description,
      },
      rivalsScanned: otherRivals.length,
      missingWords,
      aiSuggestion,
      aiAvailable: !!apiKey,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
