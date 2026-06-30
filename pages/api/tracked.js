import { getRedis } from '../../lib/redis'

// Key yapısı:
// tracked:{appId}              -> JSON array of {keyword, country, lang, addedAt}
// history:{appId}:{keyword}    -> JSON array of {date, rank, totalResults} (en eski -> en yeni)

export default async function handler(req, res) {
  const redis = getRedis()
  if (!redis) {
    return res.status(503).json({
      error: 'Redis bağlı değil. Vercel\'de Storage > Create Database > KV (Upstash) ekleyip deploy etmen gerekiyor.'
    })
  }

  const { appId } = req.query

  if (req.method === 'GET') {
    if (!appId) return res.status(400).json({ error: 'appId zorunlu' })
    try {
      const list = await redis.get(`tracked:${appId}`)
      return res.status(200).json({ tracked: list || [] })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'POST') {
    const { appId, keyword, country = 'tr', lang = 'tr' } = req.body
    if (!appId || !keyword) return res.status(400).json({ error: 'appId ve keyword zorunlu' })
    try {
      const list = (await redis.get(`tracked:${appId}`)) || []
      if (list.find(k => k.keyword === keyword)) {
        return res.status(200).json({ tracked: list }) // zaten var, sessizce dön
      }
      const newList = [...list, { keyword, country, lang, addedAt: new Date().toISOString() }]
      await redis.set(`tracked:${appId}`, newList)
      return res.status(200).json({ tracked: newList })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  if (req.method === 'DELETE') {
    const { appId, keyword } = req.body
    if (!appId || !keyword) return res.status(400).json({ error: 'appId ve keyword zorunlu' })
    try {
      const list = (await redis.get(`tracked:${appId}`)) || []
      const newList = list.filter(k => k.keyword !== keyword)
      await redis.set(`tracked:${appId}`, newList)
      return res.status(200).json({ tracked: newList })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).end()
}
