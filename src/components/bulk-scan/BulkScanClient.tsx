'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/layout/Layout'
import { BULK_SCAN_LANGUAGES } from '@/lib/languages'
import type { BulkScanResult, KeywordAnalysis } from '@/types/gemini'
import { Spinner } from '@/components/ui/Spinner'
import ActionPlanPanel from '@/components/aso/ActionPlanPanel'
import AnalysisMetaBar from '@/components/aso/AnalysisMetaBar'
import AnalysisLoadingPanel from '@/components/aso/AnalysisLoadingPanel'
import ApiErrorBanner from '@/components/aso/ApiErrorBanner'
import { parseApiError, networkErrorMessage } from '@/lib/client-errors'

type SortKey = 'opportunityScore' | 'estimatedVolume' | 'difficulty' | 'relevanceToApp'
type SortDir = 'asc' | 'desc'

function opportunityColor(score: number): string {
  if (score >= 70) return 'var(--accent)'
  if (score >= 40) return 'var(--warn)'
  return 'var(--red)'
}

function opportunityBg(score: number): string {
  if (score >= 70) return 'var(--accent-dim)'
  if (score >= 40) return 'var(--warn-dim)'
  return 'var(--red-dim)'
}

function competitionBadge(level: string) {
  const map: Record<string, { bg: string; color: string }> = {
    Low: { bg: 'var(--accent-dim)', color: 'var(--accent)' },
    Medium: { bg: 'var(--warn-dim)', color: 'var(--warn)' },
    High: { bg: 'var(--red-dim)', color: 'var(--red)' },
  }
  const s = map[level] ?? map.Medium
  return (
    <span className="tag" style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}` }}>
      {level === 'Low' ? 'Düşük' : level === 'High' ? 'Yüksek' : 'Orta'}
    </span>
  )
}

function KeywordCard({ kw, expanded, onToggle }: { kw: KeywordAnalysis; expanded: boolean; onToggle: () => void }) {
  return (
    <div
      className="card"
      style={{
        borderLeft: `3px solid ${opportunityColor(kw.opportunityScore)}`,
        background: opportunityBg(kw.opportunityScore),
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{kw.keyword}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {competitionBadge(kw.competitionLevel)}
            <span className="tag">Hacim ~{kw.estimatedVolume.toLocaleString('tr-TR')}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 600, color: opportunityColor(kw.opportunityScore) }}>
            {kw.opportunityScore}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Fırsat Skoru</div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, marginBottom: 12 }}>{kw.reasoning}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        <div style={{ padding: 10, background: 'var(--bg)', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 18, color: 'var(--text)' }}>{kw.difficulty}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Zorluk</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg)', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 18, color: 'var(--text)' }}>{kw.relevanceToApp}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Uyumluluk</div>
        </div>
        <div style={{ padding: 10, background: 'var(--bg)', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 18, color: 'var(--text)' }}>{kw.longTailSuggestions.length}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Long-tail</div>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-ghost"
        style={{ width: '100%', fontSize: 12 }}
        onClick={onToggle}
      >
        {expanded ? '▾ Long-tail önerilerini gizle' : '▸ Long-tail önerilerini göster'}
      </button>

      {expanded && kw.longTailSuggestions.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {kw.longTailSuggestions.map((lt) => (
            <span key={lt} className="tag" style={{ fontSize: 12, padding: '6px 12px' }}>{lt}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function BulkScanClient() {
  const router = useRouter()
  const [language, setLanguage] = useState('tr')
  const [packageNames, setPackageNames] = useState('')
  const [keywords, setKeywords] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BulkScanResult | null>(null)
  const [expandedKw, setExpandedKw] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('opportunityScore')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

  useEffect(() => {
    const saved = localStorage.getItem('myAppId')
    if (saved && !packageNames) setPackageNames(saved)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const pkg = params.get('package')
      const lang = params.get('lang')
      if (pkg) setPackageNames(pkg)
      if (lang) setLanguage(lang)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = packageNames.trim().length > 0 && keywords.trim().length > 0 && !loading

  const sortedKeywords = useMemo(() => {
    if (!result) return []
    const list = [...result.keywords]
    list.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number)
    })
    return list
  }, [result, sortKey, sortDir])

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }, [sortKey])

  async function runAnalysis() {
    setLoading(true)
    setLoadingStep(0)
    setError(null)
    setResult(null)
    const stepTimer = window.setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, 2))
    }, 12000)
    try {
      const r = await fetch('/api/bulk-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageName: packageNames, keywords, language }),
      })
      const d = await r.json()
      if (!r.ok) {
        setError(await parseApiError(r, d.error || 'Analiz başarısız'))
        return
      }
      setResult(d as BulkScanResult)
      localStorage.setItem('myAppId', packageNames.trim().split(/[,\n]/)[0] || '')
    } catch (e) {
      setError(networkErrorMessage(e))
    } finally {
      window.clearInterval(stepTimer)
      setLoading(false)
    }
  }

  async function saveResults() {
    if (!result) return
    setSaving(true)
    try {
      const r = await fetch('/api/bulk-scan-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageName: result.primaryApp, result }),
      })
      const d = await r.json()
      if (!r.ok) {
        alert(d.error || 'Kayıt başarısız')
        return
      }
      alert(`Sonuç kaydedildi (${d.total} kayıt geçmişte)`)
    } catch {
      alert('Redis bağlı değil veya kayıt hatası')
    } finally {
      setSaving(false)
    }
  }

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      style={{ cursor: 'pointer', userSelect: 'none' }}
      onClick={() => toggleSort(field)}
    >
      {label} {sortKey === field ? (sortDir === 'desc' ? '↓' : '↑') : ''}
    </th>
  )

  return (
    <Layout title="Toplu ASO Analizi" badge="AI Bulk Scan">
      {/* Form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Analiz Parametreleri</div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>Pazar / Dil</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {BULK_SCAN_LANGUAGES.map((l) => (
              <button
                key={l.gl}
                type="button"
                onClick={() => setLanguage(l.gl)}
                style={{
                  cursor: 'pointer',
                  padding: '8px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  border: `1px solid ${language === l.gl ? 'var(--accent)' : 'var(--border)'}`,
                  background: language === l.gl ? 'var(--accent-dim)' : 'var(--bg)',
                  color: language === l.gl ? 'var(--accent)' : 'var(--muted)',
                }}
              >
                {l.flag} {l.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Package Name</div>
          <input
            className="input"
            placeholder="com.sirket.uygulama veya virgülle ayrılmış birden fazla"
            value={packageNames}
            onChange={(e) => setPackageNames(e.target.value)}
          />
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
            İlk package birincil uygulama olarak analiz edilir; diğerleri sıra karşılaştırması için kullanılır.
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Kök Kelimeler</div>
          <textarea
            className="input"
            rows={4}
            placeholder="iptv, canlı tv, live stream (virgül veya satır ile ayırın)"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'var(--mono)' }}
          />
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={runAnalysis}
          disabled={!canSubmit}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {loading ? <Spinner /> : null}
          {loading ? 'Analiz ediliyor...' : 'Analizi Başlat'}
        </button>
      </div>

      {error && <ApiErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading && (
        <AnalysisLoadingPanel title="Bulk Scan analizi" activeStep={loadingStep} />
      )}

      {result && (
        <div className="stack">
          <AnalysisMetaBar
            analyzedAt={result.analyzedAt}
            fromCache={result.fromCache}
            fallbackMode={result.fallbackMode}
            exportKind="bulk-scan"
            exportData={result}
            reportLabel="Bulk Scan Raporu"
            extra={
              <>
                <span className="tag">{result.primaryApp}</span>
                <span className="tag">{result.language}</span>
                <span className="tag">{result.keywords.length} kelime</span>
              </>
            }
          />

          <div className="result-action-bar">
            <div className="tabs">
              <div className={`tab ${viewMode === 'cards' ? 'active' : ''}`} onClick={() => setViewMode('cards')}>Kartlar</div>
              <div className={`tab ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>Tablo</div>
            </div>
            <button type="button" className="btn btn-primary" onClick={saveResults} disabled={saving} style={{ fontSize: 12 }}>
              {saving ? <Spinner /> : '💾 Sonuçları Kaydet'}
            </button>
          </div>

          {/* Strategy */}
          <div className="grid-2">
            <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
              <div className="card-title">Strateji Özeti</div>
              <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8 }}>{result.strategySummary}</p>
            </div>
            <div className="card" style={{ borderLeft: '3px solid var(--blue)' }}>
              <div className="card-title">Hızlı Aksiyonlar</div>
              <ul style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.8, paddingLeft: 18 }}>
                {result.quickActions.map((a, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>{a}</li>
                ))}
              </ul>
            </div>
          </div>

          {result.actionPlan7Days && <ActionPlanPanel plan={result.actionPlan7Days} />}

          <div className="card" style={{ borderLeft: '3px solid var(--blue)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Sonraki Adım</div>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                Bulk scan keyword&apos;leriyle metadata önerileri üretin.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: 12 }}
              onClick={() =>
                router.push(
                  `/keywords/metadata-optimizer?package=${encodeURIComponent(result.primaryApp)}&lang=${language}&useBulkScan=1`
                )
              }
            >
              ✦ Metadata Optimizer&apos;ı Çalıştır
            </button>
          </div>

          {/* Recommended title keywords */}
          {result.recommendedTitleKeywords.length > 0 && (
            <div className="card">
              <div className="card-title">Başlık İçin Önerilen Kelimeler</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {result.recommendedTitleKeywords.map((w) => (
                  <span key={w} className="tag" style={{ fontSize: 13, padding: '8px 14px', color: 'var(--accent)', background: 'var(--accent-dim)' }}>
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top competitors */}
          {result.topCompetitors.length > 0 && (
            <div className="card">
              <div className="card-title">Öne Çıkan Rakipler</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Uygulama</th>
                      <th>Package</th>
                      <th>Puan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.topCompetitors.map((c) => (
                      <tr key={c.packageName}>
                        <td style={{ color: 'var(--text)' }}>{c.title}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>{c.packageName}</td>
                        <td><span style={{ color: 'var(--warn)' }}>★ {c.score?.toFixed(1) ?? '—'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Keywords results */}
          <div>
            <div className="card-title" style={{ marginBottom: 12 }}>Kelime Analizleri</div>

            {viewMode === 'cards' ? (
              <div className="stack">
                {sortedKeywords.map((kw) => (
                  <KeywordCard
                    key={kw.keyword}
                    kw={kw}
                    expanded={expandedKw.has(kw.keyword)}
                    onToggle={() =>
                      setExpandedKw((prev) => {
                        const next = new Set(prev)
                        if (next.has(kw.keyword)) next.delete(kw.keyword)
                        else next.add(kw.keyword)
                        return next
                      })
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="card">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Kelime</th>
                        <SortHeader label="Fırsat" field="opportunityScore" />
                        <SortHeader label="Hacim" field="estimatedVolume" />
                        <SortHeader label="Zorluk" field="difficulty" />
                        <SortHeader label="Uyum" field="relevanceToApp" />
                        <th>Rekabet</th>
                        <th>Long-tail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedKeywords.map((kw) => (
                        <tr key={kw.keyword}>
                          <td style={{ fontWeight: 500, color: 'var(--text)' }}>{kw.keyword}</td>
                          <td>
                            <span style={{ fontFamily: 'var(--mono)', color: opportunityColor(kw.opportunityScore), fontWeight: 600 }}>
                              {kw.opportunityScore}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{kw.estimatedVolume.toLocaleString('tr-TR')}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{kw.difficulty}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{kw.relevanceToApp}</td>
                          <td>{competitionBadge(kw.competitionLevel)}</td>
                          <td style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 200 }}>
                            {kw.longTailSuggestions.slice(0, 2).join(' · ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
