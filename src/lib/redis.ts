import { Redis } from '@upstash/redis'

let redis: Redis | null = null

/** Upstash Redis singleton — KV_REST_API_* env vars from Vercel Storage */
export function getRedis(): Redis | null {
  if (redis) return redis
  try {
    redis = Redis.fromEnv()
    return redis
  } catch {
    return null
  }
}

export const REDIS_UNAVAILABLE_MSG =
  "Redis bağlı değil. Vercel'de Storage > Create Database > KV (Upstash) ekleyip deploy etmen gerekiyor."

export function requireRedis(): Redis {
  const client = getRedis()
  if (!client) throw new RedisUnavailableError()
  return client
}

export class RedisUnavailableError extends Error {
  constructor() {
    super(REDIS_UNAVAILABLE_MSG)
    this.name = 'RedisUnavailableError'
  }
}
