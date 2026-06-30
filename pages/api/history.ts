import type { NextApiRequest, NextApiResponse } from 'next'
import { withApiHandler, sendJson } from '@/lib/api-handler'
import { requireRedis } from '@/lib/redis'
import { CACHE_KEYS } from '@/lib/cache-keys'
import type { RankHistoryEntry, TrackedKeyword } from '@/types/api'
import { ValidationError } from '@/lib/errors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const redis = requireRedis()
  const { appId, keyword } = req.query
  if (!appId || typeof appId !== 'string') throw new ValidationError('appId zorunlu')

  if (keyword && typeof keyword === 'string') {
    const history = await redis.get<RankHistoryEntry[]>(CACHE_KEYS.history(appId, keyword))
    return sendJson(res, { keyword, history: history || [] })
  }

  const tracked = (await redis.get<TrackedKeyword[]>(CACHE_KEYS.tracked(appId))) || []
  const allHistory: Record<string, RankHistoryEntry[]> = {}
  for (const t of tracked) {
    const hist = await redis.get<RankHistoryEntry[]>(CACHE_KEYS.history(appId, t.keyword))
    allHistory[t.keyword] = hist || []
  }
  sendJson(res, { allHistory })
}

export default withApiHandler(handler, { methods: ['GET'], routeName: 'history' })
