import gplay from 'google-play-scraper'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { appId, country = 'tr', lang = 'tr', sort = '0', num = 100, rating } = req.query
  if (!appId) return res.status(400).json({ error: 'appId zorunlu' })

  // sort: 0=Relevance, 1=Helpful, 2=Newest, 3=Rating
  const sortMap = { '0': gplay.sort.RELEVANCE, '1': gplay.sort.HELPFULNESS, '2': gplay.sort.NEWEST, '3': gplay.sort.RATING }

  try {
    const { data } = await gplay.reviews({
      appId,
      country,
      lang,
      sort: sortMap[sort] ?? gplay.sort.HELPFULNESS,
      num: Math.min(parseInt(num), 200),
    })

    let filtered = data
    if (rating) {
      filtered = data.filter(r => r.score === parseInt(rating))
    }

    return res.status(200).json({
      appId,
      total: filtered.length,
      reviews: filtered.map(r => ({
        id: r.id,
        userName: r.userName,
        score: r.score,
        text: r.text,
        thumbsUp: r.thumbsUp,
        date: r.date,
        replyDate: r.replyDate,
        replyText: r.replyText,
      }))
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
