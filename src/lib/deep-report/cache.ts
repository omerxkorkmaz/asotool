import { getRedis } from '@/lib/redis'
import type { DeepReport } from './types'

const CACHE_TTL = 3600

export function getCacheKey(myAppId: string, competitorIds: string[]): string {
  const ids = [myAppId, ...competitorIds].sort().join(':')
  return `deep-report:${ids}`
}

export async function getCachedReport(key: string): Promise<DeepReport | null> {
  try {
    const redis = getRedis()
    if (!redis) return null
    const cached = await redis.get<string>(key)
    if (!cached) return null
    return typeof cached === 'string' ? JSON.parse(cached) : (cached as DeepReport)
  } catch {
    return null
  }
}

export async function cacheReport(key: string, report: DeepReport): Promise<void> {
  try {
    const redis = getRedis()
    if (!redis) return
    await redis.set(key, JSON.stringify(report), { ex: CACHE_TTL })
  } catch {
    // Cache failure is non-critical
  }
}
