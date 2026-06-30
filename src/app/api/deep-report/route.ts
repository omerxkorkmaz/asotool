import { NextRequest, NextResponse } from 'next/server'
import type { CompetitorReportRequest, DeepReport } from '@/lib/deep-report/types'
import { gatherAllData } from '@/lib/deep-report/gatherer'
import { generateReport } from '@/lib/deep-report/generator'
import { getCacheKey, getCachedReport, cacheReport } from '@/lib/deep-report/cache'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const body: CompetitorReportRequest = await request.json()

    if (!body.myApp?.appId || !body.myApp?.platform) {
      return NextResponse.json(
        { error: 'Missing myApp.appId or myApp.platform' },
        { status: 400 }
      )
    }
    if (!body.competitors?.length || body.competitors.length > 3) {
      return NextResponse.json(
        { error: 'Provide 1-3 competitors' },
        { status: 400 }
      )
    }
    if (!body.targetKeywords?.length) {
      return NextResponse.json(
        { error: 'Provide at least 1 target keyword' },
        { status: 400 }
      )
    }

    const competitorIds = body.competitors.map((c) => c.appId)
    const cacheKey = getCacheKey(body.myApp.appId, competitorIds)
    const cached = await getCachedReport(cacheKey)
    if (cached) {
      return NextResponse.json({ ...cached, cached: true })
    }

    console.log('Gathering data for deep report...')
    const snapshots = await gatherAllData(body)

    console.log('Generating report with Gemini...')
    const analysis = await generateReport(snapshots)

    const report: DeepReport = {
      generatedAt: new Date().toISOString(),
      apps: snapshots,
      analysis,
    }

    await cacheReport(cacheKey, report)

    return NextResponse.json(report)
  } catch (error) {
    console.error('Deep report generation failed:', error)
    return NextResponse.json(
      { error: 'Report generation failed', details: String(error) },
      { status: 500 }
    )
  }
}
