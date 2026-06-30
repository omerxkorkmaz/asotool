import gplay from 'google-play-scraper'

// Kelimeyi temizle, anlamsız ortak kelimeleri (stopword) filtrele
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

  const { seed, country = 'tr', lang = 'tr' } = req.body
  if (!seed) return res.status(400).json({ error: 'seed (kök kelime) zorunlu' })

  try {
    // 1) AUTOCOMPLETE — Google'ın kendi öneri sistemi (gerçek kullanıcı arama davranışı)
    // Birkaç varyasyonla suggest çağırarak daha zengin sonuç topluyoruz (her çağrı max 5 döner)
    const suggestSeeds = [seed, `${seed} `, `${seed}a`, `${seed}e`, `${seed} i`]
    const suggestResults = await Promise.all(
      suggestSeeds.map(s =>
        gplay.suggest({ term: s, country, lang }).catch(() => [])
      )
    )
    const autocompleteSet = new Set()
    suggestResults.flat().forEach(s => autocompleteSet.add(s.toLowerCase().trim()))
    autocompleteSet.delete(seed.toLowerCase().trim())

    // 2) RAKİP KELİME FREKANSI — ilk 25 sonucun başlık+özetinden en sık geçen kelimeler
    const searchResults = await gplay.search({
      term: seed, country, lang, num: 25, fullDetail: false,
    })

    const wordFreq = {}
    searchResults.forEach(app => {
      const words = [...extractWords(app.title), ...extractWords(app.summary)]
      const uniqueWords = new Set(words) // bir uygulama bir kelimeyi 1 kez saysın
      uniqueWords.forEach(w => {
        if (w === seed.toLowerCase()) return
        wordFreq[w] = (wordFreq[w] || 0) + 1
      })
    })

    const competitorWords = Object.entries(wordFreq)
      .filter(([word, count]) => count >= 2) // en az 2 rakipte geçsin, gürültüyü azalt
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word, count]) => ({
        word,
        appearsIn: count,
        totalScanned: searchResults.length,
        suggestedKeyword: `${seed} ${word}`,
      }))

    // 3) Birleştirilmiş öneri listesi (autocomplete + rakip kelimelerinden üretilmiş kombinasyonlar)
    const combined = [
      ...Array.from(autocompleteSet).map(k => ({ keyword: k, source: 'autocomplete' })),
      ...competitorWords.map(w => ({ keyword: w.suggestedKeyword, source: 'rakip_kelime', appearsIn: w.appearsIn })),
    ]

    // Tekrarları temizle
    const seen = new Set()
    const uniqueCombined = combined.filter(c => {
      const key = c.keyword.toLowerCase().trim()
      if (seen.has(key) || key === seed.toLowerCase()) return false
      seen.add(key)
      return true
    })

    return res.status(200).json({
      seed,
      country,
      lang,
      autocomplete: Array.from(autocompleteSet),
      competitorWords,
      suggestions: uniqueCombined,
      scannedCompetitors: searchResults.length,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
