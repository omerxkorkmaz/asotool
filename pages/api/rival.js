import gplay from 'google-play-scraper'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { appId, country = 'tr', lang = 'tr' } = req.query
  if (!appId) return res.status(400).json({ error: 'appId zorunlu' })

  try {
    const app = await gplay.app({ appId, country, lang })

    return res.status(200).json({
      appId: app.appId,
      title: app.title,
      developer: app.developer,
      developerId: app.developerId,
      icon: app.icon,
      score: app.score,
      ratings: app.ratings,
      reviews: app.reviews,
      installs: app.installs,
      minInstalls: app.minInstalls,
      maxInstalls: app.maxInstalls,
      free: app.free,
      price: app.price,
      genre: app.genre,
      genreId: app.genreId,
      description: app.description?.slice(0, 800),
      shortDescription: app.summary,
      recentChanges: app.recentChanges,
      updated: app.updated,
      version: app.version,
      androidVersion: app.androidVersion,
      contentRating: app.contentRating,
      screenshots: app.screenshots?.slice(0, 3),
      headerImage: app.headerImage,
      histogram: app.histogram, // {1:x, 2:x, 3:x, 4:x, 5:x}
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
