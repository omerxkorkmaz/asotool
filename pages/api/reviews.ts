import type { NextApiRequest, NextApiResponse } from 'next'
import { withApiHandler, sendJson } from '@/lib/api-handler'
import { cachedReviews } from '@/lib/gplay'
import { ValidationError } from '@/lib/errors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { appId, country = 'tr', lang = 'tr', sort = '1', num = '100', rating } = req.query
  if (!appId || typeof appId !== 'string') throw new ValidationError('appId zorunlu')

  const reviews = await cachedReviews({
    appId,
    country: String(country),
    lang: String(lang),
    sort: parseInt(String(sort), 10),
    num: Math.min(parseInt(String(num), 10) || 100, 200),
  })

  const ratingFilter = rating ? parseInt(String(rating), 10) : null
  const filtered = ratingFilter ? reviews.filter((r) => r.score === ratingFilter) : reviews

  sendJson(res, {
    total: filtered.length,
    reviews: filtered.map((r) => ({
      id: r.id,
      userName: r.userName,
      score: r.score,
      text: r.text,
      date: r.date,
      thumbsUp: r.thumbsUp,
      replyText: r.replyText,
      replyDate: r.replyDate,
    })),
  })
}

export default withApiHandler(handler, { methods: ['GET'], routeName: 'reviews' })
