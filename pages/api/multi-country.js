import gplay from 'google-play-scraper'

// google-play-scraper'ın desteklediği gl (ülke) / hl (dil) kombinasyonları.
// Bunlar Google Play'in resmi store kodlarıdır.
export const COUNTRY_PRESETS = [
  { gl: 'tr', hl: 'tr', label: 'Türkiye' },
  { gl: 'us', hl: 'en', label: 'ABD' },
  { gl: 'gb', hl: 'en', label: 'İngiltere' },
  { gl: 'de', hl: 'de', label: 'Almanya' },
  { gl: 'fr', hl: 'fr', label: 'Fransa' },
  { gl: 'es', hl: 'es', label: 'İspanya' },
  { gl: 'it', hl: 'it', label: 'İtalya' },
  { gl: 'br', hl: 'pt', label: 'Brezilya' },
  { gl: 'pt', hl: 'pt', label: 'Portekiz' },
  { gl: 'ru', hl: 'ru', label: 'Rusya' },
  { gl: 'sa', hl: 'ar', label: 'Suudi Arabistan' },
  { gl: 'ae', hl: 'ar', label: 'BAE' },
  { gl: 'eg', hl: 'ar', label: 'Mısır' },
  { gl: 'in', hl: 'en', label: 'Hindistan' },
  { gl: 'id', hl: 'id', label: 'Endonezya' },
  { gl: 'pk', hl: 'en', label: 'Pakistan' },
  { gl: 'nl', hl: 'nl', label: 'Hollanda' },
  { gl: 'pl', hl: 'pl', label: 'Polonya' },
  { gl: 'mx', hl: 'es', label: 'Meksika' },
  { gl: 'ar', hl: 'es', label: 'Arjantin' },
  { gl: 'jp', hl: 'ja', label: 'Japonya' },
  { gl: 'kr', hl: 'ko', label: 'G. Kore' },
]

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { keyword, appId, countries } = req.body
  if (!keyword) return res.status(400).json({ error: 'keyword zorunlu' })

  // countries: ["tr","us","de"] gibi gl kodları array'i. Boşsa hepsini tara.
  const targets = countries?.length
    ? COUNTRY_PRESETS.filter(c => countries.includes(c.gl))
    : COUNTRY_PRESETS

  // Paralel ama Google'ı boğmamak için 5'erli batch
  const batchSize = 5
  const allResults = []

  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(async (c) => {
        try {
          const results = await gplay.search({
            term: keyword,
            country: c.gl,
            lang: c.hl,
            num: 50,
            fullDetail: false,
          })

          let myRank = null
          if (appId) {
            const idx = results.findIndex(a => a.appId === appId)
            myRank = idx >= 0 ? idx + 1 : null
          }

          const top5 = results.slice(0, 5).map((a, idx) => ({
            rank: idx + 1,
            title: a.title,
            appId: a.appId,
            score: a.score,
            installs: a.installs,
          }))

          return {
            country: c.label,
            gl: c.gl,
            hl: c.hl,
            myRank,
            totalResults: results.length,
            top5,
            error: null,
          }
        } catch (err) {
          return { country: c.label, gl: c.gl, hl: c.hl, myRank: null, totalResults: 0, top5: [], error: err.message }
        }
      })
    )
    allResults.push(...batchResults)
  }

  return res.status(200).json({
    keyword,
    appId: appId || null,
    scannedCountries: allResults.length,
    results: allResults,
  })
}
