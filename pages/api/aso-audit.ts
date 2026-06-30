import type { NextApiRequest, NextApiResponse } from 'next'
import { withApiHandler, sendJson } from '@/lib/api-handler'
import { runFullAsoAudit } from '@/lib/aso-engine'
import { ValidationError } from '@/lib/errors'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const packageName = String(req.method === 'GET' ? req.query.packageName : req.body?.packageName || '').trim()
  const language = String(req.method === 'GET' ? req.query.language ?? 'tr' : req.body?.language ?? 'tr').trim()
  const keywords = req.body?.keywords as string[] | undefined

  if (!packageName) throw new ValidationError('packageName gerekli')

  const result = await runFullAsoAudit({ packageName, language, keywords })
  sendJson(res, result)
}

export default withApiHandler(handler, {
  methods: ['GET', 'POST'],
  routeName: 'aso-audit',
})
