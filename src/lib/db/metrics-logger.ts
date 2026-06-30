import { getStoreAdapter, type Platform } from '@/lib/store-adapters'
import { supabase } from '@/lib/db/supabase'

const INSTALLS_MAP: Record<string, { min: number; max: number }> = {
  '0+': { min: 0, max: 10 },
  '1+': { min: 1, max: 5 },
  '5+': { min: 5, max: 10 },
  '10+': { min: 10, max: 50 },
  '50+': { min: 50, max: 100 },
  '100+': { min: 100, max: 500 },
  '500+': { min: 500, max: 1000 },
  '1K+': { min: 1000, max: 5000 },
  '5K+': { min: 5000, max: 10000 },
  '10K+': { min: 10000, max: 50000 },
  '50K+': { min: 50000, max: 100000 },
  '100K+': { min: 100000, max: 500000 },
  '500K+': { min: 500000, max: 1000000 },
  '1M+': { min: 1000000, max: 5000000 },
  '5M+': { min: 5000000, max: 10000000 },
  '10M+': { min: 10000000, max: 50000000 },
  '50M+': { min: 50000000, max: 100000000 },
  '100M+': { min: 100000000, max: 500000000 },
  '500M+': { min: 500000000, max: 1000000000 },
  '1B+': { min: 1000000000, max: 5000000000 },
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Android: google-play-scraper max 250. iOS: up to 800. */
function getKeywordSearchDepth(platform: Platform): number {
  const requested = parseInt(process.env.KEYWORD_SEARCH_DEPTH || '250', 10) || 250
  const cap = platform === 'android' ? 250 : 800
  return Math.min(Math.max(requested, 1), cap)
}

export function parseInstallsRange(range: string): { min: number; max: number } {
  const normalized = range.replace(/,/g, '').trim()
  if (INSTALLS_MAP[normalized]) return INSTALLS_MAP[normalized]

  const withPlus = normalized.endsWith('+') ? normalized : `${normalized}+`
  if (INSTALLS_MAP[withPlus]) return INSTALLS_MAP[withPlus]

  const numericMatch = normalized.match(/^(\d+(?:\.\d+)?)([KMB])?\+?$/i)
  if (numericMatch) {
    let n = parseFloat(numericMatch[1])
    const suffix = (numericMatch[2] || '').toUpperCase()
    if (suffix === 'K') n *= 1000
    else if (suffix === 'M') n *= 1_000_000
    else if (suffix === 'B') n *= 1_000_000_000

    const tiers = Object.values(INSTALLS_MAP).sort((a, b) => a.min - b.min)
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (n >= tiers[i].min) return tiers[i]
    }
  }

  return { min: 0, max: 0 }
}

function resolveInstallBounds(
  installsRange: string,
  installsMin?: number,
  installsMax?: number
): { min: number; max: number } {
  const parsed = parseInstallsRange(installsRange)
  return {
    min: parsed.min || installsMin || 0,
    max: parsed.max || installsMax || 0,
  }
}

export async function logDailyMetrics(
  appId: string,
  platform: Platform
): Promise<{ success: boolean; error?: string }> {
  try {
    const adapter = getStoreAdapter(platform)
    const result = await adapter.getApp(appId)

    const { min, max } = resolveInstallBounds(
      result.installs,
      result.installsMin,
      result.installsMax
    )

    const { error } = await supabase.from('apps_daily_metrics').upsert(
      {
        app_id: appId,
        platform,
        date: todayDate(),
        rating: result.score ?? null,
        rating_count: result.ratings ?? null,
        installs_range: result.installs,
        installs_min: min || null,
        installs_max: max || null,
        review_count: result.reviews ?? null,
        title: result.title,
        short_description: result.summary,
        version: result.version,
        last_updated: result.updated,
        price: result.priceText,
        developer_name: result.developer,
        category: result.genre,
      },
      { onConflict: 'app_id,platform,date' }
    )

    if (error) throw error
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`logDailyMetrics failed for ${appId} (${platform}):`, message)
    return { success: false, error: message }
  }
}

export async function logKeywordRanking(
  keyword: string,
  appId: string,
  platform: Platform
): Promise<{ success: boolean; rank: number | null; error?: string }> {
  try {
    const adapter = getStoreAdapter(platform)
    const searchDepth = getKeywordSearchDepth(platform)
    const results = await adapter.search(keyword, searchDepth)

    const position = results.findIndex((r) => r.appId === appId)
    const rank = position === -1 ? null : position + 1

    const { error } = await supabase.from('keyword_rankings_history').upsert(
      {
        keyword,
        app_id: appId,
        platform,
        date: todayDate(),
        rank,
        total_results: results.length,
      },
      { onConflict: 'keyword,app_id,platform,date' }
    )

    if (error) throw error
    return { success: true, rank }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`logKeywordRanking failed for "${keyword}" (${appId}):`, message)
    return { success: false, rank: null, error: message }
  }
}

export async function logAllTrackedApps(): Promise<{
  metrics: { appId: string; platform: string; success: boolean; error?: string }[]
  keywords: { keyword: string; appId: string; success: boolean; rank: number | null; error?: string }[]
  errors: string[]
}> {
  const appsEnv = process.env.TRACKED_APPS || ''
  const keywordsEnv = process.env.TRACKED_KEYWORDS || ''

  const appEntries = appsEnv.split(',').map((s) => s.trim()).filter(Boolean)
  const keywords = keywordsEnv.split(',').map((s) => s.trim()).filter(Boolean)

  const metrics: Array<{ appId: string; platform: string; success: boolean; error?: string }> = []
  const keywordResults: Array<{
    keyword: string
    appId: string
    success: boolean
    rank: number | null
    error?: string
  }> = []
  const errors: string[] = []

  for (const entry of appEntries) {
    const [platformStr, ...appIdParts] = entry.split(':')
    const appId = appIdParts.join(':')
    const platform = platformStr as Platform

    if (!platform || !appId) {
      errors.push(`Invalid TRACKED_APPS entry: ${entry}`)
      continue
    }

    if (platform !== 'android' && platform !== 'ios') {
      errors.push(`Unknown platform: ${platform} in entry: ${entry}`)
      continue
    }

    const metricResult = await logDailyMetrics(appId, platform)
    metrics.push({ appId, platform, ...metricResult })
    await new Promise((r) => setTimeout(r, 500))

    for (const keyword of keywords) {
      const kwResult = await logKeywordRanking(keyword, appId, platform)
      keywordResults.push({ keyword, appId, ...kwResult })
      await new Promise((r) => setTimeout(r, 1500))
    }
  }

  return { metrics, keywords: keywordResults, errors }
}
