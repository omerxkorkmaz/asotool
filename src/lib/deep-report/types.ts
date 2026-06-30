export interface CompetitorReportRequest {
  myApp: {
    appId: string
    platform: 'android' | 'ios'
  }
  competitors: {
    appId: string
    platform: 'android' | 'ios'
  }[]
  targetKeywords: string[]
}

export interface AppSnapshot {
  appId: string
  platform: string
  title: string
  developer: string
  current: {
    rating: number
    reviewCount: number
    installsRange: string
    version: string
    lastUpdated: string
    price: string
    category: string
  }
  trends: {
    ratingChange: number
    reviewVelocity: number
    installGrowth: string
  }
  keywordRankings: {
    keyword: string
    myRank: number | null
    competitorRanks: { appId: string; rank: number | null }[]
  }[]
  externalSignals: {
    totalSignalScore: number
    webMentionCount: number
    youtubeVideos: number
    youtubeViews: number
    isRunningAds: boolean
  }
}

export interface DeepReport {
  generatedAt: string
  apps: AppSnapshot[]
  analysis: {
    executiveSummary: string
    competitors: {
      appId: string
      title: string
      strengths: string[]
      weaknesses: string[]
      whyTheyRankHigher: string
    }[]
    opportunities: string[]
    keywordGapAnalysis: {
      missingKeywords: string[]
      lowCompetitionKeywords: string[]
    }
    actionPlan: {
      immediate: string[]
      shortTerm: string[]
    }
    externalSignalInsights: string
  }
}
