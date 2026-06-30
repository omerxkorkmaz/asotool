import type { NextApiRequest, NextApiResponse } from 'next'
import { withApiHandler, sendJson } from '@/lib/api-handler'
import { getAppDetails, updateHealthScore, removeApp } from '@/lib/app-manager'
import { getRedis } from '@/lib/redis'
import { ValidationError } from '@/lib/errors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { packageName } = req.query
  if (!packageName || typeof packageName !== 'string') {
    throw new ValidationError('packageName zorunlu')
  }

  const pkg = decodeURIComponent(packageName)

  if (req.method === 'GET') {
    const redis = getRedis()
    if (!redis) {
      return sendJson(res, { error: 'Redis gerekli', redisAvailable: false }, 503)
    }
    const data = await getAppDetails(pkg)
    if (!data) throw new ValidationError('Uygulama bulunamadı')
    return sendJson(res, { ...data, redisAvailable: true })
  }

  if (req.method === 'POST') {
    const { action, country, lang } = req.body ?? {}
    if (action === 'refresh') {
      const profile = await updateHealthScore(pkg, country, lang)
      const data = await getAppDetails(pkg)
      return sendJson(res, { profile, dashboard: data })
    }
    throw new ValidationError('Geçersiz action')
  }

  if (req.method === 'DELETE') {
    await removeApp(pkg)
    return sendJson(res, { removed: true })
  }
}

export default withApiHandler(handler, { methods: ['GET', 'POST', 'DELETE'], routeName: 'apps-detail' })
