import gplay from 'google-play-scraper'
import type { NextApiRequest, NextApiResponse } from 'next'
import { withApiHandler, sendJson } from '@/lib/api-handler'
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cache-keys'
import { cacheThrough } from '@/lib/cache'
import { getGeminiClient, GEMINI_MODEL } from '@/lib/gemini'
import { PROMPTS } from '@/lib/gemini-prompts'
import type { PlayReview } from '@/types/scraper'
import type { ReviewAiSummary } from '@/types/gemini'
import { ValidationError } from '@/lib/errors'

const CATEGORIES = {
  bug: {
    label: 'Hata / Çöküyor',
    color: 'kırmızı',
    keywords: [
      'çöküyor', 'çöktü', 'hata', 'açılmıyor', 'donuyor', 'donduruyor', 'kapanıyor',
      'çalışmıyor', 'bozuk', 'crash', 'bug', 'error', 'freeze', 'not working',
      'jammed', 'takılıyor', 'yüklenmiyor', 'giriş yapamıyorum', 'açılmadı',
    ],
  },
  ux: {
    label: 'Kullanım Zorluğu',
    color: 'turuncu',
    keywords: [
      'zor', 'karışık', 'anlamadım', 'nerede', 'bulamadım', 'kafa karıştırıcı',
      'confusing', 'difficult', 'hard to use', 'complicated', 'karmaşık',
      'anlaşılmıyor', 'kullanışsız', 'berbat arayüz', 'arayüz kötü',
    ],
  },
  performance: {
    label: 'Performans / Hız',
    color: 'turuncu',
    keywords: [
      'yavaş', 'ağır', 'slow', 'lag', 'gecikme', 'bekliyor', 'açılması uzun',
      'pil tüketiyor', 'battery drain', 'ısınıyor',
    ],
  },
  ads: {
    label: 'Reklam Şikayeti',
    color: 'turuncu',
    keywords: [
      'reklam', 'reklamlar', 'ads', 'advertisement', 'çok reklam', 'sürekli reklam',
      'reklam çok fazla', 'too many ads',
    ],
  },
  pricing: {
    label: 'Fiyat / Ödeme',
    color: 'turuncu',
    keywords: [
      'pahalı', 'ücret', 'fiyat', 'expensive', 'price', 'abonelik', 'subscription',
      'para çekti', 'ödeme', 'iade', 'refund', 'free değil', 'ücretsiz değil',
    ],
  },
  feature_request: {
    label: 'Özellik İsteği',
    color: 'mavi',
    keywords: [
      'keşke', 'olsa', 'eklenmeli', 'wish', 'should add', 'feature request',
      'eksik', 'missing', 'olmalı', 'istiyorum', 'eklerseniz',
    ],
  },
  praise: {
    label: 'Övgü',
    color: 'yeşil',
    keywords: [
      'harika', 'mükemmel', 'sevdim', 'süper', 'çok iyi', 'great', 'excellent',
      'love it', 'amazing', 'perfect', 'awesome', 'tavsiye ederim', 'beğendim',
      'güzel uygulama', 'işime yaradı', 'faydalı',
    ],
  },
} as const

type CategoryKey = keyof typeof CATEGORIES | 'other'

function categorize(text: string): CategoryKey[] {
  if (!text) return ['other']
  const lower = text.toLowerCase()
  const matched: CategoryKey[] = []
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    if (cat.keywords.some((kw) => lower.includes(kw))) {
      matched.push(key as CategoryKey)
    }
  }
  return matched.length ? matched : ['other']
}

async function geminiSummarize(
  reviews: PlayReview[],
  appTitle?: string
): Promise<ReviewAiSummary | null> {
  const ai = getGeminiClient()
  if (!ai) return null

  try {
    const sample = reviews
      .slice()
      .sort((a, b) => a.score - b.score)
      .slice(0, 60)
      .map((r) => `[${r.score}★] ${r.text}`)
      .join('\n---\n')

    const prompt = `Aşağıda "${appTitle || 'bir mobil uygulama'}" için Google Play yorumları var. SADECE JSON yanıt ver:

{
  "ozet": "2-3 cümlelik genel durum özeti",
  "en_buyuk_sorun": "en öncelikli sorun",
  "en_buyuk_guc": "en büyük güç",
  "kategoriler": [{"isim": "...", "yuzde": 0, "ornek_cumle": "..."}],
  "onerilen_aksiyon": "tek öncelikli aksiyon"
}

Yorumlar:
${sample}`

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json', systemInstruction: PROMPTS.reviews.system },
    })
    return JSON.parse(response.text ?? '{}') as ReviewAiSummary
  } catch (err) {
    console.error('Gemini özet hatası:', err)
    return null
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { appId, country = 'tr', lang = 'tr', num = '200', appTitle } = req.query
  if (!appId || typeof appId !== 'string') throw new ValidationError('appId zorunlu')

  const capped = Math.min(parseInt(String(num), 10) || 200, 300)
  const cacheKey = CACHE_KEYS.reviews(appId, String(country), String(lang), 'newest', capped)

  const data = await cacheThrough(cacheKey, CACHE_TTL.REVIEWS, async () => {
    const result = await gplay.reviews({
      appId,
      country: String(country),
      lang: String(lang),
      sort: gplay.sort.NEWEST,
      num: capped,
    })
    const reviews = 'data' in result && Array.isArray(result.data) ? result.data : (result as unknown as PlayReview[])
    return reviews
  })

  const categorized: Record<string, Array<{
    text: string
    score: number
    thumbsUp?: number
    date?: string | number
    userName: string
  }>> = {}

  Object.keys(CATEGORIES).forEach((k) => {
    categorized[k] = []
  })
  categorized.other = []

  data.forEach((r) => {
    const cats = categorize(r.text)
    cats.forEach((c) => {
      categorized[c].push({
        text: r.text,
        score: r.score,
        thumbsUp: r.thumbsUp,
        date: r.date,
        userName: r.userName,
      })
    })
  })

  const summary = Object.entries(categorized)
    .map(([key, reviews]) => {
      const sorted = reviews.sort((a, b) => (b.thumbsUp || 0) - (a.thumbsUp || 0))
      const avgScore = reviews.length
        ? Math.round((reviews.reduce((s, r) => s + r.score, 0) / reviews.length) * 10) / 10
        : null
      const catMeta = CATEGORIES[key as keyof typeof CATEGORIES]
      return {
        category: key,
        label: catMeta?.label || 'Diğer',
        color: catMeta?.color || 'gri',
        count: reviews.length,
        percentage: data.length ? Math.round((reviews.length / data.length) * 100) : 0,
        avgScore,
        topReviews: sorted.slice(0, 8),
      }
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)

  const aiSummary = await geminiSummarize(data, typeof appTitle === 'string' ? appTitle : undefined)

  sendJson(res, {
    appId,
    totalReviews: data.length,
    categories: summary,
    aiSummary,
    aiAvailable: !!process.env.GEMINI_API_KEY,
  })
}

export default withApiHandler(handler, { methods: ['GET'], routeName: 'categorize-reviews' })
