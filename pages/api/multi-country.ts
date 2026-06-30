import type { NextApiRequest, NextApiResponse } from 'next'
import { withApiHandler, sendJson } from '@/lib/api-handler'
import { cachedSearch, findMyRank, runInBatches } from '@/lib/gplay'
import { COUNTRY_PRESETS } from '@/lib/languages'
import { ValidationError } from '@/lib/errors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { keyword, appId, countries } = req.body
  if (!keyword) throw new ValidationError('keyword zorunlu')

  const targets = countries?.length
    ? COUNTRY_PRESETS.filter((c) => countries.includes(c.gl))
    : COUNTRY_PRESETS

  const allResults = await runInBatches(targets, 5, async (c) => {
    try {
      const results = await cachedSearch({
        term: keyword,
        country: c.gl,
        lang: c.hl ?? 'en',
        num: 50,
      })

      const myRank = findMyRank(results, appId)
      const top5 = results.slice(0, 5).map((a, idx) => ({
        rank: idx + 1,
        title: a.title,
        appId: a.appId,
        score: a.score,
        installs: a.installs,
      }))

      return {
        country: c.label,
        gl: c.gl,
        hl: c.hl,
        myRank,
        totalResults: results.length,
        top5,
        error: null,
      }
    } catch (err) {
      return {
        country: c.label,
        gl: c.gl,
        hl: c.hl,
        myRank: null,
        totalResults: 0,
        top5: [],
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  sendJson(res, {
    keyword,
    appId: appId || null,
    scannedCountries: allResults.length,
    results: allResults,
  })
}

export default withApiHandler(handler, { methods: ['POST'], routeName: 'multi-country' })
