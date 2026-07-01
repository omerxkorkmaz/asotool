import { getStoreAdapter, type Platform } from '@/lib/store-adapters'
import { getLatestBulkScanKeywords } from '@/lib/app-manager'
import type { CompetitorReportRequest } from './types'

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9ğüşıöç\s-]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
}

export function parseAppEntry(input: string): { platform: Platform; appId: string } {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('Uygulama kimliği boş olamaz')
  }

  if (trimmed.includes(':')) {
    const colon = trimmed.indexOf(':')
    const platform = trimmed.slice(0, colon).trim().toLowerCase() as Platform
    const appId = trimmed.slice(colon + 1).trim()

    if (platform !== 'android' && platform !== 'ios') {
      throw new Error('Platform android veya ios olmalı (ör. android:com.sirket.uygulama)')
    }
    if (!appId) {
      throw new Error('App ID eksik (ör. android:com.sirket.uygulama)')
    }

    return { platform, appId: platform === 'android' ? appId.toLowerCase() : appId }
  }

  return { platform: 'android', appId: trimmed.toLowerCase() }
}

export interface PrepareDeepReportOptions {
  competitors?: { appId: string; platform: Platform }[]
  targetKeywords?: string[]
}

export interface PreparedDeepReport {
  request: CompetitorReportRequest
  meta: {
    appEntry: string
    title: string
    competitors: { appId: string; platform: Platform; title: string }[]
    keywords: string[]
    autoDiscoveredCompetitors: boolean
    autoDiscoveredKeywords: boolean
  }
}

async function discoverCompetitors(
  platform: Platform,
  appId: string,
  genre: string | undefined,
  title: string
): Promise<{ appId: string; platform: Platform; title: string }[]> {
  const adapter = getStoreAdapter(platform)
  const term = genre || title
  if (!term) return []

  const results = await adapter.search(term, 30)
  return results
    .filter((r) => r.appId !== appId)
    .slice(0, 3)
    .map((r) => ({ appId: r.appId, platform, title: r.title }))
}

async function discoverKeywords(
  platform: Platform,
  appId: string,
  title: string,
  genre?: string
): Promise<string[]> {
  if (platform === 'android') {
    const bulk = await getLatestBulkScanKeywords(appId, 8)
    if (bulk.keywords.length) return bulk.keywords.slice(0, 6)
  }

  const fromMeta = tokenize(`${genre || ''} ${title}`).slice(0, 4)
  if (fromMeta.length >= 2) return fromMeta

  const words = tokenize(title)
  return words.length ? words.slice(0, 3) : [title.split(' ')[0]?.toLowerCase()].filter(Boolean)
}

export async function prepareDeepReportRequest(
  appEntry: string,
  options: PrepareDeepReportOptions = {}
): Promise<PreparedDeepReport> {
  const { platform, appId } = parseAppEntry(appEntry)
  const adapter = getStoreAdapter(platform)
  const appInfo = await adapter.getApp(appId)

  let competitors = options.competitors?.filter((c) => c.appId && c.appId !== appId) ?? []
  let autoDiscoveredCompetitors = false

  if (competitors.length === 0) {
    const discovered = await discoverCompetitors(platform, appId, appInfo.genre, appInfo.title)
    competitors = discovered
    autoDiscoveredCompetitors = true
  }

  if (competitors.length === 0) {
    throw new Error(
      'Rakip bulunamadı. Genre araması sonuç vermedi — rakipleri manuel girin veya farklı bir uygulama deneyin.'
    )
  }

  let keywords = options.targetKeywords?.map((k) => k.trim()).filter(Boolean) ?? []
  let autoDiscoveredKeywords = false

  if (keywords.length === 0) {
    keywords = await discoverKeywords(platform, appId, appInfo.title, appInfo.genre)
    autoDiscoveredKeywords = true
  }

  keywords = [...new Set(keywords)].slice(0, 8)
  if (keywords.length === 0) {
    throw new Error('En az bir hedef keyword gerekli')
  }

  const competitorDetails = await Promise.all(
    competitors.slice(0, 3).map(async (c) => {
      try {
        const info = await getStoreAdapter(c.platform).getApp(c.appId)
        return { appId: c.appId, platform: c.platform, title: info.title }
      } catch {
        return { appId: c.appId, platform: c.platform, title: c.appId }
      }
    })
  )

  return {
    request: {
      myApp: { appId, platform },
      competitors: competitors.slice(0, 3).map((c) => ({ appId: c.appId, platform: c.platform })),
      targetKeywords: keywords,
    },
    meta: {
      appEntry: appEntry.trim(),
      title: appInfo.title,
      competitors: competitorDetails,
      keywords,
      autoDiscoveredCompetitors,
      autoDiscoveredKeywords,
    },
  }
}
