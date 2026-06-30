import type { ExternalSignals, WebMention, YouTubePresence, MetaAdInfo } from './types'
import { scanWebMentions } from './web-mentions'
import { scanYouTubePresence } from './youtube-scanner'
import { scanMetaAds } from './meta-ads'

function calculateSignalScore(
  webMentions: WebMention[],
  youtube: YouTubePresence | null,
  metaAds: MetaAdInfo | null
): number {
  let score = 0

  const highMentions = webMentions.filter((m) => m.relevance === 'high').length
  const mediumMentions = webMentions.filter((m) => m.relevance === 'medium').length
  score += Math.min(highMentions * 10 + mediumMentions * 5, 50)

  if (youtube) {
    if (youtube.totalViews > 100000) score += 35
    else if (youtube.totalViews > 50000) score += 25
    else if (youtube.totalViews > 10000) score += 15
    else if (youtube.totalVideos > 0) score += 5
  }

  if (metaAds) {
    if (metaAds.adsInLast30Days > 20) score += 15
    else if (metaAds.adsInLast30Days > 10) score += 10
    else if (metaAds.isRunningAds) score += 5
  }

  return Math.min(score, 100)
}

export async function scanExternalSignals(
  appName: string,
  developerName: string
): Promise<ExternalSignals> {
  const [webMentions, youtubePresence, metaAds] = await Promise.allSettled([
    scanWebMentions(appName, developerName),
    scanYouTubePresence(appName),
    scanMetaAds(developerName, appName),
  ])

  const mentions = webMentions.status === 'fulfilled' ? webMentions.value : []
  const youtube = youtubePresence.status === 'fulfilled' ? youtubePresence.value : null
  const ads = metaAds.status === 'fulfilled' ? metaAds.value : null

  return {
    appName,
    developerName,
    webMentions: mentions,
    youtubePresence: youtube,
    metaAds: ads,
    totalSignalScore: calculateSignalScore(mentions, youtube, ads),
    fetchedAt: new Date().toISOString(),
  }
}
