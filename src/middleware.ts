import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Redis } from '@upstash/redis'
import { CACHE_KEYS } from '@/lib/cache-keys'

const RATE_LIMIT_WINDOW_SEC = 60
const RATE_LIMIT_MAX = 60
const HEAVY_RATE_LIMIT_MAX = 12

/** AI/scrape-heavy endpoints — stricter per-minute cap */
const HEAVY_API_ROUTES = new Set([
  '/api/bulk-scan',
  '/api/aso-audit',
  '/api/metadata-optimizer',
  '/api/multi-country',
  '/api/categorize-reviews',
])

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

async function checkRateLimit(
  ip: string,
  max: number,
  suffix = ''
): Promise<{ ok: boolean; remaining: number }> {
  try {
    const redis = Redis.fromEnv()
    const window = Math.floor(Date.now() / (RATE_LIMIT_WINDOW_SEC * 1000))
    const key = CACHE_KEYS.rateLimit(ip, `${window}${suffix}`)
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC)
    return { ok: count <= max, remaining: Math.max(0, max - count) }
  } catch {
    return { ok: true, remaining: max }
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  if (pathname === '/api/cron-scan' || pathname === '/api/cron/daily-logger') {
    return NextResponse.next()
  }

  const ip = getClientIp(req)
  const isHeavy = HEAVY_API_ROUTES.has(pathname)
  const max = isHeavy ? HEAVY_RATE_LIMIT_MAX : RATE_LIMIT_MAX
  const { ok, remaining } = await checkRateLimit(ip, max, isHeavy ? ':heavy' : '')

  if (!ok) {
    return NextResponse.json(
      {
        error: isHeavy
          ? 'AI/scrape endpoint limiti aşıldı. Dakikada en fazla 12 ağır analiz — lütfen bekleyin.'
          : 'Çok fazla istek. Lütfen bir dakika bekleyin.',
        code: 'RATE_LIMIT',
        retryAfterSec: RATE_LIMIT_WINDOW_SEC,
      },
      { status: 429, headers: { 'Retry-After': String(RATE_LIMIT_WINDOW_SEC) } }
    )
  }

  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Remaining', String(remaining))
  response.headers.set('X-RateLimit-Tier', isHeavy ? 'heavy' : 'standard')
  return response
}

export const config = {
  matcher: '/api/:path*',
}
