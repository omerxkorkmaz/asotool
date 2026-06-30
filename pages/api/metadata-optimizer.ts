import type { NextApiRequest, NextApiResponse } from 'next'
import { withApiHandler, sendJson } from '@/lib/api-handler'
import { fetchMetadataContext, runMetadataOptimizer } from '@/lib/metadata-optimizer'
import { ValidationError } from '@/lib/errors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const packageName = String(req.query.packageName || '').trim()
    const language = String(req.query.language || 'tr').trim()

    if (!packageName) throw new ValidationError('packageName gerekli')

    const context = await fetchMetadataContext(packageName, language)
    sendJson(res, context)
    return
  }

  const { packageName, language = 'tr', useBulkScan = true, keywords } = req.body ?? {}

  if (!packageName || !String(packageName).trim()) {
    throw new ValidationError('packageName gerekli')
  }

  const result = await runMetadataOptimizer({
    packageName: String(packageName).trim(),
    language: String(language).trim(),
    useBulkScan: useBulkScan !== false,
    keywords: Array.isArray(keywords) ? keywords.map(String) : undefined,
  })

  sendJson(res, result)
}

export default withApiHandler(handler, {
  methods: ['GET', 'POST'],
  routeName: 'metadata-optimizer',
})
