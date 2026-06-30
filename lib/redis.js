import { Redis } from '@upstash/redis'

// Vercel'de Storage > KV (Upstash Redis) bağladığında bu env değişkenleri otomatik gelir:
// KV_REST_API_URL, KV_REST_API_TOKEN (ya da UPSTASH_REDIS_REST_URL/TOKEN)
// Redis.fromEnv() ikisini de otomatik dener.
let redis = null

export function getRedis() {
  if (redis) return redis
  try {
    redis = Redis.fromEnv()
    return redis
  } catch (e) {
    return null // env yoksa (henüz KV kurulmadıysa) null dön, çağıran taraf nazikçe handle etsin
  }
}
