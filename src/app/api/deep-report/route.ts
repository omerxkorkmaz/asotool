import { NextRequest, NextResponse } from 'next/server'
import type { CompetitorReportRequest, DeepReport } from '@/lib/deep-report/types'
import { gatherAllData } from '@/lib/deep-report/gatherer'
import { generateReport } from '@/lib/deep-report/generator'
import { getCacheKey, getCachedReport, cacheReport } from '@/lib/deep-report/cache'
import { prepareDeepReportRequest } from '@/lib/deep-report/prepare'

export const maxDuration = 120

type DeepReportBody =
  | CompetitorReportRequest
  | {
      app: string
      competitors?: CompetitorReportRequest['competitors']
      targetKeywords?: string[]
    }

function isShorthandBody(body: DeepReportBody): body is { app: string; competitors?: CompetitorReportRequest['competitors']; targetKeywords?: string[] } {
  return 'app' in body && typeof body.app === 'string'
}

export async function POST(request: NextRequest) {
  try {
    const body: DeepReportBody = await request.json()
    let preparedMeta: Awaited<ReturnType<typeof prepareDeepReportRequest>>['meta'] | undefined

    let reportRequest: CompetitorReportRequest

    if (isShorthandBody(body)) {
      const prepared = await prepareDeepReportRequest(body.app, {
        competitors: body.competitors,
        targetKeywords: body.targetKeywords,
      })
      reportRequest = prepared.request
      preparedMeta = prepared.meta
    } else {
      reportRequest = body
    }

    if (!reportRequest.myApp?.appId || !reportRequest.myApp?.platform) {
      return NextResponse.json(
        { error: 'Missing myApp.appId or myApp.platform' },
        { status: 400 }
      )
    }
    if (!reportRequest.competitors?.length || reportRequest.competitors.length > 3) {
      return NextResponse.json(
        { error: 'Provide 1-3 competitors' },
        { status: 400 }
      )
    }
    if (!reportRequest.targetKeywords?.length) {
      return NextResponse.json(
        { error: 'Provide at least 1 target keyword' },
        { status: 400 }
      )
    }

    const competitorIds = reportRequest.competitors.map((c) => c.appId)
    const cacheKey = getCacheKey(reportRequest.myApp.appId, competitorIds)
    const cached = await getCachedReport(cacheKey)
    if (cached) {
      return NextResponse.json({ ...cached, cached: true, prepared: preparedMeta })
    }

    console.log('Gathering data for deep report...')
    const snapshots = await gatherAllData(reportRequest)

    console.log('Generating report with Gemini...')
    const analysis = await generateReport(snapshots)

    const report: DeepReport = {
      generatedAt: new Date().toISOString(),
      apps: snapshots,
      analysis,
    }

    await cacheReport(cacheKey, report)

    return NextResponse.json({ ...report, cached: false, prepared: preparedMeta })
  } catch (error) {
    console.error('Deep report generation failed:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: message || 'Report generation failed', details: String(error) },
      { status: 500 }
    )
  }
}
