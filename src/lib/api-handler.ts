import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'
import { AppError, getErrorMessage, logApiError } from './errors'
import { RedisUnavailableError } from './redis'
import { getRedis } from './redis'

type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void

interface HandlerOptions {
  methods: string[]
  routeName?: string
  /** Include redisAvailable flag in error responses when Redis optional */
  trackRedis?: boolean
}

function attachMetaHeaders(res: NextApiResponse, trackRedis?: boolean) {
  if (trackRedis) {
    res.setHeader('X-Redis-Available', getRedis() ? 'true' : 'false')
  }
}

/** Wraps Pages API handlers with consistent error responses */
export function withApiHandler(
  handler: ApiHandler,
  options: HandlerOptions
): NextApiHandler {
  const { methods, routeName = 'unknown', trackRedis = false } = options

  return async (req, res) => {
    attachMetaHeaders(res, trackRedis)

    if (!methods.includes(req.method ?? '')) {
      return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
    }

    try {
      await handler(req, res)
    } catch (err) {
      logApiError(routeName, err)

      if (err instanceof RedisUnavailableError) {
        return res.status(503).json({
          error: err.message + ' Yerel mod: tarayıcı localStorage kullanılabilir.',
          code: 'REDIS_UNAVAILABLE',
          redisAvailable: false,
        })
      }
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({
          error: err.message,
          code: err.code,
          ...(trackRedis ? { redisAvailable: !!getRedis() } : {}),
        })
      }

      const message = getErrorMessage(err)
      const isTimeout = message.toLowerCase().includes('timeout') || message.includes('ETIMEDOUT')
      return res.status(isTimeout ? 504 : 500).json({
        error: isTimeout
          ? 'İşlem zaman aşımına uğradı. Daha az keyword ile tekrar deneyin.'
          : message,
        code: isTimeout ? 'TIMEOUT' : 'INTERNAL_ERROR',
      })
    }
  }
}

export function sendJson<T>(res: NextApiResponse, data: T, status = 200): void {
  res.status(status).json(data)
}

export function redisMeta() {
  return { redisAvailable: !!getRedis() }
}
