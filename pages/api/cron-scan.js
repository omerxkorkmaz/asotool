import gplay from 'google-play-scraper'
import { getRedis } from '../../lib/redis'

// Bu endpoint Vercel Cron tarafından günde 1 kez çağrılır (vercel.json'da tanımlı).
// Manuel test için de GET ile direkt çağrılabilir.
export default async function handler(req, res) {
  // Vercel Cron istekleri Authorization header'ında CRON_SECRET taşır (env'de tanımlıysa).
  // Tanımlıysa kontrol et, tanımlı değilse (henüz kurulmadıysa) izin ver.
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.authorization
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Yetkisiz' })
    }
  }

  const redis = getRedis()
  if (!redis) {
    return res.status(503).json({ error: 'Redis bağlı değil, KV kurulumu eksik' })
  }

  try {
    // Tüm "tracked:*" anahtarlarını bul
    const trackedKeys = await redis.keys('tracked:*')
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    let totalScanned = 0
    const errors = []

    for (const trackedKey of trackedKeys) {
      const appId = trackedKey.replace('tracked:', '')
      const list = (await redis.get(trackedKey)) || []

      for (const item of list) {
        try {
          const results = await gplay.search({
            term: item.keyword,
            country: item.country || 'tr',
            lang: item.lang || 'tr',
            num: 100,
            fullDetail: false,
          })
          const idx = results.findIndex(a => a.appId === appId)
          const rank = idx >= 0 ? idx + 1 : null

          const historyKey = `history:${appId}:${item.keyword}`
          const history = (await redis.get(historyKey)) || []

          // Bugün için zaten kayıt varsa üzerine yaz, yoksa ekle
          const existingIdx = history.findIndex(h => h.date === today)
          const entry = { date: today, rank, totalResults: results.length }
          if (existingIdx >= 0) history[existingIdx] = entry
          else history.push(entry)

          // Son 90 günü tut, daha eskisini at
          const trimmed = history.slice(-90)
          await redis.set(historyKey, trimmed)

          totalScanned++
        } catch (err) {
          errors.push({ appId, keyword: item.keyword, error: err.message })
        }
      }
    }

    return res.status(200).json({
      date: today,
      trackedApps: trackedKeys.length,
      totalScanned,
      errors: errors.length ? errors : undefined,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
