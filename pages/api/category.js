import gplay from 'google-play-scraper'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { category = 'APPLICATION', collection = 'TOP_FREE', country = 'tr', num = 50, appId } = req.query

  // collection map
  const collMap = {
    'TOP_FREE':    gplay.collection.TOP_FREE,
    'TOP_PAID':    gplay.collection.TOP_PAID,
    'GROSSING':    gplay.collection.GROSSING,
    'NEW_FREE':    gplay.collection.NEW_FREE,
    'NEW_PAID':    gplay.collection.NEW_PAID,
  }

  try {
    const results = await gplay.list({
      category: gplay.category[category] ?? category,
      collection: collMap[collection] ?? gplay.collection.TOP_FREE,
      country,
      num: Math.min(parseInt(num), 200),
      fullDetail: false,
    })

    let myRank = null
    if (appId) {
      const idx = results.findIndex(a => a.appId === appId)
      myRank = idx >= 0 ? idx + 1 : null
    }

    return res.status(200).json({
      category,
      collection,
      myRank,
      total: results.length,
      results: results.map((a, i) => ({
        rank: i + 1,
        appId: a.appId,
        title: a.title,
        developer: a.developer,
        score: a.score,
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
