'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import Layout from '@/components/layout/Layout'
import HealthScoreRing from '@/components/dashboard/HealthScoreRing'
import { Spinner } from '@/components/ui/Spinner'
import { healthScoreColor, HEALTH_COLOR_MAP } from '@/lib/health-score'
import {
  loadLocalApps,
  saveLocalApps,
  saveLocalProfile,
  loadLocalProfile,
  profileToListItem,
} from '@/lib/dashboard-storage'
import type { AppListItem, AppProfile, DashboardData } from '@/types/app'
import { fmtDate } from '@/lib/languages'

function buildLocalDashboard(profile: AppProfile): DashboardData {
  return {
    profile,
    recentAnalyses: [
      {
        id: 'local-1',
        type: 'health-refresh',
        analyzedAt: profile.lastScannedAt,
        healthScore: profile.healthScore,
        summary: 'Yerel profil — Redis bağlantısı yok.',
      },
    ],
    opportunityTrend: [],
  }
}

export default function CommandCenter() {
  const router = useRouter()
  const [apps, setApps] = useState<AppListItem[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [newPackage, setNewPackage] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [redisAvailable, setRedisAvailable] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadApps = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/apps')
      const d = await r.json()
      if (d.apps?.length) {
        setApps(d.apps)
        setRedisAvailable(d.redisAvailable !== false)
        saveLocalApps(d.apps)
        if (!selected) setSelected(d.apps[0].packageName)
      } else {
        const local = loadLocalApps()
        setApps(local)
        setRedisAvailable(d.redisAvailable !== false)
        if (local.length && !selected) setSelected(local[0].packageName)
      }
    } catch {
      const local = loadLocalApps()
      setApps(local)
      setRedisAvailable(false)
      if (local.length && !selected) setSelected(local[0].packageName)
    } finally {
      setLoading(false)
    }
  }, [selected])

  const loadDashboard = useCallback(async (pkg: string) => {
    try {
      const r = await fetch(`/api/apps/${encodeURIComponent(pkg)}`)
      if (r.ok) {
        const d = await r.json()
        setDashboard(d)
        saveLocalProfile(d.profile)
        return
      }
    } catch {
      /* fall through to local */
    }
    const profile = loadLocalProfile(pkg)
    if (profile) setDashboard(buildLocalDashboard(profile))
    else setDashboard(null)
  }, [])

  useEffect(() => {
    loadApps()
  }, [loadApps])

  useEffect(() => {
    if (selected) loadDashboard(selected)
  }, [selected, loadDashboard])

  async function handleAddApp() {
    const pkg = newPackage.trim()
    if (!pkg) return
    setAdding(true)
    setError(null)
    try {
      const r = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageName: pkg }),
      })
      const d = await r.json()
      if (!r.ok) {
        setError(d.error || 'Uygulama eklenemedi')
        return
      }
      const profile = d.profile as AppProfile
      const item = profileToListItem(profile)
      saveLocalProfile(profile)
      setApps((prev) => {
        const filtered = prev.filter((a) => a.packageName !== item.packageName)
        const next = [item, ...filtered]
        saveLocalApps(next)
        return next
      })
      setSelected(profile.packageName)
      setNewPackage('')
      localStorage.setItem('myAppId', profile.packageName)
      if (!d.redisSaved) setRedisAvailable(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata')
    } finally {
      setAdding(false)
    }
  }

  async function handleRefresh() {
    if (!selected) return
    setRefreshing(true)
    try {
      const r = await fetch(`/api/apps/${encodeURIComponent(selected)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh' }),
      })
      const d = await r.json()
      if (r.ok && d.dashboard) {
        setDashboard(d.dashboard)
        saveLocalProfile(d.profile)
        setApps((prev) =>
          prev.map((a) =>
            a.packageName === selected
              ? { ...a, healthScore: d.profile.healthScore, lastScannedAt: d.profile.lastScannedAt }
              : a
          )
        )
      } else {
        const rr = await fetch('/api/apps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packageName: selected }),
        })
        const dd = await rr.json()
        if (rr.ok) {
          saveLocalProfile(dd.profile)
          setDashboard(buildLocalDashboard(dd.profile))
        }
      }
    } finally {
      setRefreshing(false)
    }
  }

  const profile = dashboard?.profile
  const colorKey = profile ? healthScoreColor(profile.healthScore) : 'yellow'
  const colors = HEALTH_COLOR_MAP[colorKey]

  const chartData =
    dashboard?.opportunityTrend.map((p) => ({
      date: new Date(p.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
      score: p.score,
    })) ?? []

  return (
    <Layout title="Komuta Merkezi" badge="Ana Panel">
      {!redisAvailable && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--warn)' }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
            Redis bağlı değil — uygulamalar tarayıcıda saklanıyor. Kalıcı kayıt ve geçmiş için Upstash KV kurun.
          </p>
        </div>
      )}

      <div className="dashboard-shell">
        {/* Sol: Uygulama listesi */}
        <aside className="dashboard-sidebar">
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">Uygulama Ekle</div>
            <input
              className="input"
              placeholder="com.sirket.uygulama"
              value={newPackage}
              onChange={(e) => setNewPackage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddApp()}
              style={{ marginBottom: 8 }}
            />
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={handleAddApp}
              disabled={adding || !newPackage.trim()}
            >
              {adding ? <Spinner /> : '+ Ekle'}
            </button>
          </div>

          <div className="card-title" style={{ padding: '0 4px', marginBottom: 8 }}>Benim Uygulamalarım</div>

          {loading && (
            <div className="loading-row" style={{ padding: '12px 0' }}>
              <Spinner /> Yükleniyor...
            </div>
          )}

          {!loading && apps.length === 0 && (
            <div className="empty" style={{ padding: 24 }}>
              <div className="icon">◈</div>
              <div>Package name ekleyerek başlayın</div>
            </div>
          )}

          <div className="app-list">
            {apps.map((app) => {
              const active = selected === app.packageName
              const hc = healthScoreColor(app.healthScore)
              const hcColors = HEALTH_COLOR_MAP[hc]
              return (
                <button
                  key={app.packageName}
                  type="button"
                  className={`app-list-item ${active ? 'active' : ''}`}
                  onClick={() => setSelected(app.packageName)}
                >
                  {app.icon ? (
                    <img src={app.icon} alt="" className="app-icon" width={36} height={36} />
                  ) : (
                    <div className="app-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>◈</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {app.title}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {app.packageName}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      {fmtDate(app.lastScannedAt)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <div
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 14,
                        fontWeight: 600,
                        color: hcColors.text,
                        background: hcColors.bg,
                        padding: '4px 8px',
                        borderRadius: 6,
                      }}
                    >
                      {app.healthScore}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 10, padding: '3px 8px' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/aso-audit?package=${encodeURIComponent(app.packageName)}&language=tr&auto=1`)
                      }}
                    >
                      Quick Audit
                    </button>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Ana alan */}
        <main className="dashboard-main">
          {error && (
            <div className="card" style={{ borderColor: 'var(--red)', marginBottom: 16 }}>
              <span style={{ color: 'var(--red)', fontSize: 13 }}>{error}</span>
            </div>
          )}

          {!profile && !loading && (
            <div className="empty">
              <div className="icon">▦</div>
              <div>Sol panelden uygulama seçin veya yeni ekleyin</div>
            </div>
          )}

          {profile && (
            <div className="stack">
              {/* Health hero */}
              <div className="card dashboard-hero" style={{ background: colors.bg, borderColor: colors.stroke }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
                  <HealthScoreRing score={profile.healthScore} size={140} />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      {profile.icon && <img src={profile.icon} alt="" style={{ width: 48, height: 48, borderRadius: 12 }} />}
                      <div>
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{profile.title}</h2>
                        <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)', margin: '4px 0 0' }}>{profile.packageName}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                      {profile.genre && <span className="tag">{profile.genre}</span>}
                      {profile.score != null && <span className="tag">★ {profile.score.toFixed(1)}</span>}
                      {profile.installs && <span className="tag">{profile.installs}</span>}
                    </div>
                    <button type="button" className="btn btn-primary" onClick={handleRefresh} disabled={refreshing} style={{ fontSize: 12, marginRight: 8 }}>
                      {refreshing ? <Spinner /> : '↻ Health Yenile'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 12 }}
                      onClick={() =>
                        router.push(
                          `/aso-audit?package=${encodeURIComponent(profile.packageName)}&language=${profile.country || 'tr'}&auto=1`
                        )
                      }
                    >
                      ◈ Full Audit
                    </button>
                    <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 8 }}>
                      Son analiz: {profile.lastScannedAt ? new Date(profile.lastScannedAt).toLocaleString('tr-TR') : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Kriter breakdown */}
              <div className="card">
                <div className="card-title">Health Score Kırılımı</div>
                <div className="criteria-grid">
                  {profile.healthBreakdown.criteria.map((c) => (
                    <div key={c.key} className="criteria-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{c.label}</span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>%{Math.round(c.weight * 100)} ağırlık</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${c.score}%`,
                              height: '100%',
                              background: HEALTH_COLOR_MAP[healthScoreColor(c.score)].stroke,
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', width: 28 }}>{c.score}</span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>{c.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid-2">
                {/* Son analizler */}
                <div className="card">
                  <div className="card-title">Son 3 Analiz</div>
                  {dashboard?.recentAnalyses.length ? (
                    <div className="stack" style={{ gap: 10 }}>
                      {dashboard.recentAnalyses.map((a) => (
                        <div key={a.id} style={{ padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span className="tag">{a.type === 'bulk-scan' ? 'Bulk Scan' : 'Health Refresh'}</span>
                            <span style={{ fontFamily: 'var(--mono)', color: HEALTH_COLOR_MAP[healthScoreColor(a.healthScore)].text }}>
                              {a.healthScore}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{fmtDate(a.analyzedAt)}</div>
                          <p style={{ fontSize: 12, color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>{a.summary}</p>
                          {a.opportunityAvg != null && (
                            <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6 }}>Ort. fırsat: {a.opportunityAvg}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--muted)' }}>Henüz analiz geçmişi yok.</p>
                  )}
                </div>

                {/* Hızlı aksiyonlar */}
                <div className="card">
                  <div className="card-title">Hızlı Aksiyonlar</div>
                  <div className="action-grid">
                    <button
                      type="button"
                      className="action-btn"
                      onClick={() => router.push(`/keywords/bulk-scan`)}
                    >
                      <span className="action-icon">✓</span>
                      <span>Yeni Bulk Scan</span>
                    </button>
                    <button
                      type="button"
                      className="action-btn"
                      onClick={() => router.push('/keywords/metadata-optimizer')}
                    >
                      <span className="action-icon">✦</span>
                      <span>Metadata Optimizer</span>
                    </button>
                    <button
                      type="button"
                      className="action-btn"
                      onClick={() =>
                        router.push(
                          selected
                            ? `/aso-audit?package=${encodeURIComponent(selected)}&language=tr&auto=1`
                            : '/aso-audit'
                        )
                      }
                    >
                      <span className="action-icon">◈</span>
                      <span>Full ASO Audit</span>
                    </button>
                    <button type="button" className="action-btn" onClick={() => router.push('/rivals')}>
                      <span className="action-icon">⊙</span>
                      <span>Rakip Analizi</span>
                    </button>
                    <button type="button" className="action-btn disabled" disabled title="Yakında">
                      <span className="action-icon">📈</span>
                      <span>Ranking Takibi</span>
                      <span className="action-badge">Yakında</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-title">Opportunity Trendi</div>
                {chartData.length >= 2 ? (
                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" />
                        <XAxis dataKey="date" stroke="#5a6480" fontSize={11} />
                        <YAxis stroke="#5a6480" fontSize={11} domain={[0, 100]} />
                        <Tooltip contentStyle={{ background: '#151820', border: '1px solid #2a3045', borderRadius: 6, fontSize: 12 }} />
                        <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                    Trend için en az 2 bulk scan veya health refresh gerekli.{' '}
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px', marginLeft: 4 }} onClick={() => router.push('/keywords/bulk-scan')}>
                      Bulk Scan başlat →
                    </button>
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </Layout>
  )
}
