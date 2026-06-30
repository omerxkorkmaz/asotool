import type { NextApiRequest, NextApiResponse } from 'next'
import { withApiHandler, sendJson } from '@/lib/api-handler'
import { cachedSearch, findMyRank } from '@/lib/gplay'
import { ValidationError } from '@/lib/errors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { q, appId, country = 'tr', lang = 'tr', num = '100' } = req.query
  if (!q || typeof q !== 'string') throw new ValidationError('q parametresi zorunlu')

  const capped = Math.min(parseInt(String(num), 10) || 100, 100)
  const results = await cachedSearch({
    term: q,
    country: String(country),
    lang: String(lang),
    num: capped,
  })

  const myRank = findMyRank(results, typeof appId === 'string' ? appId : undefined)

  sendJson(res, {
    keyword: q,
    myRank,
    total: results.length,
    results: results.map((a, i) => ({
      rank: i + 1,
      appId: a.appId,
      title: a.title,
      developer: a.developer,
      score: a.score,
      ratings: a.ratings,
      installs: a.installs,
      icon: a.icon,
      free: a.free,
      isMe: appId ? a.appId === appId : false,
    })),
  })
}

export default withApiHandler(handler, { methods: ['GET'], routeName: 'keywords' })
