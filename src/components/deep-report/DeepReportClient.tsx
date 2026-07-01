'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/layout/Layout'
import AnalysisLoadingPanel from '@/components/aso/AnalysisLoadingPanel'
import AnalysisMetaBar from '@/components/aso/AnalysisMetaBar'
import ApiErrorBanner from '@/components/aso/ApiErrorBanner'
import { Spinner } from '@/components/ui/Spinner'
import { parseApiError, networkErrorMessage } from '@/lib/client-errors'
import type { DeepReport } from '@/lib/deep-report/types'

const LOADING_STEPS = [
  'Uygulama ve rakip verisi toplanıyor',
  'Keyword sıraları ve trendler analiz ediliyor',
  'Dış sinyaller taranıyor (web, YouTube)',
  'Gemini ile rekabet raporu üretiliyor',
]

interface DeepReportResponse extends DeepReport {
  cached?: boolean
  prepared?: {
    appEntry: string
    title: string
    competitors: { appId: string; platform: string; title: string }[]
    keywords: string[]
    autoDiscoveredCompetitors: boolean
    autoDiscoveredKeywords: boolean
  }
}

function rankLabel(rank: number | null): string {
  if (rank == null) return '50+'
  return `#${rank}`
}

function DeepReportInner() {
  const searchParams = useSearchParams()

  const [appEntry, setAppEntry] = useState('android:com.basecodestudio.setbox')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [competitorsInput, setCompetitorsInput] = useState('')
  const [keywordsInput, setKeywordsInput] = useState('')
  const [running, setRunning] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DeepReportResponse | null>(null)

  useEffect(() => {
    const app = searchParams?.get('app')
    if (app) setAppEntry(app)
  }, [searchParams])

  const runReport = useCallback(async () => {
    const entry = appEntry.trim()
    if (!entry) return

    setRunning(true)
    setError(null)
    setResult(null)
    setLoadingStep(0)

    const stepTimer = window.setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1))
    }, 12000)

    const competitors = competitorsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((item) => {
        if (item.includes(':')) {
          const colon = item.indexOf(':')
          return {
            platform: item.slice(0, colon).trim().toLowerCase() as 'android' | 'ios',
            appId: item.slice(colon + 1).trim(),
          }
        }
        return { platform: 'android' as const, appId: item.toLowerCase() }
      })

    const targetKeywords = keywordsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    try {
      const r = await fetch('/api/deep-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app: entry,
          ...(competitors.length ? { competitors } : {}),
          ...(targetKeywords.length ? { targetKeywords } : {}),
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        setError(await parseApiError(r, d.error || 'Rapor oluşturulamadı'))
        return
      }
      setResult(d as DeepReportResponse)
    } catch (e) {
      setError(networkErrorMessage(e))
    } finally {
      window.clearInterval(stepTimer)
      setRunning(false)
    }
  }, [appEntry, competitorsInput, keywordsInput])

  useEffect(() => {
    if (searchParams?.get('auto') === '1' && appEntry.trim() && !running && !result) {
      runReport()
    }
  }, [searchParams, appEntry, running, result, runReport])

  const myApp = result?.apps[0]
  const competitors = result?.apps.slice(1) ?? []

  return (
    <Layout title="Deep Competitor Report" badge="Rakip İstihbaratı">
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Uygulama</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.6 }}>
            <code style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>android:com.sirket.uygulama</code> veya{' '}
            <code style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>ios:1234567890</code> formatında girin.
            Rakipler ve keyword&apos;ler otomatik seçilir.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Uygulama kimliği</div>
              <input
                className="input"
                style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: 13 }}
                value={appEntry}
                onChange={(e) => setAppEntry(e.target.value)}
                placeholder="android:com.basecodestudio.setbox"
                disabled={running}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!appEntry.trim() || running}
              onClick={runReport}
              style={{ minWidth: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {running ? <Spinner /> : '◎'}
              {running ? 'Rapor üretiliyor…' : 'Deep Report Oluştur'}
            </button>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 12, marginTop: 12, padding: '4px 0' }}
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? '▾ Gelişmiş ayarları gizle' : '▸ Gelişmiş ayarlar (rakip / keyword)'}
          </button>

          {showAdvanced && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
                  Rakipler (opsiyonel, virgülle — max 3)
                </div>
                <input
                  className="input"
                  style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: 12 }}
                  value={competitorsInput}
                  onChange={(e) => setCompetitorsInput(e.target.value)}
                  placeholder="android:com.rakip1, android:com.rakip2"
                  disabled={running}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
                  Hedef keyword&apos;ler (opsiyonel, virgülle)
                </div>
                <input
                  className="input"
                  style={{ width: '100%', fontSize: 13 }}
                  value={keywordsInput}
                  onChange={(e) => setKeywordsInput(e.target.value)}
                  placeholder="iptv player, setbox, iptv"
                  disabled={running}
                />
              </div>
            </div>
          )}
        </div>

        {error && <ApiErrorBanner message={error} onDismiss={() => setError(null)} />}

        {running && (
          <AnalysisLoadingPanel
            title="Deep Competitor Report devam ediyor…"
            steps={LOADING_STEPS}
            activeStep={loadingStep}
          />
        )}

        {result && (
          <div className="stack">
            <AnalysisMetaBar
              analyzedAt={result.generatedAt}
              fromCache={result.cached}
              exportKind="deep-report"
              exportData={result}
              reportLabel="Deep Report"
              extra={
                result.prepared ? (
                  <span className="tag">{result.prepared.title}</span>
                ) : undefined
              }
            />

            {result.prepared && (
              <div className="card">
                <div className="card-title">Analiz Kapsamı</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                      Rakipler {result.prepared.autoDiscoveredCompetitors && '(otomatik)'}
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {result.prepared.competitors.map((c) => (
                        <li key={c.appId} style={{ fontSize: 13 }}>
                          <span style={{ fontWeight: 500 }}>{c.title}</span>
                          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)', display: 'block' }}>
                            {c.platform}:{c.appId}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                      Keyword&apos;ler {result.prepared.autoDiscoveredKeywords && '(otomatik)'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {result.prepared.keywords.map((kw) => (
                        <span key={kw} className="tag">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
              <div className="card-title">Executive Summary</div>
              <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.8, margin: 0 }}>
                {result.analysis.executiveSummary}
              </p>
            </div>

            {myApp && (
              <div className="card">
                <div className="card-title">Uygulama Snapshot — {myApp.title}</div>
                <div className="grid-2" style={{ marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Güncel</div>
                    <p style={{ fontSize: 13, margin: 0, lineHeight: 1.8 }}>
                      ★ {myApp.current.rating?.toFixed(1) ?? '—'} · {myApp.current.reviewCount?.toLocaleString('tr-TR')} yorum
                      <br />
                      {myApp.current.installsRange} · v{myApp.current.version}
                      <br />
                      {myApp.current.category}
                    </p>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>30 gün trend</div>
                    <p style={{ fontSize: 13, margin: 0, lineHeight: 1.8 }}>
                      Rating Δ: {myApp.trends.ratingChange >= 0 ? '+' : ''}
                      {myApp.trends.ratingChange.toFixed(2)}
                      <br />
                      Review hızı: {myApp.trends.reviewVelocity}
                      <br />
                      Install: {myApp.trends.installGrowth}
                    </p>
                  </div>
                </div>

                <div className="card-title" style={{ fontSize: 12, marginBottom: 8 }}>
                  Keyword sıraları
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {myApp.keywordRankings.map((kw) => (
                    <div
                      key={kw.keyword}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13,
                        padding: '8px 10px',
                        background: 'var(--bg)',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                      }}
                    >
                      <span>{kw.keyword}</span>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{rankLabel(kw.myRank)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-title">Rakip Analizi</div>
              <div className="stack" style={{ gap: 16 }}>
                {result.analysis.competitors.map((comp) => {
                  const snap = competitors.find((c) => c.appId === comp.appId)
                  return (
                    <div
                      key={comp.appId}
                      style={{
                        padding: 16,
                        background: 'var(--bg)',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600 }}>{comp.title}</div>
                          {snap && (
                            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: 4 }}>
                              ★ {snap.current.rating?.toFixed(1)} · {snap.current.installsRange}
                            </div>
                          )}
                        </div>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, margin: '0 0 12px' }}>
                        <strong>Neden üstte:</strong> {comp.whyTheyRankHigher}
                      </p>
                      <div className="grid-2">
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 6 }}>Güçlü yanlar</div>
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                            {comp.strengths.map((s) => (
                              <li key={s}>{s}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--warn)', marginBottom: 6 }}>Zayıf yanlar (fırsat)</div>
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                            {comp.weaknesses.map((w) => (
                              <li key={w}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-title">Fırsatlar</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
                  {result.analysis.opportunities.map((o) => (
                    <li key={o} style={{ marginBottom: 8 }}>
                      {o}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card">
                <div className="card-title">Keyword Gap</div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Eksik keyword&apos;ler</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {result.analysis.keywordGapAnalysis.missingKeywords.map((kw) => (
                      <span key={kw} className="tag" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Düşük rekabet fırsatları</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {result.analysis.keywordGapAnalysis.lowCompetitionKeywords.map((kw) => (
                      <span key={kw} className="tag" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ borderLeft: '3px solid var(--blue)' }}>
              <div className="card-title">Aksiyon Planı</div>
              <div className="grid-2">
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 10 }}>
                    Hemen (7 gün)
                  </div>
                  <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
                    {result.analysis.actionPlan.immediate.map((a) => (
                      <li key={a} style={{ marginBottom: 8 }}>
                        {a}
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue)', marginBottom: 10 }}>
                    Kısa vade (7–30 gün)
                  </div>
                  <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
                    {result.analysis.actionPlan.shortTerm.map((a) => (
                      <li key={a} style={{ marginBottom: 8 }}>
                        {a}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Dış Sinyal Analizi</div>
              <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8, margin: 0 }}>
                {result.analysis.externalSignalInsights}
              </p>
              {competitors.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginTop: 16 }}>
                  {[myApp, ...competitors].filter(Boolean).map((app) => (
                    <div
                      key={app!.appId}
                      style={{
                        padding: 10,
                        background: 'var(--bg)',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        fontSize: 12,
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>{app!.title}</div>
                      <div style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                        Sinyal: {app!.externalSignals.totalSignalScore}/100
                        <br />
                        Web: {app!.externalSignals.webMentionCount}
                        <br />
                        YouTube: {app!.externalSignals.youtubeVideos} video
                        {app!.externalSignals.isRunningAds && (
                          <>
                            <br />
                            <span style={{ color: 'var(--warn)' }}>Reklam aktif</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default function DeepReportClient() {
  return (
    <Suspense
      fallback={
        <Layout title="Deep Competitor Report">
          <div className="loading-row">
            <Spinner /> Yükleniyor…
          </div>
        </Layout>
      }
    >
      <DeepReportInner />
    </Suspense>
  )
}
