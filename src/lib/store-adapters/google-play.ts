import gplay from 'google-play-scraper'
import type { StoreAdapter, AppBasicInfo, SearchResult } from './types'

export const googlePlayAdapter: StoreAdapter = {
  async getApp(appId: string): Promise<AppBasicInfo> {
    const result = await gplay.app({ appId })
    return {
      appId: result.appId,
      title: result.title,
      summary: result.summary,
      description: result.description,
      installs: result.installs,
      installsMin: result.minInstalls,
      installsMax: result.maxInstalls,
      score: result.score,
      ratings: result.ratings,
      reviews: result.reviews,
      updated:
        typeof result.updated === 'number'
          ? new Date(result.updated).toISOString()
          : String(result.updated ?? ''),
      version: result.version,
      priceText: result.priceText || 'Free',
      developer: result.developer,
      genre: result.genre,
      icon: result.icon,
      screenshots: result.screenshots || [],
    }
  },

  async search(term: string, num: number = 50): Promise<SearchResult[]> {
    const results = await gplay.search({ term, num })
    return results.map((r) => ({
      appId: r.appId,
      title: r.title,
      developer: r.developer,
      icon: r.icon,
      score: r.score,
      installs: 'installs' in r ? (r as { installs?: string }).installs : undefined,
    }))
  },
}
