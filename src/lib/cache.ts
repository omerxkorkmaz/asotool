import { getRedis } from './redis'
import { CACHE_TTL } from './cache-keys'

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    return (await redis.get<T>(key)) ?? null
  } catch (err) {
    console.warn('[cache] get failed:', key, err)
    return null
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(key, value, { ex: ttlSeconds })
  } catch (err) {
    console.warn('[cache] set failed:', key, err)
  }
}

export async function cacheThrough<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key)
  if (cached !== null) return cached

  const fresh = await fetcher()
  await cacheSet(key, fresh, ttlSeconds)
  return fresh
}

export { CACHE_TTL }
