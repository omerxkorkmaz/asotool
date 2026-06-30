import gplay from 'google-play-scraper'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { q, appId, country = 'tr', lang = 'tr', num = 100 } = req.query
  if (!q) return res.status(400).json({ error: 'q parametresi zorunlu' })

  try {
    const results = await gplay.search({
      term: q,
      country,
      lang,
      num: Math.min(parseInt(num), 100), // google-play-scraper search() pratikte ~100 üstünü desteklemiyor
      fullDetail: false,
    })

    // Kendi uygulamamızın sırası
    let myRank = null
    if (appId) {
      const idx = results.findIndex(a => a.appId === appId)
      myRank = idx >= 0 ? idx + 1 : null
    }

    return res.status(200).json({
      keyword: q,
      myRank,
      total: results.length,
      results: results.map((a, i) => ({
        rank: i + 1,
        appId: a.appId,
        title: a.title,
        developer: a.developer,
        score: a.score,
        ratings: a.ratings,
        installs: a.installs,
        icon: a.icon,
        free: a.free,
        isMe: appId ? a.appId === appId : false,
      }))
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
