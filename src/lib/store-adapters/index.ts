import type { StoreAdapter } from './types'
import { googlePlayAdapter } from './google-play'
import { appStoreAdapter } from './app-store'

export type Platform = 'android' | 'ios'

export function getStoreAdapter(platform: Platform): StoreAdapter {
  switch (platform) {
    case 'android':
      return googlePlayAdapter
    case 'ios':
      return appStoreAdapter
    default:
      throw new Error(`Unknown platform: ${platform}`)
  }
}

export type { StoreAdapter, AppBasicInfo, SearchResult } from './types'
