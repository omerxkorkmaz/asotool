import { cachedApp } from '@/lib/gplay'
import { fetchEnrichedApp, fetchGenrePeers } from '@/lib/data-layer'
import { computeHealthScore } from '@/lib/health-score'
import { CACHE_KEYS } from '@/lib/cache-keys'
import { getRedis } from '@/lib/redis'
import type {
  AnalysisSnapshot,
  AppListItem,
  AppProfile,
  DashboardData,
  OpportunityTrendPoint,
} from '@/types/app'
import type { BulkScanResult } from '@/types/gemini'

const MAX_APP_HISTORY = 30

interface BulkScanHistoryEntry {
  savedAt: string
  result: BulkScanResult
}

function normalizePackageName(pkg: string): string {
  return pkg.trim().toLowerCase()
}

async function loadBulkScanResults(packageName: string): Promise<BulkScanResult[]> {
  const redis = getRedis()
  if (!redis) return []
  const raw = (await redis.get<BulkScanHistoryEntry[]>(CACHE_KEYS.bulkScanHistory(packageName))) || []
  return raw.map((e) => e.result).filter(Boolean)
}

async function fetchGenreSearch(app: { genre?: string; title?: string; appId?: string }, country: string, lang: string) {
  const { results } = await fetchGenrePeers(app, country, lang)
  return results
}

function buildProfileFromApp(
  packageName: string,
  app: Awaited<ReturnType<typeof cachedApp>>,
  breakdown: ReturnType<typeof computeHealthScore>,
  country: string,
  lang: string,
  addedAt?: string
): AppProfile {
  const now = new Date().toISOString()
  return {
    packageName,
    title: app.title,
    icon: app.icon,
    developer: app.developer,
    genre: app.genre,
    score: app.score,
    ratings: app.ratings,
    installs: app.installs,
    version: app.version,
    updated: app.updated,
    healthScore: breakdown.total,
    healthBreakdown: breakdown,
    lastScannedAt: now,
    addedAt: addedAt ?? now,
    country,
    lang,
  }
}

function snapshotFromRefresh(profile: AppProfile, bulkScan?: BulkScanResult): AnalysisSnapshot {
  const opportunityAvg = bulkScan?.keywords?.length
    ? Math.round(
        bulkScan.keywords.reduce((s, k) => s + k.opportunityScore, 0) / bulkScan.keywords.length
      )
    : undefined

  return {
    id: `health-${Date.now()}`,
    type: bulkScan ? 'bulk-scan' : 'health-refresh',
    analyzedAt: profile.lastScannedAt,
    healthScore: profile.healthScore,
    opportunityAvg,
    keywordCount: bulkScan?.keywords?.length,
    summary: bulkScan?.strategySummary?.slice(0, 200) ?? `Health score güncellendi: ${profile.healthScore}/100`,
  }
}

function buildOpportunityTrend(
  appHistory: AnalysisSnapshot[],
  bulkResults: BulkScanResult[]
): OpportunityTrendPoint[] {
  const points: OpportunityTrendPoint[] = []

  for (const snap of [...appHistory].reverse()) {
    if (snap.opportunityAvg != null) {
      points.push({
        date: snap.analyzedAt,
        score: snap.opportunityAvg,
        label: 'Fırsat',
      })
    }
  }

  for (const scan of bulkResults.slice(0, 5).reverse()) {
    if (!scan.keywords?.length) continue
    const avg = Math.round(
      scan.keywords.reduce((s, k) => s + k.opportunityScore, 0) / scan.keywords.length
    )
    const exists = points.some((p) => p.date === scan.analyzedAt)
    if (!exists) {
      points.push({ date: scan.analyzedAt, score: avg, label: 'Bulk Scan' })
    }
  }

  return points
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-12)
}

export async function addApp(
  packageName: string,
  country = 'tr',
  lang = 'tr'
): Promise<AppProfile> {
  const pkg = normalizePackageName(packageName)
  const redis = getRedis()

  const app = await cachedApp({ appId: pkg, country, lang })
  const enriched = await fetchEnrichedApp(pkg, { country, lang, languageLabel: country })
  const bulkScans = await loadBulkScanResults(pkg)
  const genreResults = await fetchGenreSearch(app, country, lang)
  const { keywords: targetKeywords } = await getLatestBulkScanKeywords(pkg)
  const breakdown = computeHealthScore({
    app,
    bulkScanResults: bulkScans,
    genreSearchResults: genreResults,
    genreSearchRank: enriched.genreSearchRank,
    metadataQuality: enriched.metadataQuality,
    targetKeywords,
  })

  const existingMeta = redis ? await redis.get<AppProfile>(CACHE_KEYS.appMeta(pkg)) : null
  const profile = buildProfileFromApp(pkg, app, breakdown, country, lang, existingMeta?.addedAt)

  if (redis) {
    const list = (await redis.get<string[]>(CACHE_KEYS.appsList())) || []
    if (!list.includes(pkg)) {
      await redis.set(CACHE_KEYS.appsList(), [...list, pkg])
    }
    await redis.set(CACHE_KEYS.appMeta(pkg), profile)

    const history = (await redis.get<AnalysisSnapshot[]>(CACHE_KEYS.appHistory(pkg))) || []
    const snap = snapshotFromRefresh(profile, bulkScans[0])
    await redis.set(CACHE_KEYS.appHistory(pkg), [snap, ...history].slice(0, MAX_APP_HISTORY))
  }

  return profile
}

export async function getApps(): Promise<{ apps: AppListItem[]; redisAvailable: boolean }> {
  const redis = getRedis()
  if (!redis) return { apps: [], redisAvailable: false }

  const list = (await redis.get<string[]>(CACHE_KEYS.appsList())) || []
  const apps: AppListItem[] = []

  for (const pkg of list) {
    const meta = await redis.get<AppProfile>(CACHE_KEYS.appMeta(pkg))
    if (meta) {
      apps.push({
        packageName: meta.packageName,
        title: meta.title,
        icon: meta.icon,
        healthScore: meta.healthScore,
        lastScannedAt: meta.lastScannedAt,
      })
    }
  }

  apps.sort((a, b) => b.healthScore - a.healthScore)
  return { apps, redisAvailable: true }
}

export async function getAppDetails(packageName: string): Promise<DashboardData | null> {
  const pkg = normalizePackageName(packageName)
  const redis = getRedis()
  if (!redis) return null

  const profile = await redis.get<AppProfile>(CACHE_KEYS.appMeta(pkg))
  if (!profile) return null

  const appHistory = (await redis.get<AnalysisSnapshot[]>(CACHE_KEYS.appHistory(pkg))) || []
  const bulkResults = await loadBulkScanResults(pkg)

  return {
    profile,
    recentAnalyses: appHistory.slice(0, 3),
    opportunityTrend: buildOpportunityTrend(appHistory, bulkResults),
  }
}

export async function updateHealthScore(
  packageName: string,
  country?: string,
  lang?: string
): Promise<AppProfile> {
  const pkg = normalizePackageName(packageName)
  const redis = getRedis()
  const existing = redis ? await redis.get<AppProfile>(CACHE_KEYS.appMeta(pkg)) : null

  const c = country ?? existing?.country ?? 'tr'
  const l = lang ?? existing?.lang ?? 'tr'

  return addApp(pkg, c, l)
}

export async function removeApp(packageName: string): Promise<boolean> {
  const pkg = normalizePackageName(packageName)
  const redis = getRedis()
  if (!redis) return false

  const list = (await redis.get<string[]>(CACHE_KEYS.appsList())) || []
  await redis.set(
    CACHE_KEYS.appsList(),
    list.filter((p) => p !== pkg)
  )
  await redis.del(CACHE_KEYS.appMeta(pkg))
  return true
}

/** Son bulk scan sonucundan yüksek fırsatlı keyword'leri döndür */
export async function getLatestBulkScanKeywords(
  packageName: string,
  limit = 12
): Promise<{ keywords: string[]; hasBulkScan: boolean }> {
  const results = await loadBulkScanResults(normalizePackageName(packageName))
  const latest = results[0]
  if (!latest?.keywords?.length) {
    return { keywords: [], hasBulkScan: false }
  }
  const keywords = [...latest.keywords]
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, limit)
    .map((k) => k.keyword)
  return { keywords, hasBulkScan: true }
}
export {
  LOCAL_STORAGE_APPS_KEY,
  LOCAL_STORAGE_PROFILE_PREFIX,
} from '@/lib/dashboard-storage'
