'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/layout/Layout'
import { BULK_SCAN_LANGUAGES } from '@/lib/languages'
import { loadLocalApps } from '@/lib/dashboard-storage'
import { Spinner } from '@/components/ui/Spinner'
import ActionPlanPanel from '@/components/aso/ActionPlanPanel'
import AnalysisMetaBar from '@/components/aso/AnalysisMetaBar'
import AnalysisLoadingPanel from '@/components/aso/AnalysisLoadingPanel'
import ApiErrorBanner from '@/components/aso/ApiErrorBanner'
import { parseApiError, networkErrorMessage } from '@/lib/client-errors'
import type { AppListItem } from '@/types/app'
import type {
  ExpectedImpact,
  MetadataOptimizerContext,
  MetadataOptimizerResult,
  MetadataSuggestion,
} from '@/types/metadata'

function impactStyle(impact: ExpectedImpact): { bg: string; color: string } {
  if (impact === 'Yüksek') return { bg: 'var(--accent-dim)', color: 'var(--accent)' }
  if (impact === 'Orta') return { bg: 'var(--warn-dim)', color: 'var(--warn)' }
  return { bg: 'var(--red-dim)', color: 'var(--red)' }
}

function CopyBtn({
  label,
  text,
  copiedKey,
  copyKey,
  onCopy,
}: {
  label: string
  text: string
  copiedKey: string | null
  copyKey: string
  onCopy: (text: string, key: string) => void
}) {
  return (
    <button
      type="button"
      className="btn btn-ghost"
      style={{ fontSize: 11, padding: '4px 10px' }}
      onClick={() => onCopy(text, copyKey)}
    >
      {copiedKey === copyKey ? '✓ Kopyalandı' : `Kopyala ${label}`}
    </button>
  )
}

function SuggestionCard({
  suggestion,
  isRecommended,
  copiedKey,
  onCopy,
}: {
  suggestion: MetadataSuggestion
  isRecommended: boolean
  copiedKey: string | null
  onCopy: (text: string, key: string) => void
}) {
  const impact = impactStyle(suggestion.expectedImpact)
  const prefix = suggestion.version

  return (
    <div
      className="card"
      style={{
        borderColor: isRecommended ? 'var(--accent)' : 'var(--border)',
        boxShadow: isRecommended ? '0 0 0 1px var(--accent-dim)' : undefined,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>
            Versiyon {suggestion.version}
          </div>
          {isRecommended && (
            <span className="tag" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', marginTop: 6 }}>
              ★ Önerilen
            </span>
          )}
        </div>
        <span className="tag" style={{ background: impact.bg, color: impact.color, border: `1px solid ${impact.color}` }}>
          {suggestion.expectedImpact} Etki
        </span>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Başlık ({suggestion.characterCount.title}/30)
          </span>
          <CopyBtn
            label="Başlık"
            text={suggestion.title}
            copiedKey={copiedKey}
            copyKey={`${prefix}-title`}
            onCopy={onCopy}
          />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{suggestion.title}</div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Kısa Açıklama ({suggestion.characterCount.short}/80)
          </span>
          <CopyBtn
            label="Kısa"
            text={suggestion.shortDescription}
            copiedKey={copiedKey}
            copyKey={`${prefix}-short`}
            onCopy={onCopy}
          />
        </div>
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{suggestion.shortDescription}</div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Full Açıklama ({suggestion.characterCount.full}/4000)
          </span>
          <CopyBtn
            label="Full"
            text={suggestion.fullDescription}
            copiedKey={copiedKey}
            copyKey={`${prefix}-full`}
            onCopy={onCopy}
          />
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text)',
            lineHeight: 1.7,
            maxHeight: 220,
            overflowY: 'auto',
            padding: 12,
            background: 'var(--bg)',
            borderRadius: 6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {suggestion.fullDescription}
        </div>
      </div>

      {suggestion.usedKeywords.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Kullanılan Keyword&apos;ler
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {suggestion.usedKeywords.map((kw) => (
              <span key={kw} className="tag" style={{ fontSize: 11 }}>
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 6, borderLeft: '3px solid var(--blue)' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>AI Gerekçesi</div>
        <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, margin: 0 }}>{suggestion.reasoning}</p>
      </div>

      <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0, fontStyle: 'italic' }}>
        Bu versiyonu Play Console → Store presence → Main store listing bölümünden manuel uygulayın.
      </p>
    </div>
  )
}

export default function MetadataOptimizerClient() {
  const router = useRouter()
  const [apps, setApps] = useState<AppListItem[]>([])
  const [selectedPkg, setSelectedPkg] = useState('')
  const [language, setLanguage] = useState('tr')
  const [useBulkScan, setUseBulkScan] = useState(true)
  const [context, setContext] = useState<MetadataOptimizerContext | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MetadataOptimizerResult | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    async function loadApps() {
      try {
        const r = await fetch('/api/apps')
        const d = await r.json()
        if (d.apps?.length) {
          setApps(d.apps)
          setSelectedPkg((prev) => prev || d.apps[0].packageName)
          return
        }
      } catch {
        /* fallback */
      }
      const local = loadLocalApps()
      setApps(local)
      if (local.length) setSelectedPkg((prev) => prev || local[0].packageName)
    }
    loadApps()
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const pkg = params.get('package')
      const lang = params.get('lang')
      if (pkg) setSelectedPkg(pkg)
      if (lang) setLanguage(lang)
      if (params.get('useBulkScan') === '1') setUseBulkScan(true)
    }
  }, [])

  const loadContext = useCallback(async (pkg: string, lang: string) => {
    if (!pkg) return
    setContextLoading(true)
    setError(null)
    try {
      const r = await fetch(
        `/api/metadata-optimizer?packageName=${encodeURIComponent(pkg)}&language=${encodeURIComponent(lang)}`
      )
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.error || 'Metadata yüklenemedi')
      }
      const d: MetadataOptimizerContext = await r.json()
      setContext(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Metadata yüklenemedi')
      setContext(null)
    } finally {
      setContextLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedPkg) loadContext(selectedPkg, language)
  }, [selectedPkg, language, loadContext])

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      setError('Panoya kopyalanamadı')
    }
  }

  const handleGenerate = async () => {
    if (!selectedPkg) return
    setGenerating(true)
    setLoadingStep(0)
    setError(null)
    setResult(null)
    const stepTimer = window.setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, 2))
    }, 10000)
    try {
      const r = await fetch('/api/metadata-optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageName: selectedPkg,
          language,
          useBulkScan,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        setError(await parseApiError(r, d.error || 'Optimizasyon başarısız'))
        return
      }
      setResult(d)
    } catch (e) {
      setError(networkErrorMessage(e))
    } finally {
      window.clearInterval(stepTimer)
      setGenerating(false)
    }
  }

  const selectedApp = apps.find((a) => a.packageName === selectedPkg)

  return (
    <Layout title="AI Metadata Optimizer" badge="Gemini ASO">
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Sol panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-title">Uygulama Seç</div>
              {apps.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Henüz uygulama yok. Komuta Merkezi&apos;nden ekleyin.
                </p>
              ) : (
                <select
                  className="input"
                  value={selectedPkg}
                  onChange={(e) => setSelectedPkg(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {apps.map((a) => (
                    <option key={a.packageName} value={a.packageName}>
                      {a.title || a.packageName}
                    </option>
                  ))}
                </select>
              )}
              {selectedApp?.icon && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedApp.icon} alt="" width={36} height={36} style={{ borderRadius: 8 }} />
                  <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{selectedPkg}</span>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-title">Dil / Pazar</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {BULK_SCAN_LANGUAGES.map((l) => (
                  <button
                    key={l.gl}
                    type="button"
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: 'pointer',
                      border: `1px solid ${language === l.gl ? 'var(--accent)' : 'var(--border)'}`,
                      background: language === l.gl ? 'var(--accent-dim)' : 'var(--bg)',
                      color: language === l.gl ? 'var(--accent)' : 'var(--muted)',
                    }}
                    onClick={() => setLanguage(l.gl)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-title">Bulk Scan Entegrasyonu</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={useBulkScan}
                  onChange={(e) => setUseBulkScan(e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Bulk Scan sonuçlarını kullan
              </label>
              {useBulkScan && context && (
                <div style={{ marginTop: 12 }}>
                  {context.hasBulkScan ? (
                    <>
                      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                        Son bulk scan&apos;den {context.bulkScanKeywords.length} keyword:
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {context.bulkScanKeywords.map((kw) => (
                          <span key={kw} className="tag" style={{ fontSize: 11 }}>
                            {kw}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p style={{ fontSize: 12, color: 'var(--warn)' }}>
                      Bu uygulama için bulk scan geçmişi yok. Önce Toplu Tarama yapın veya toggle&apos;ı kapatın.
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={
                !selectedPkg ||
                generating ||
                Boolean(useBulkScan && context && !context.hasBulkScan)
              }
              onClick={handleGenerate}
            >
              {generating ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Spinner /> Gemini ile üretiliyor…
                </span>
              ) : (
                '✦ Metadata Önerileri Üret'
              )}
            </button>
          </div>

          {/* Sağ panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-title">Mevcut Metadata (Play Store)</div>
              {contextLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 13 }}>
                  <Spinner /> Yükleniyor…
                </div>
              ) : context ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                      Başlık ({context.currentMetadata.title.length}/30)
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{context.currentMetadata.title}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                      Kısa Açıklama ({context.currentMetadata.shortDescription.length}/80)
                    </div>
                    <div style={{ fontSize: 13 }}>{context.currentMetadata.shortDescription || '(boş)'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                      Full Açıklama ({context.currentMetadata.fullDescription.length}/4000)
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        maxHeight: 120,
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        color: 'var(--muted)',
                        lineHeight: 1.6,
                      }}
                    >
                      {context.currentMetadata.fullDescription.slice(0, 500)}
                      {context.currentMetadata.fullDescription.length > 500 ? '…' : ''}
                    </div>
                  </div>
                  {context.currentMetadata.genre && (
                    <span className="tag">{context.currentMetadata.genre}</span>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Uygulama seçin.</p>
              )}
            </div>

            {error && <ApiErrorBanner message={error} onDismiss={() => setError(null)} />}

            {generating && (
              <AnalysisLoadingPanel title="Metadata önerileri üretiliyor" activeStep={loadingStep} />
            )}

            {result && (
              <>
                <AnalysisMetaBar
                  analyzedAt={result.generatedAt}
                  fromCache={result.fromCache}
                  aiAvailable={result.aiAvailable}
                  exportKind="metadata"
                  exportData={result}
                  reportLabel="Metadata Raporu"
                  extra={<span className="tag">{result.languageLabel}</span>}
                />
                <div
                  className="card"
                  style={{
                    borderColor: 'var(--accent)',
                    background: 'var(--accent-dim)',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{ fontSize: 20 }}>★</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>
                      En iyi versiyon: {result.recommendedVersion}
                      {result.fromCache && (
                        <span className="tag" style={{ marginLeft: 8, fontSize: 10 }}>
                          önbellek
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
                      {result.recommendationReason}
                    </p>
                    {!result.aiAvailable && (
                      <p style={{ fontSize: 12, color: 'var(--warn)', margin: '8px 0 0' }}>
                        GEMINI_API_KEY tanımlı değil — sınırlı heuristik öneriler gösteriliyor.
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {result.suggestions.map((suggestion) => (
                    <SuggestionCard
                      key={suggestion.version}
                      suggestion={suggestion}
                      isRecommended={suggestion.version === result.recommendedVersion}
                      copiedKey={copiedKey}
                      onCopy={handleCopy}
                    />
                  ))}
                </div>

                {result.comparison.length > 0 && (
                  <div className="card">
                    <div className="card-title">Karşılaştırma Tablosu</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--muted)', fontWeight: 500 }}>Versiyon</th>
                            <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--muted)', fontWeight: 500 }}>Başlık</th>
                            <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--muted)', fontWeight: 500 }}>Kısa</th>
                            <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--muted)', fontWeight: 500 }}>Full</th>
                            <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--muted)', fontWeight: 500 }}>Keyword</th>
                            <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--muted)', fontWeight: 500 }}>Beklenen Etki</th>
                            <th style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--muted)', fontWeight: 500 }}>Skor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.comparison.map((row) => {
                            const isRecommended = row.version === result.recommendedVersion
                            return (
                              <tr
                                key={row.version}
                                style={{
                                  borderBottom: '1px solid var(--border)',
                                  background: isRecommended ? 'var(--accent-dim)' : undefined,
                                }}
                              >
                                <td style={{ padding: '10px 12px', fontWeight: isRecommended ? 600 : 400 }}>
                                  {row.version}
                                  {isRecommended && (
                                    <span className="tag" style={{ marginLeft: 8, fontSize: 10 }}>
                                      önerilen
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>
                                  {row.titleChars}/30
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>
                                  {row.shortChars}/80
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>
                                  {row.fullChars}/4000
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>
                                  {row.keywordCount}
                                </td>
                                <td style={{ padding: '10px 12px' }}>{row.expectedImpact}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>
                                  {row.rankScore.toFixed(1)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {result.actionPlan7Days && <ActionPlanPanel plan={result.actionPlan7Days} />}

                <div className="card" style={{ borderLeft: '3px solid var(--blue)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Tam Resim</div>
                    <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                      Health score, rakip gap ve strateji için Full ASO Audit çalıştırın.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: 12 }}
                    onClick={() =>
                      router.push(
                        `/aso-audit?package=${encodeURIComponent(result.packageName)}&language=${result.language}`
                      )
                    }
                  >
                    ◈ Full ASO Audit&apos;e Git
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
