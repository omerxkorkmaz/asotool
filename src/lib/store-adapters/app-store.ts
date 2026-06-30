import store from 'app-store-scraper'
import type { StoreAdapter, AppBasicInfo, SearchResult } from './types'

export const appStoreAdapter: StoreAdapter = {
  async getApp(appId: string): Promise<AppBasicInfo> {
    const result = await store.app({ id: appId })
    return {
      appId: result.id.toString(),
      title: result.title,
      summary: result.description?.substring(0, 80) || '',
      description: result.description || '',
      installs: 'N/A',
      score: result.score,
      ratings: result.reviews,
      reviews: result.reviews,
      updated: result.updated,
      version: result.version,
      priceText: result.price === 0 ? 'Free' : `$${result.price}`,
      developer: result.developer,
      genre: result.primaryGenreName,
      icon: result.icon,
      screenshots: result.screenshots || [],
    }
  },

  async search(term: string, num: number = 50): Promise<SearchResult[]> {
    const results = await store.search({ term, num })
    return results.map((r) => ({
      appId: r.id.toString(),
      title: r.title,
      developer: r.developer,
      icon: r.icon,
      score: r.score,
      installs: undefined,
    }))
  },
}
