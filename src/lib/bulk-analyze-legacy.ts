import type { BulkScanKeywordResult, PlaySearchResult } from '@/types/scraper'

function daysSince(timestamp?: number): number {
  if (!timestamp) return 9999
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24))
}

function fmtNum(n?: number): string {
  if (!n) return '0'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toString()
}

/** @deprecated Legacy heuristic keyword analysis — used by check-draft flow */
export function analyzeKeyword(
  keyword: string,
  searchResults: PlaySearchResult[],
  appId?: string,
  appInfo?: { title?: string; description?: string } | null
): BulkScanKeywordResult {
  const top10 = searchResults.slice(0, 10)
  const totalResults = searchResults.length

  const avgRatings = top10.length
    ? Math.round(top10.reduce((s, a) => s + (a.ratings || 0), 0) / top10.length)
    : 0
  const avgScore = top10.length
    ? top10.reduce((s, a) => s + (a.score || 0), 0) / top10.length
    : 0
  const activeCompetitors = top10.filter((a) => daysSince(a.updated) < 90).length

  const myIdx = appId ? searchResults.findIndex((a) => a.appId === appId) : -1
  const myRank = myIdx >= 0 ? myIdx + 1 : null

  let hacimTahmini = 'Düşük'
  let hacimSkoru = 1
  if (totalResults > 100 && avgRatings > 5000) {
    hacimTahmini = 'Yüksek'
    hacimSkoru = 3
  } else if (totalResults > 30 || avgRatings > 500) {
    hacimTahmini = 'Orta'
    hacimSkoru = 2
  }

  const ratingSkoru = Math.max(0, 100 - Math.min(100, avgRatings / 1000))
  const canlilikCezasi = activeCompetitors >= 7 ? 25 : activeCompetitors >= 4 ? 10 : 0
  const firsatSkoru = Math.max(0, Math.min(100, Math.round(ratingSkoru - canlilikCezasi)))

  const kw = keyword.toLowerCase()
  const baslıktaVar = appInfo?.title?.toLowerCase().includes(kw)
  const aciklamadaVar = appInfo?.description?.toLowerCase().includes(kw)

  let durum: string
  let renk: string
  let sebep: string
  let aksiyon: string
  let oncelik: number

  if (totalResults < 15) {
    durum = 'Düşük Hacim'
    renk = 'gri'
    sebep = `Bu kelime için sadece ${totalResults} uygulama dönüyor.`
    aksiyon = 'Daha hacimli bir varyasyon dene.'
    oncelik = 5
  } else if (!appId) {
    durum = 'Bilgi'
    renk = 'mavi'
    sebep = 'Package name girilmedi.'
    aksiyon = `Genel pazar: ${totalResults} rakip, ort. rating ${fmtNum(avgRatings)}.`
    oncelik = 4
  } else if (myRank === null && !baslıktaVar && !aciklamadaVar) {
    durum = 'Eksik Kelime'
    renk = 'kırmızı'
    sebep = `"${keyword}" başlık/açıklamada yok.`
    aksiyon = 'Kelimeyi başlık veya açıklamanın ilk satırlarına ekle.'
    oncelik = 1
  } else if (myRank === null && (baslıktaVar || aciklamadaVar)) {
    durum = 'Zayıf Sinyal'
    renk = 'turuncu'
    sebep = 'Kelime metinde var ama ilk 100\'de görünmüyorsun.'
    aksiyon = 'Kelimeyi başlığa taşı ve doğal tekrarlar ekle.'
    oncelik = 2
  } else if (myRank !== null && myRank <= 10) {
    durum = 'İyi Durumdasın'
    renk = 'yeşil'
    sebep = `İlk 10'dasın (#${myRank}).`
    aksiyon = 'Bu kelimeyi koru.'
    oncelik = 6
  } else if (myRank !== null && myRank > 10 && avgRatings < 3000 && activeCompetitors < 4) {
    durum = 'Kolay Fırsat'
    renk = 'yeşil'
    sebep = `#${myRank}, zayıf rakip grubu.`
    aksiyon = `"${keyword}" kelimesini başlığa ekle.`
    oncelik = 1
  } else if (myRank !== null && myRank > 30 && avgRatings > 10000) {
    durum = 'Zor Rekabet'
    renk = 'kırmızı'
    sebep = `#${myRank}, güçlü rakipler.`
    aksiyon = 'Long-tail varyasyon dene.'
    oncelik = 3
  } else {
    durum = 'Orta Durum'
    renk = 'turuncu'
    sebep = `#${myRank ?? '—'}, orta rekabet.`
    aksiyon = 'Açıklamada kelimeyi güçlendir.'
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
    top3: top10.slice(0, 3).map((a, i) => ({
      rank: i + 1,
      title: a.title,
      appId: a.appId,
      ratings: a.ratings,
    })),
  }
}
