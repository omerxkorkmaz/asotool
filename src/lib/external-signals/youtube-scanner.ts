import { google } from 'googleapis'
import type { YouTubePresence } from './types'

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY!,
})

export async function scanYouTubePresence(
  appName: string,
  maxResults: number = 25
): Promise<YouTubePresence | null> {
  try {
    if (!process.env.YOUTUBE_API_KEY) {
      console.warn('YOUTUBE_API_KEY not set, skipping YouTube scan')
      return null
    }

    const searchResponse = await youtube.search.list({
      part: ['snippet'],
      q: `"${appName}"`,
      type: ['video'],
      maxResults,
      order: 'relevance',
    })

    const videoIds =
      searchResponse.data.items?.map((i) => i.id?.videoId).filter(Boolean) || []

    if (videoIds.length === 0) {
      return { totalVideos: 0, totalViews: 0, recentVideos: [] }
    }

    const statsResponse = await youtube.videos.list({
      part: ['statistics', 'snippet'],
      id: videoIds as string[],
    })

    const videos = (statsResponse.data.items || []).map((v) => ({
      title: v.snippet?.title || '',
      url: `https://youtube.com/watch?v=${v.id}`,
      views: parseInt(v.statistics?.viewCount || '0', 10),
      publishedAt: v.snippet?.publishedAt || '',
      channelName: v.snippet?.channelTitle || '',
    }))

    return {
      totalVideos: videos.length,
      totalViews: videos.reduce((sum, v) => sum + v.views, 0),
      recentVideos: videos,
    }
  } catch (error) {
    console.error(`YouTube scan failed for "${appName}":`, error)
    return null
  }
}
