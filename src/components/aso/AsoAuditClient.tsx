'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Layout from '@/components/layout/Layout'
import HealthScoreRing from '@/components/dashboard/HealthScoreRing'
import ActionPlanPanel from '@/components/aso/ActionPlanPanel'
import AnalysisMetaBar from '@/components/aso/AnalysisMetaBar'
import AnalysisLoadingPanel from '@/components/aso/AnalysisLoadingPanel'
import ApiErrorBanner from '@/components/aso/ApiErrorBanner'
import { Spinner } from '@/components/ui/Spinner'
import { BULK_SCAN_LANGUAGES } from '@/lib/languages'
import { loadLocalApps } from '@/lib/dashboard-storage'
import { healthScoreColor, HEALTH_COLOR_MAP } from '@/lib/health-score'
import { parseApiError, networkErrorMessage } from '@/lib/client-errors'
import type { AppListItem } from '@/types/app'
import type { AsoAuditResult, CompetitorGapItem } from '@/types/aso'

const LOADING_STEPS = [
  'Play Store metadata çekiliyor',
  'Keyword ve rakip verisi toplanıyor',
  'Health score hesaplanıyor',
  'Gemini strateji ve aksiyon planı üretiliyor',
]

function severityStyle(severity: CompetitorGapItem['severity']) {
  if (severity === 'kritik') return { color: 'var(--red)', bg: 'var(--red-dim)' }
  if (severity === 'orta') return { color: 'var(--warn)', bg: 'var(--warn-dim)' }
  return { color: 'var(--muted)', bg: 'var(--border)' }
}

function opportunityColor(score: number): string {
  if (score >= 70) return 'var(--accent)'
  if (score >= 40) return 'var(--warn)'
  return 'var(--red)'
}

function AsoAuditInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [apps, setApps] = useState<AppListItem[]>([])
  const [selectedPkg, setSelectedPkg] = useState('')
  const [language, setLanguage] = useState('tr')
  const [loadingApps, setLoadingApps] = useState(true)
  const [running, setRunning] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AsoAuditResult | null>(null)

  useEffect(() => {
    async function loadApps() {
      setLoadingApps(true)
      try {
        const r = await fetch('/api/apps')
        const d = await r.json()
        if (d.apps?.length) {
          setApps(d.apps)
          return
        }
      } catch {
        /* fallback */
      }
      setApps(loadLocalApps())
    }
    loadApps().finally(() => setLoadingApps(false))
  }, [])

  useEffect(() => {
    const pkg = searchParams?.get('package')
    const lang = searchParams?.get('language') || searchParams?.get('lang')
    if (pkg) setSelectedPkg(pkg)
    else if (apps.length) setSelectedPkg((prev) => prev || apps[0].packageName)
    if (lang) setLanguage(lang)
  }, [searchParams, apps])

  const runAudit = useCallback(async () => {
    if (!selectedPkg) return
    setRunning(true)
    setError(null)
    setResult(null)
    setLoadingStep(0)

    const stepTimer = window.setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1))
    }, 8000)

    try {
      const r = await fetch('/api/aso-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageName: selectedPkg, language }),
      })
      const d = await r.json()
      if (!r.ok) {
        setError(await parseApiError(r, d.error || 'Audit başarısız'))
        return
      }
      setResult(d as AsoAuditResult)
    } catch (e) {
      setError(networkErrorMessage(e))
    } finally {
      window.clearInterval(stepTimer)
      setRunning(false)
    }
  }, [selectedPkg, language])

  useEffect(() => {
    if (searchParams?.get('auto') === '1' && selectedPkg && !running && !result && !loadingApps) {
      runAudit()
    }
  }, [searchParams, selectedPkg, running, result, loadingApps, runAudit])

  const selectedApp = apps.find((a) => a.packageName === selectedPkg)
  const healthColors = result ? HEALTH_COLOR_MAP[healthScoreColor(result.healthScore)] : null

  return (
    <Layout title="Full ASO Audit" badge="Profesyonel">
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Kontrol paneli */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Audit Parametreleri</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Uygulama</div>
              {loadingApps ? (
                <div className="loading-row" style={{ padding: 8 }}>
                  <Spinner /> Uygulamalar yükleniyor…
                </div>
              ) : apps.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Uygulama yok.{' '}
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => router.push('/')}>
                    Komuta Merkezi&apos;nden ekle
                  </button>
                </p>
              ) : (
                <select className="input" value={selectedPkg} onChange={(e) => setSelectedPkg(e.target.value)} style={{ width: '100%' }}>
                  {apps.map((a) => (
                    <option key={a.packageName} value={a.packageName}>
                      {a.title || a.packageName}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Pazar / Dil</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {BULK_SCAN_LANGUAGES.slice(0, 5).map((l) => (
                  <button
                    key={l.gl}
                    type="button"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: 'pointer',
                      border: `1px solid ${language === l.gl ? 'var(--accent)' : 'var(--border)'}`,
                      background: language === l.gl ? 'var(--accent-dim)' : 'var(--bg)',
                      color: language === l.gl ? 'var(--accent)' : 'var(--muted)',
                    }}
                    onClick={() => setLanguage(l.gl)}
                  >
                    {l.flag} {l.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedPkg || running}
              onClick={runAudit}
              style={{ minWidth: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {running ? <Spinner /> : '◈'}
              {running ? 'Audit çalışıyor…' : 'Full ASO Audit Çalıştır'}
            </button>
          </div>
          {selectedApp && (
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12, fontFamily: 'var(--mono)' }}>
              {selectedApp.packageName} · Son tarama: {selectedApp.lastScannedAt ? new Date(selectedApp.lastScannedAt).toLocaleString('tr-TR') : '—'}
            </p>
          )}
        </div>

        {error && <ApiErrorBanner message={error} onDismiss={() => setError(null)} />}

        {running && (
          <AnalysisLoadingPanel title="Full ASO Audit devam ediyor…" steps={LOADING_STEPS} activeStep={loadingStep} />
        )}

        {result && (
          <div className="stack">
            <AnalysisMetaBar
              analyzedAt={result.auditedAt}
              fromCache={result.fromCache}
              fallbackMode={result.fallbackMode}
              aiAvailable={result.aiAvailable}
              exportKind="audit"
              exportData={result}
              reportLabel="Audit Raporu"
              extra={
                <span className="tag">{result.languageLabel}</span>
              }
            />

            {/* Hero — Health Score */}
            <div
              className="card"
              style={{
                background: healthColors?.bg,
                borderColor: healthColors?.stroke,
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: 32,
                alignItems: 'center',
              }}
            >
              <HealthScoreRing score={result.healthScore} size={200} strokeWidth={12} label="ASO Health" />
              <div>
                <div className="card-title" style={{ marginBottom: 8 }}>Genel Durum</div>
                <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.8, marginBottom: 16 }}>
                  {result.strategySummary}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {result.dataSources.map((s) => (
                    <span key={s} className="tag" style={{ fontSize: 10 }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Health breakdown mini */}
            <div className="card">
              <div className="card-title">Health Score Kırılımı</div>
              <div className="criteria-grid">
                {result.healthBreakdown.criteria.map((c) => (
                  <div key={c.key} className="criteria-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{c.label}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>{c.score}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                      <div
                        style={{
                          width: `${c.score}%`,
                          height: '100%',
                          background: HEALTH_COLOR_MAP[healthScoreColor(c.score)].stroke,
                        }}
                      />
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>{c.explanation}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid-2">
              {/* Keyword Opportunities */}
              <div className="card">
                <div className="card-title">Keyword Fırsatları</div>
                {result.keywordOpportunities.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                    Keyword verisi yok — önce Bulk Scan yapın veya audit&apos;i keyword listesiyle çalıştırın.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
                    {result.keywordOpportunities.map((kw) => (
                      <div
                        key={kw.keyword}
                        style={{
                          padding: 12,
                          background: 'var(--bg)',
                          borderRadius: 8,
                          borderLeft: `3px solid ${opportunityColor(kw.opportunityScore)}`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{kw.keyword}</span>
                          <span style={{ fontFamily: 'var(--mono)', color: opportunityColor(kw.opportunityScore) }}>
                            {kw.opportunityScore}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                          Sıra: {kw.myRank != null ? `#${kw.myRank}` : 'İlk 100\'de yok'}
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>{kw.reasoning}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Metadata highlights */}
              <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
                <div className="card-title">Metadata Önerileri</div>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.metadataHighlights.map((h, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                      {h}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginTop: 16, fontSize: 12, width: '100%' }}
                  onClick={() =>
                    router.push(
                      `/keywords/metadata-optimizer?package=${encodeURIComponent(result.packageName)}&lang=${result.language}&useBulkScan=1`
                    )
                  }
                >
                  ✦ Metadata Optimizer&apos;da Detaylı Öneri Al
                </button>
              </div>
            </div>

            {/* Competitor gaps */}
            <div className="card">
              <div className="card-title">Rakip Gap Özeti</div>
              {result.competitorGaps.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Kritik gap tespit edilmedi.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Keyword</th>
                        <th>Sıra</th>
                        <th>Tip</th>
                        <th>Önem</th>
                        <th>Öneri</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.competitorGaps.map((g, i) => {
                        const st = severityStyle(g.severity)
                        return (
                          <tr key={`${g.keyword}-${i}`}>
                            <td style={{ fontWeight: 500 }}>{g.keyword}</td>
                            <td style={{ fontFamily: 'var(--mono)' }}>{g.myRank ?? '—'}</td>
                            <td>{g.gapType}</td>
                            <td>
                              <span className="tag" style={{ color: st.color, background: st.bg, border: `1px solid ${st.color}` }}>
                                {g.severity}
                              </span>
                            </td>
                            <td style={{ fontSize: 12, maxWidth: 280 }}>{g.recommendation}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <ActionPlanPanel plan={result.actionPlan7Days} />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => router.push(`/keywords/bulk-scan?package=${encodeURIComponent(result.packageName)}&lang=${result.language}`)}
              >
                ✓ Bulk Scan&apos;e Git
              </button>
              <button type="button" className="btn btn-ghost" onClick={runAudit}>
                ↻ Audit&apos;i Yenile
              </button>
            </div>
          </div>
        )}

        {!result && !running && !error && (
          <div className="empty" style={{ padding: 48 }}>
            <div className="icon">◈</div>
            <div style={{ marginBottom: 8 }}>Uygulama seçin ve Full ASO Audit çalıştırın</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 400, margin: '0 auto' }}>
              Health score, keyword fırsatları, metadata önerileri, rakip gap analizi ve 7 günlük aksiyon planı tek raporda.
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default function AsoAuditClient() {
  return (
    <Suspense
      fallback={
        <Layout title="Full ASO Audit" badge="Profesyonel">
          <div className="loading-row">
            <Spinner /> Yükleniyor…
          </div>
        </Layout>
      }
    >
      <AsoAuditInner />
    </Suspense>
  )
}
