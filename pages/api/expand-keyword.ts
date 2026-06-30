import type { NextApiRequest, NextApiResponse } from 'next'
import { withApiHandler, sendJson } from '@/lib/api-handler'
import { cachedSearch, cachedSuggest, extractWords } from '@/lib/gplay'
import { ValidationError } from '@/lib/errors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { seed, country = 'tr', lang = 'tr' } = req.body
  if (!seed) throw new ValidationError('seed (kök kelime) zorunlu')

  const suggestSeeds = [seed, `${seed} `, `${seed}a`, `${seed}e`, `${seed} i`]
  const suggestResults = await Promise.all(
    suggestSeeds.map((s) => cachedSuggest(s, country, lang).catch(() => [] as string[]))
  )

  const autocompleteSet = new Set<string>()
  suggestResults.flat().forEach((s) => autocompleteSet.add(s.toLowerCase().trim()))
  autocompleteSet.delete(seed.toLowerCase().trim())

  const searchResults = await cachedSearch({ term: seed, country, lang, num: 25 })

  const wordFreq: Record<string, number> = {}
  searchResults.forEach((app) => {
    const words = [...extractWords(app.title), ...extractWords((app as { summary?: string }).summary || '')]
    const uniqueWords = new Set(words)
    uniqueWords.forEach((w) => {
      if (w === seed.toLowerCase()) return
      wordFreq[w] = (wordFreq[w] || 0) + 1
    })
  })

  const competitorWords = Object.entries(wordFreq)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({
      word,
      appearsIn: count,
      totalScanned: searchResults.length,
      suggestedKeyword: `${seed} ${word}`,
    }))

  const combined = [
    ...Array.from(autocompleteSet).map((k) => ({ keyword: k, source: 'autocomplete' as const })),
    ...competitorWords.map((w) => ({
      keyword: w.suggestedKeyword,
      source: 'rakip_kelime' as const,
      appearsIn: w.appearsIn,
    })),
  ]

  const seen = new Set<string>()
  const uniqueCombined = combined.filter((c) => {
    const key = c.keyword.toLowerCase().trim()
    if (seen.has(key) || key === seed.toLowerCase()) return false
    seen.add(key)
    return true
  })

  sendJson(res, {
    seed,
    country,
    lang,
    autocomplete: Array.from(autocompleteSet),
    competitorWords,
    suggestions: uniqueCombined,
    scannedCompetitors: searchResults.length,
  })
}

export default withApiHandler(handler, { methods: ['POST'], routeName: 'expand-keyword' })
