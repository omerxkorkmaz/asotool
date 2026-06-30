import type { NextApiRequest, NextApiResponse } from 'next'
import { withApiHandler, sendJson } from '@/lib/api-handler'
import { cachedApp } from '@/lib/gplay'
import { ValidationError } from '@/lib/errors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { appId, country = 'tr', lang = 'tr' } = req.query
  if (!appId || typeof appId !== 'string') throw new ValidationError('appId zorunlu')

  const app = await cachedApp({ appId, country: String(country), lang: String(lang) })

  sendJson(res, {
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
    description: app.description,
    descriptionHTML: app.descriptionHTML,
    shortDescription: app.summary,
    recentChanges: app.recentChanges,
    updated: app.updated,
    version: app.version,
    androidVersion: app.androidVersion,
    contentRating: app.contentRating,
    screenshots: app.screenshots?.slice(0, 3),
    headerImage: app.headerImage,
    histogram: app.histogram,
  })
}

export default withApiHandler(handler, { methods: ['GET'], routeName: 'rival' })
