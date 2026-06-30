import type { NextApiRequest, NextApiResponse } from 'next'
import { getRedis } from '@/lib/redis'
import { CACHE_KEYS } from '@/lib/cache-keys'
import { cachedSearch, findMyRank } from '@/lib/gplay'
import type { RankHistoryEntry, TrackedKeyword } from '@/types/api'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    const trackedKeys = await redis.keys('tracked:*')
    const today = new Date().toISOString().split('T')[0]

    let totalScanned = 0
    const errors: Array<{ appId: string; keyword: string; error: string }> = []

    for (const trackedKey of trackedKeys) {
      const appId = trackedKey.replace('tracked:', '')
      const list = (await redis.get<TrackedKeyword[]>(trackedKey)) || []

      for (const item of list) {
        try {
          const results = await cachedSearch({
            term: item.keyword,
            country: item.country || 'tr',
            lang: item.lang || 'tr',
            num: 100,
          })
          const rank = findMyRank(results, appId)

          const historyKey = CACHE_KEYS.history(appId, item.keyword)
          const history = (await redis.get<RankHistoryEntry[]>(historyKey)) || []

          const existingIdx = history.findIndex((h) => h.date === today)
          const entry: RankHistoryEntry = { date: today, rank, totalResults: results.length }
          if (existingIdx >= 0) history[existingIdx] = entry
          else history.push(entry)

          await redis.set(historyKey, history.slice(-90))
          totalScanned++
        } catch (err) {
          errors.push({
            appId,
            keyword: item.keyword,
            error: err instanceof Error ? err.message : String(err),
          })
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
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
