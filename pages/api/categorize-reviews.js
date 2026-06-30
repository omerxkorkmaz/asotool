import gplay from 'google-play-scraper'
import { GoogleGenAI } from '@google/genai'

// Türkçe + İngilizce anahtar kelime sözlüğü. Genişletilebilir.
const CATEGORIES = {
  bug: {
    label: 'Hata / Çöküyor',
    color: 'kırmızı',
    keywords: [
      'çöküyor', 'çöktü', 'hata', 'açılmıyor', 'donuyor', 'donduruyor', 'kapanıyor',
      'çalışmıyor', 'bozuk', 'crash', 'bug', 'error', 'freeze', 'not working',
      'jammed', 'takılıyor', 'yüklenmiyor', 'giriş yapamıyorum', 'açılmadı'
    ],
  },
  ux: {
    label: 'Kullanım Zorluğu',
    color: 'turuncu',
    keywords: [
      'zor', 'karışık', 'anlamadım', 'nerede', 'bulamadım', 'kafa karıştırıcı',
      'confusing', 'difficult', 'hard to use', 'complicated', 'karmaşık',
      'anlaşılmıyor', 'kullanışsız', 'berbat arayüz', 'arayüz kötü'
    ],
  },
  performance: {
    label: 'Performans / Hız',
    color: 'turuncu',
    keywords: [
      'yavaş', 'ağır', 'slow', 'lag', 'gecikme', 'bekliyor', 'açılması uzun',
      'pil tüketiyor', 'battery drain', 'ısınıyor'
    ],
  },
  ads: {
    label: 'Reklam Şikayeti',
    color: 'turuncu',
    keywords: [
      'reklam', 'reklamlar', 'ads', 'advertisement', 'çok reklam', 'sürekli reklam',
      'reklam çok fazla', 'too many ads'
    ],
  },
  pricing: {
    label: 'Fiyat / Ödeme',
    color: 'turuncu',
    keywords: [
      'pahalı', 'ücret', 'fiyat', 'expensive', 'price', 'abonelik', 'subscription',
      'para çekti', 'ödeme', 'iade', 'refund', 'free değil', 'ücretsiz değil'
    ],
  },
  feature_request: {
    label: 'Özellik İsteği',
    color: 'mavi',
    keywords: [
      'keşke', 'olsa', 'eklenmeli', 'wish', 'should add', 'feature request',
      'eksik', 'missing', 'olmalı', 'istiyorum', 'eklerseniz'
    ],
  },
  praise: {
    label: 'Övgü',
    color: 'yeşil',
    keywords: [
      'harika', 'mükemmel', 'sevdim', 'süper', 'çok iyi', 'great', 'excellent',
      'love it', 'amazing', 'perfect', 'awesome', 'tavsiye ederim', 'beğendim',
      'güzel uygulama', 'işime yaradı', 'faydalı'
    ],
  },
}

function categorize(text) {
  if (!text) return []
  const lower = text.toLowerCase()
  const matched = []
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    if (cat.keywords.some(kw => lower.includes(kw))) {
      matched.push(key)
    }
  }
  return matched.length ? matched : ['other']
}

async function geminiSummarize(reviews, appTitle) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null // key yoksa sessizce atla, keyword sonucu yeterli

  try {
    const ai = new GoogleGenAI({ apiKey })

    // En fazla 60 yorumu gönder (token tasarrufu + hız), öncelik düşük puanlılarda
    const sample = reviews
      .slice()
      .sort((a, b) => a.score - b.score)
      .slice(0, 60)
      .map(r => `[${r.score}★] ${r.text}`)
      .join('\n---\n')

    const prompt = `Aşağıda "${appTitle || 'bir mobil uygulama'}" için Google Play yorumları var. Bunları analiz et ve SADECE aşağıdaki JSON formatında yanıt ver, başka hiçbir metin ekleme:

{
  "ozet": "2-3 cümlelik genel durum özeti",
  "en_buyuk_sorun": "Kullanıcıların en çok şikayet ettiği TEK bir spesifik sorun, somut ve aksiyona dönüştürülebilir şekilde",
  "en_buyuk_guc": "Kullanıcıların en çok övdüğü TEK bir spesifik güçlü yön",
  "kategoriler": [
    {"isim": "kategori adı", "yuzde": 0-100 arası tahmini oran, "ornek_cumle": "kullanıcıların gerçekte yazdığı türden kısa bir örnek (uydurma değil, yorumlardan esinlenerek)"}
  ],
  "onerilen_aksiyon": "Geliştiricinin yapması gereken EN ÖNCELİKLİ TEK aksiyon, somut ve net"
}

Yorumlar:
${sample}`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    })

    const parsed = JSON.parse(response.text)
    return parsed
  } catch (err) {
    console.error('Gemini özet hatası:', err.message)
    return null // hata olursa keyword sonucuna sessizce düş
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { appId, country = 'tr', lang = 'tr', num = 200, appTitle } = req.query
  if (!appId) return res.status(400).json({ error: 'appId zorunlu' })

  try {
    const { data } = await gplay.reviews({
      appId, country, lang,
      sort: gplay.sort.NEWEST,
      num: Math.min(parseInt(num), 300),
    })

    const categorized = {}
    Object.keys(CATEGORIES).forEach(k => { categorized[k] = [] })
    categorized.other = []

    data.forEach(r => {
      const cats = categorize(r.text)
      cats.forEach(c => {
        categorized[c].push({
          text: r.text,
          score: r.score,
          thumbsUp: r.thumbsUp,
          date: r.date,
          userName: r.userName,
        })
      })
    })

    // Her kategoride en çok beğenilenleri öne al, ilk 10'u tut
    const summary = Object.entries(categorized).map(([key, reviews]) => {
      const sorted = reviews.sort((a, b) => (b.thumbsUp || 0) - (a.thumbsUp || 0))
      const avgScore = reviews.length
        ? Math.round((reviews.reduce((s, r) => s + r.score, 0) / reviews.length) * 10) / 10
        : null
      return {
        category: key,
        label: CATEGORIES[key]?.label || 'Diğer',
        color: CATEGORIES[key]?.color || 'gri',
        count: reviews.length,
        percentage: data.length ? Math.round((reviews.length / data.length) * 100) : 0,
        avgScore,
        topReviews: sorted.slice(0, 8),
      }
    }).filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count)

    // Gemini ile akıllı özet dene (key varsa). Yoksa veya hata olursa aiSummary null kalır,
    // frontend keyword-bazlı kategorilere düşer.
    const aiSummary = await geminiSummarize(data, appTitle)

    return res.status(200).json({
      appId,
      totalReviews: data.length,
      categories: summary,
      aiSummary,
      aiAvailable: !!process.env.GEMINI_API_KEY,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
