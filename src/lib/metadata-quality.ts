/** Pure metadata quality analysis — safe for server + client imports */

import type { MetadataQualitySignals } from '@/types/aso'
import type { PlayAppDetail } from '@/types/scraper'

const STOPWORDS = new Set([
  've', 'ile', 'için', 'bir', 'bu', 'da', 'de', 'en', 'the', 'and', 'for', 'with', 'app',
  'free', 'pro', 'plus', 'lite', 'new', 'best', 'top', 'your', 'you', 'all', 'get',
])

function extractWords(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9ğüşıöçäöüßáéíóúñ\s-]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

export function analyzeMetadataQuality(
  app: Pick<PlayAppDetail, 'title' | 'summary' | 'description' | 'genre'>,
  targetKeywords: string[] = []
): MetadataQualitySignals {
  const title = app.title || ''
  const summary = app.summary || ''
  const description = app.description || ''
  const descLead = description.slice(0, 250).toLowerCase()
  const titleLower = title.toLowerCase()
  const summaryLower = summary.toLowerCase()

  const keywords = targetKeywords.length
    ? targetKeywords
    : [...new Set([...extractWords(title), ...extractWords(app.genre || '')])].slice(0, 8)

  const keywordsInTitle = keywords.filter((k) => titleLower.includes(k.toLowerCase()))
  const keywordsInSummary = keywords.filter((k) => summaryLower.includes(k.toLowerCase()))
  const keywordsInDescriptionLead = keywords.filter((k) => descLead.includes(k.toLowerCase()))
  const missingHighValueKeywords = keywords.filter(
    (k) =>
      !titleLower.includes(k.toLowerCase()) &&
      !summaryLower.includes(k.toLowerCase()) &&
      !descLead.includes(k.toLowerCase())
  )

  const allText = `${title} ${summary} ${description}`.toLowerCase()
  let stuffingCount = 0
  for (const k of keywords) {
    const re = new RegExp(k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    stuffingCount += (allText.match(re) || []).length
  }
  const keywordStuffingRisk: MetadataQualitySignals['keywordStuffingRisk'] =
    stuffingCount > keywords.length * 4 ? 'yüksek' : stuffingCount > keywords.length * 2 ? 'orta' : 'düşük'

  const firstParagraphWordCount = description.split(/\n\n|\n/)[0]?.split(/\s+/).filter(Boolean).length ?? 0
  const hasBulletStructure = /(^|\n)\s*[-•*✓✔]\s/m.test(description) || /(^|\n)\s*\d+[.)]\s/m.test(description)

  return {
    titleLength: title.length,
    summaryLength: summary.length,
    descriptionLength: description.length,
    titleWithinPlayLimit: title.length <= 30,
    summaryWithinPlayLimit: summary.length <= 80,
    descriptionWithinPlayLimit: description.length <= 4000,
    keywordsInTitle,
    keywordsInSummary,
    keywordsInDescriptionLead,
    missingHighValueKeywords,
    firstParagraphWordCount,
    hasBulletStructure,
    keywordStuffingRisk,
  }
}
