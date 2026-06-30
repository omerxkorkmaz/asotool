import type { NextApiRequest, NextApiResponse } from 'next'
import { withApiHandler, sendJson } from '@/lib/api-handler'
import { runBulkScan } from '@/lib/bulk-analyze'
import { BULK_SCAN_LANGUAGES, getLanguageByGl } from '@/lib/languages'
import { ValidationError } from '@/lib/errors'

function parseList(raw: string | string[] | undefined): string[] {
  if (!raw) return []
  const text = Array.isArray(raw) ? raw.join(',') : raw
  return [...new Set(text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean))]
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const {
    packageName,
    packageNames,
    keywords: keywordsRaw,
    language = 'tr',
  } = req.body

  const packages = parseList(packageNames ?? packageName)
  const keywords = parseList(keywordsRaw)

  if (!packages.length) throw new ValidationError('En az bir package name gerekli')
  if (!keywords.length) throw new ValidationError('En az bir kök kelime gerekli')
  if (keywords.length > 15) throw new ValidationError('En fazla 15 kelime analiz edilebilir')

  const langConfig =
    BULK_SCAN_LANGUAGES.find((l) => l.gl === language) ?? getLanguageByGl(String(language))

  const result = await runBulkScan({
    packageNames: packages,
    keywords,
    language: langConfig,
  })

  sendJson(res, result)
}

export default withApiHandler(handler, { methods: ['POST'], routeName: 'bulk-scan' })
