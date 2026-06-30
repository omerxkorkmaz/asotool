import type { NextApiRequest, NextApiResponse } from 'next'
import { withApiHandler, sendJson } from '@/lib/api-handler'
import { runDraftCheck } from '@/lib/draft-check'
import { ValidationError } from '@/lib/errors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { draftTitle, draftDescription, scanResults, language = 'Türkçe' } = req.body
  if (!draftTitle && !draftDescription) {
    throw new ValidationError('draftTitle veya draftDescription zorunlu')
  }
  if (!scanResults?.length) {
    throw new ValidationError('scanResults zorunlu — önce Toplu Tarama çalıştırılmalı')
  }

  const result = await runDraftCheck({
    draftTitle: draftTitle || '',
    draftDescription: draftDescription || '',
    scanResults,
    language,
    apiKey: process.env.GEMINI_API_KEY,
  })

  sendJson(res, result)
}

export default withApiHandler(handler, { methods: ['POST'], routeName: 'check-draft' })
