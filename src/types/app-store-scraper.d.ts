declare module 'app-store-scraper' {
  interface AppStoreApp {
    id: number
    title: string
    description?: string
    score: number
    reviews: number
    updated: string
    version: string
    price: number
    developer: string
    primaryGenreName: string
    icon: string
    screenshots?: string[]
  }

  interface AppStoreSearchResult {
    id: number
    title: string
    developer: string
    icon: string
    score: number
  }

  interface AppStoreScraper {
    app(options: { id: string | number }): Promise<AppStoreApp>
    search(options: { term: string; num?: number }): Promise<AppStoreSearchResult[]>
  }

  const store: AppStoreScraper
  export default store
}
