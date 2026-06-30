import type { NextApiRequest, NextApiResponse } from 'next'
import { withApiHandler, sendJson } from '@/lib/api-handler'
import { addApp, getApps, removeApp } from '@/lib/app-manager'
import { getRedis } from '@/lib/redis'
import { ValidationError } from '@/lib/errors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const data = await getApps()
    return sendJson(res, data)
  }

  if (req.method === 'POST') {
    const { packageName, country = 'tr', lang = 'tr' } = req.body
    if (!packageName || typeof packageName !== 'string') {
      throw new ValidationError('packageName zorunlu')
    }
    const profile = await addApp(packageName.trim(), country, lang)
    return sendJson(res, { profile, redisSaved: !!getRedis() })
  }

  if (req.method === 'DELETE') {
    const { packageName } = req.body
    if (!packageName) throw new ValidationError('packageName zorunlu')
    await removeApp(packageName)
    return sendJson(res, { removed: true })
  }
}

export default withApiHandler(handler, { methods: ['GET', 'POST', 'DELETE'], routeName: 'apps' })
