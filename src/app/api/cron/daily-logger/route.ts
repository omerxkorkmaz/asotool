import { NextRequest, NextResponse } from 'next/server'
import { ensureTablesExist } from '@/lib/db/migrations'
import { logAllTrackedApps } from '@/lib/db/metrics-logger'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`

  if (!expectedToken || authHeader !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await ensureTablesExist()
    const results = await logAllTrackedApps()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        metricsLogged: results.metrics.filter((m) => m.success).length,
        keywordsLogged: results.keywords.filter((k) => k.success).length,
        errors: results.errors,
      },
    })
  } catch (error) {
    console.error('Daily logger cron failed:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
