import type { NextApiRequest, NextApiResponse } from 'next'
import { withApiHandler, sendJson } from '@/lib/api-handler'
import { cachedList, findMyRank } from '@/lib/gplay'
import { ValidationError } from '@/lib/errors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const {
    category = 'APPLICATION',
    collection = 'TOP_FREE',
    country = 'tr',
    lang = 'tr',
    num = '50',
    appId,
  } = req.query

  const capped = Math.min(parseInt(String(num), 10) || 50, 50)
  const results = await cachedList({
    category: String(category),
    collection: String(collection),
    country: String(country),
    lang: String(lang),
    num: capped,
  })

  const myRank = findMyRank(results, typeof appId === 'string' ? appId : undefined)

  sendJson(res, {
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
    })),
  })
}

export default withApiHandler(handler, { methods: ['GET'], routeName: 'category' })
