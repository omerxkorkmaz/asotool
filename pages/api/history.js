import { getRedis } from '../../lib/redis'

export default async function handler(req, res) {
  const redis = getRedis()
  if (!redis) {
    return res.status(503).json({ error: 'Redis bağlı değil, KV kurulumu eksik' })
  }

  if (req.method !== 'GET') return res.status(405).end()

  const { appId, keyword } = req.query
  if (!appId) return res.status(400).json({ error: 'appId zorunlu' })

  try {
    if (keyword) {
      // Tek keyword'ün geçmişi
      const history = (await redis.get(`history:${appId}:${keyword}`)) || []
      return res.status(200).json({ keyword, history })
    } else {
      // Bu app için takip edilen tüm keywordlerin geçmişi
      const tracked = (await redis.get(`tracked:${appId}`)) || []
      const allHistory = {}
      for (const item of tracked) {
        const history = (await redis.get(`history:${appId}:${item.keyword}`)) || []
        allHistory[item.keyword] = history
      }
      return res.status(200).json({ appId, allHistory })
    }
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
