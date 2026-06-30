import type { NextApiRequest, NextApiResponse } from 'next'
import { withApiHandler, sendJson } from '@/lib/api-handler'
import { requireRedis } from '@/lib/redis'
import { CACHE_KEYS } from '@/lib/cache-keys'
import type { BulkScanResult } from '@/types/gemini'
import { ValidationError } from '@/lib/errors'

const MAX_HISTORY = 20

interface HistoryEntry {
  savedAt: string
  result: BulkScanResult
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const redis = requireRedis()

  if (req.method === 'GET') {
    const { packageName } = req.query
    if (!packageName || typeof packageName !== 'string') {
      throw new ValidationError('packageName zorunlu')
    }
    const history = (await redis.get<HistoryEntry[]>(CACHE_KEYS.bulkScanHistory(packageName))) || []
    return sendJson(res, { history })
  }

  if (req.method === 'POST') {
    const { packageName, result } = req.body as { packageName?: string; result?: BulkScanResult }
    if (!packageName || !result) throw new ValidationError('packageName ve result zorunlu')

    const key = CACHE_KEYS.bulkScanHistory(packageName)
    const existing = (await redis.get<HistoryEntry[]>(key)) || []
    const entry: HistoryEntry = { savedAt: new Date().toISOString(), result }
    const updated = [entry, ...existing].slice(0, MAX_HISTORY)
    await redis.set(key, updated)
    return sendJson(res, { saved: true, total: updated.length })
  }
}

export default withApiHandler(handler, { methods: ['GET', 'POST'], routeName: 'bulk-scan-history' })
