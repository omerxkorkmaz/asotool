export interface AppBasicInfo {
  appId: string
  title: string
  summary: string
  description: string
  installs: string
  installsMin?: number
  installsMax?: number
  score: number
  ratings: number
  reviews: number
  updated: string
  version: string
  priceText: string
  developer: string
  genre: string
  icon: string
  screenshots: string[]
}

export interface SearchResult {
  appId: string
  title: string
  developer: string
  icon: string
  score: number
  installs?: string
}

export interface StoreAdapter {
  /** Get detailed app info */
  getApp(appId: string): Promise<AppBasicInfo>
  /** Search store and return results */
  search(term: string, num: number): Promise<SearchResult[]>
}
