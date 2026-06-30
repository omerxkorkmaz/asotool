import { supabase } from '@/lib/db/supabase'
import { getStoreAdapter, type Platform } from '@/lib/store-adapters'
import { scanExternalSignals } from '@/lib/external-signals'
import type { AppSnapshot, CompetitorReportRequest } from './types'

interface DailyMetricRow {
  rating?: number | null
  review_count?: number | null
  installs_min?: number | null
  installs_max?: number | null
}

interface KeywordRankRow {
  rank?: number | null
}

async function gatherAppSnapshot(
  appId: string,
  platform: Platform,
  targetKeywords: string[]
): Promise<AppSnapshot> {
  const adapter = getStoreAdapter(platform)

  const appInfo = await adapter.getApp(appId)

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0]

  const { data: metricsHistory } = await supabase
    .from('apps_daily_metrics')
    .select('*')
    .eq('app_id', appId)
    .eq('platform', platform)
    .gte('date', dateStr)
    .order('date', { ascending: false })

  const history = (metricsHistory || []) as DailyMetricRow[]
  const latest = history[0]
  const oldest = history[history.length - 1]

  const ratingChange =
    latest?.rating != null && oldest?.rating != null ? latest.rating - oldest.rating : 0
  const reviewVelocity =
    history.reduce((sum, m) => sum + (m.review_count || 0), 0) || 0

  let installGrowth = 'stable'
  if (latest && oldest) {
    const latestMin = latest.installs_min ?? 0
    const latestMax = latest.installs_max ?? 0
    const oldestMin = oldest.installs_min ?? 0
    const oldestMax = oldest.installs_max ?? 0
    if (latestMin > oldestMax) installGrowth = 'growing'
    else if (latestMax < oldestMin) installGrowth = 'declining'
  }

  const keywordRankings: AppSnapshot['keywordRankings'] = []
  for (const keyword of targetKeywords) {
    const { data: rankData } = await supabase
      .from('keyword_rankings_history')
      .select('*')
      .eq('keyword', keyword)
      .eq('app_id', appId)
      .eq('platform', platform)
      .order('date', { ascending: false })
      .limit(1)

    const rows = (rankData || []) as KeywordRankRow[]
    keywordRankings.push({
      keyword,
      myRank: rows[0]?.rank ?? null,
      competitorRanks: [],
    })
  }

  const signals = await scanExternalSignals(appInfo.title, appInfo.developer)

  return {
    appId,
    platform,
    title: appInfo.title,
    developer: appInfo.developer,
    current: {
      rating: appInfo.score,
      reviewCount: appInfo.reviews,
      installsRange: appInfo.installs,
      version: appInfo.version,
      lastUpdated: appInfo.updated,
      price: appInfo.priceText,
      category: appInfo.genre,
    },
    trends: {
      ratingChange,
      reviewVelocity,
      installGrowth,
    },
    keywordRankings,
    externalSignals: {
      totalSignalScore: signals.totalSignalScore,
      webMentionCount: signals.webMentions.length,
      youtubeVideos: signals.youtubePresence?.totalVideos || 0,
      youtubeViews: signals.youtubePresence?.totalViews || 0,
      isRunningAds: signals.metaAds?.isRunningAds || false,
    },
  }
}

export async function gatherAllData(
  request: CompetitorReportRequest
): Promise<AppSnapshot[]> {
  const allApps = [request.myApp, ...request.competitors]
  const snapshots: AppSnapshot[] = []

  for (const app of allApps) {
    const snapshot = await gatherAppSnapshot(app.appId, app.platform, request.targetKeywords)
    snapshots.push(snapshot)
    await new Promise((r) => setTimeout(r, 1000))
  }

  for (const snapshot of snapshots) {
    for (const kw of snapshot.keywordRankings) {
      kw.competitorRanks = snapshots
        .filter((s) => s.appId !== snapshot.appId)
        .map((s) => ({
          appId: s.appId,
          rank: s.keywordRankings.find((k) => k.keyword === kw.keyword)?.myRank ?? null,
        }))
    }
  }

  return snapshots
}
