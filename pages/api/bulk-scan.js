import gplay from 'google-play-scraper'

function daysSince(timestamp) {
  if (!timestamp) return 9999
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24))
}

function fmtNum(n) {
  if (!n) return '0'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toString()
}

function analyzeKeyword(keyword, searchResults, appId, appInfo) {
  const top10 = searchResults.slice(0, 10)
  const totalResults = searchResults.length

  const avgRatings = top10.length
    ? Math.round(top10.reduce((s, a) => s + (a.ratings || 0), 0) / top10.length)
    : 0
  const avgScore = top10.length
    ? top10.reduce((s, a) => s + (a.score || 0), 0) / top10.length
    : 0
  const activeCompetitors = top10.filter(a => daysSince(a.updated) < 90).length

  const myIdx = searchResults.findIndex(a => a.appId === appId)
  const myRank = myIdx >= 0 ? myIdx + 1 : null

  // Tahmini hacim — dolaylı sinyal (gerçek sayı değil, yön gösterici)
  let hacimTahmini = 'Düşük'
  let hacimSkoru = 1
  if (totalResults > 100 && avgRatings > 5000) { hacimTahmini = 'Yüksek'; hacimSkoru = 3 }
  else if (totalResults > 30 || avgRatings > 500) { hacimTahmini = 'Orta'; hacimSkoru = 2 }

  // Rekabet zayıflığı skoru (0-100, yüksekse rakip zayıf = fırsat)
  const ratingSkoru = Math.max(0, 100 - Math.min(100, avgRatings / 1000))
  const canlilikCezasi = activeCompetitors >= 7 ? 25 : activeCompetitors >= 4 ? 10 : 0
  const firsatSkoru = Math.max(0, Math.min(100, Math.round(ratingSkoru - canlilikCezasi)))

  // Kelime, uygulamanın başlık/açıklamasında geçiyor mu?
  const kw = keyword.toLowerCase()
  const baslıktaVar = appInfo?.title?.toLowerCase().includes(kw)
  const aciklamadaVar = appInfo?.description?.toLowerCase().includes(kw)

  // ---- DURUM TESPİTİ VE AKSİYON METNİ ----
  let durum, renk, sebep, aksiyon, oncelik

  if (totalResults < 15) {
    durum = 'Düşük Hacim'
    renk = 'gri'
    sebep = `Bu kelime için sadece ${totalResults} uygulama dönüyor. Muhtemelen gerçek kullanıcılar bu kelimeyi sık aramıyor.`
    aksiyon = `Bu kelimeye şimdilik zaman harcama. Daha hacimli ve yakın anlamlı bir kelime dene — listede "${keyword}" yerine geçebilecek varyasyonlar var mı kontrol et.`
    oncelik = 5
  } else if (!appId) {
    durum = 'Bilgi'
    renk = 'mavi'
    sebep = 'Package name girilmediği için kendi sıranı hesaplayamadık.'
    aksiyon = `Genel pazar verisi: ${totalResults} rakip var, ilk 10'un ortalama rating'i ${fmtNum(avgRatings)}. Kendi sıranı görmek için package name gir.`
    oncelik = 4
  } else if (myRank === null && !baslıktaVar && !aciklamadaVar) {
    durum = 'Eksik Kelime'
    renk = 'kırmızı'
    sebep = `"${keyword}" kelimesi senin başlığında veya açıklamanda hiç geçmiyor, bu yüzden Google seni bu aramada hiç göstermiyor.`
    aksiyon = `Bu kelimeyi açıklamanın ilk 2 satırına ekle. Google Play, başlıkta ve açıklamanın başında geçen kelimelere çok daha fazla ağırlık veriyor. İlk 50 sonuçta bile görünmüyorsun çünkü algoritma seni bu kelimeyle hiç ilişkilendirmiyor.`
    oncelik = 1
  } else if (myRank === null && (baslıktaVar || aciklamadaVar)) {
    durum = 'Zayıf Sinyal'
    renk = 'turuncu'
    sebep = `Kelime metninde geçiyor ama ilk 100 sonuçta görünmüyorsun. Google seni bu kelime için yeterince alakalı bulmuyor.`
    aksiyon = `Kelime sadece açıklamanın ortasında geçiyorsa başlığa veya alt başlığa taşı. Ayrıca kelimeyi doğal cümleler içinde 2-3 kez tekrarla — tek geçiş genelde yetmiyor.`
    oncelik = 2
  } else if (myRank <= 10) {
    durum = 'İyi Durumdasın'
    renk = 'yeşil'
    sebep = `Zaten ilk 10'dasın (#${myRank}). Bu kelime senin için çalışıyor.`
    aksiyon = `Bu kelimeyi koru — başlık/açıklamanı değiştirirken bu kelimeyi yanlışlıkla silme. Yorumlarında da bu kelime geçiyorsa kullanıcı dilini doğru yakalamışsın demektir.`
    oncelik = 6
  } else if (myRank > 10 && avgRatings < 3000 && activeCompetitors < 4) {
    durum = 'Kolay Fırsat'
    renk = 'yeşil'
    sebep = `Şu an #${myRank}'sin ama ilk 10'daki rakiplerin çoğu pasif (son 90 günde güncellenmemiş) ve ortalama rating sayıları düşük (${fmtNum(avgRatings)}). Bu zayıf bir rakip grubu.`
    aksiyon = `Bu kelimede gerçek fırsat var. Başlığına veya alt başlığına "${keyword}" ekle, açıklamanın ilk satırında da kullan. Rakipler pasif olduğu için 2-3 hafta içinde ilk 10'a girme ihtimalin yüksek.`
    oncelik = 1
  } else if (myRank > 30 && avgRatings > 10000) {
    durum = 'Zor Rekabet'
    renk = 'kırmızı'
    sebep = `#${myRank}'sin ve ilk 10'daki rakiplerin ortalama ${fmtNum(avgRatings)} rating'i var. Bu kadar köklü rakiplerle direkt yarışmak aylar sürer.`
    aksiyon = `Bu kelimeyle direkt yarışma. Bunun yerine daha spesifik bir varyasyonunu dene — örneğin "${keyword} ücretsiz", "${keyword} offline" gibi. Bu versiyonlarda rakip sayısı çok daha az olur, aynı kullanıcı kitlesine ulaşırsın ama rekabetin daha kolay olduğu noktadan girersin.`
    oncelik = 3
  } else {
    durum = 'Orta Durum'
    renk = 'turuncu'
    sebep = `#${myRank}'sin, rekabet ne çok kolay ne çok zor. Net bir avantaj veya dezavantaj yok.`
    aksiyon = `Açıklamanda bu kelimeyi 1-2 kez daha doğal şekilde kullan, başlığa eklemeyi dene. Sonucu 2 hafta sonra tekrar kontrol et, yükseliyor mu bak.`
    oncelik = 3
  }

  return {
    keyword,
    myRank,
    totalResults,
    avgCompetitorRatings: avgRatings,
    avgCompetitorScore: Math.round(avgScore * 10) / 10,
    activeCompetitors,
    hacimTahmini,
    hacimSkoru,
    firsatSkoru,
    durum,
    renk,
    sebep,
    aksiyon,
    oncelik,
    top3: top10.slice(0, 3).map((a, i) => ({ rank: i + 1, title: a.title, appId: a.appId, ratings: a.ratings })),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { keywords, appId, country = 'tr', lang = 'tr' } = req.body
  if (!keywords?.length) return res.status(400).json({ error: 'keywords array zorunlu' })
  if (keywords.length > 20) return res.status(400).json({ error: 'En fazla 20 keyword aynı anda taranabilir' })

  try {
    // Kendi uygulama bilgisini bir kere çek (başlık/açıklama kontrolü için)
    let appInfo = null
    if (appId) {
      try {
        const app = await gplay.app({ appId, country, lang })
        appInfo = { title: app.title, description: app.description }
      } catch (e) {
        // app bulunamadıysa appInfo null kalır, analiz yine de devam eder
      }
    }

    // Keywordleri 5'erli batch halinde tara (Google'ı boğmamak için)
    const batchSize = 5
    const allAnalysis = []

    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(async (kw) => {
          try {
            const results = await gplay.search({ term: kw, country, lang, num: 100, fullDetail: false })
            return analyzeKeyword(kw, results, appId, appInfo)
          } catch (err) {
            return { keyword: kw, error: err.message, oncelik: 9 }
          }
        })
      )
      allAnalysis.push(...batchResults)
    }

    // Önceliğe göre sırala (1 = en acil/en kolay fırsat üstte)
    allAnalysis.sort((a, b) => (a.oncelik ?? 9) - (b.oncelik ?? 9))

    return res.status(200).json({
      appId: appId || null,
      myApp: appInfo,
      total: allAnalysis.length,
      results: allAnalysis,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
