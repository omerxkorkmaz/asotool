import type { NextApiRequest, NextApiResponse } from 'next'
import { withApiHandler, sendJson } from '@/lib/api-handler'
import { requireRedis } from '@/lib/redis'
import { CACHE_KEYS } from '@/lib/cache-keys'
import type { TrackedKeyword } from '@/types/api'
import { ValidationError } from '@/lib/errors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const redis = requireRedis()

  if (req.method === 'GET') {
    const { appId } = req.query
    if (!appId || typeof appId !== 'string') throw new ValidationError('appId zorunlu')
    const list = await redis.get<TrackedKeyword[]>(CACHE_KEYS.tracked(appId))
    return sendJson(res, { tracked: list || [] })
  }

  if (req.method === 'POST') {
    const { appId, keyword, country = 'tr', lang = 'tr' } = req.body
    if (!appId || !keyword) throw new ValidationError('appId ve keyword zorunlu')
    const list = (await redis.get<TrackedKeyword[]>(CACHE_KEYS.tracked(appId))) || []
    if (list.find((k) => k.keyword === keyword)) {
      return sendJson(res, { tracked: list })
    }
    const newList: TrackedKeyword[] = [
      ...list,
      { keyword, country, lang, addedAt: new Date().toISOString() },
    ]
    await redis.set(CACHE_KEYS.tracked(appId), newList)
    return sendJson(res, { tracked: newList })
  }

  if (req.method === 'DELETE') {
    const { appId, keyword } = req.body
    if (!appId || !keyword) throw new ValidationError('appId ve keyword zorunlu')
    const list = (await redis.get<TrackedKeyword[]>(CACHE_KEYS.tracked(appId))) || []
    const newList = list.filter((k) => k.keyword !== keyword)
    await redis.set(CACHE_KEYS.tracked(appId), newList)
    return sendJson(res, { tracked: newList })
  }
}

export default withApiHandler(handler, { methods: ['GET', 'POST', 'DELETE'], routeName: 'tracked' })
