export interface WebMention {
  source: string
  title: string
  url: string
  type: 'review' | 'news' | 'list' | 'tutorial' | 'forum' | 'other'
  relevance: 'high' | 'medium' | 'low'
  date?: string
  snippet: string
}

export interface YouTubePresence {
  totalVideos: number
  totalViews: number
  recentVideos: {
    title: string
    url: string
    views: number
    publishedAt: string
    channelName: string
  }[]
}

export interface MetaAdInfo {
  isRunningAds: boolean
  activeAdsCount: number
  adsInLast30Days: number
  sampleAds: {
    adId: string
    pageName: string
    adStatus: string
    platforms: string[]
    firstSeen?: string
    lastSeen?: string
  }[]
}

export interface ExternalSignals {
  appName: string
  developerName: string
  webMentions: WebMention[]
  youtubePresence: YouTubePresence | null
  metaAds: MetaAdInfo | null
  totalSignalScore: number
  fetchedAt: string
}
