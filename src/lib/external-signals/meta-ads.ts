import type { MetaAdInfo } from './types'

const META_AD_LIBRARY_URL = 'https://graph.facebook.com/v18.0/ads_archive'

interface MetaAdRecord {
  id: string
  page_name?: string
  ad_delivery_start_time?: string
  ad_delivery_stop_time?: string
  publisher_platforms?: string[]
}

export async function scanMetaAds(
  developerName: string,
  appName: string
): Promise<MetaAdInfo | null> {
  try {
    const token = process.env.META_ACCESS_TOKEN
    if (!token) {
      console.log('META_ACCESS_TOKEN not set, skipping Meta ads scan (optional)')
      return null
    }

    const searchTerms = [developerName, appName]
    let allAds: MetaAdRecord[] = []

    for (const term of searchTerms) {
      const params = new URLSearchParams({
        search_terms: term,
        ad_type: 'ALL',
        ad_reached_countries: 'US,TR,GB,DE',
        search_page_ids: '',
        fields:
          'id,ad_creative_bodies,page_name,ad_delivery_start_time,ad_delivery_stop_time,publisher_platforms',
        access_token: token,
        limit: '10',
      })

      try {
        const response = await fetch(`${META_AD_LIBRARY_URL}?${params}`)

        if (!response.ok) {
          console.warn(`Meta API error for "${term}": ${response.status}`)
          continue
        }

        const data = (await response.json()) as { data?: MetaAdRecord[] }
        if (data.data) {
          allAds = [...allAds, ...data.data]
        }
      } catch (fetchError) {
        console.warn(`Meta API fetch failed for "${term}":`, fetchError)
        continue
      }
    }

    const uniqueAds = Array.from(new Map(allAds.map((ad) => [ad.id, ad])).values())

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const recentAds = uniqueAds.filter((ad) => {
      if (!ad.ad_delivery_start_time) return false
      return new Date(ad.ad_delivery_start_time) >= thirtyDaysAgo
    })

    const activeAds = uniqueAds.filter((ad) => !ad.ad_delivery_stop_time)

    return {
      isRunningAds: activeAds.length > 0,
      activeAdsCount: activeAds.length,
      adsInLast30Days: recentAds.length,
      sampleAds: uniqueAds.slice(0, 5).map((ad) => ({
        adId: ad.id,
        pageName: ad.page_name || 'Unknown',
        adStatus: ad.ad_delivery_stop_time ? 'INACTIVE' : 'ACTIVE',
        platforms: ad.publisher_platforms || [],
        firstSeen: ad.ad_delivery_start_time,
        lastSeen: ad.ad_delivery_stop_time,
      })),
    }
  } catch (error) {
    console.error(`Meta ads scan failed for "${appName}":`, error)
    return null
  }
}
