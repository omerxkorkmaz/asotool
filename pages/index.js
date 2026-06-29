import { useState, useEffect } from 'react'
import Layout from '../components/Layout'

export default function Dashboard() {
  const [appId, setAppId] = useState('')
  const [savedId, setSavedId] = useState('')
  const [appInfo, setAppInfo] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('myAppId')
    if (saved) { setSavedId(saved); setAppId(saved); fetchApp(saved) }
  }, [])

  async function fetchApp(id) {
    if (!id) return
    setLoading(true)
    try {
      const r = await fetch(`/api/rival?appId=${encodeURIComponent(id)}`)
      const d = await r.json()
      if (!d.error) { setAppInfo(d); setSavedId(id); localStorage.setItem('myAppId', id) }
      else alert(d.error)
    } finally { setLoading(false) }
  }

  const hist = appInfo?.histogram || {}
  const totalVotes = Object.values(hist).reduce((a, b) => a + b, 0) || 1

  return (
    <Layout title="Dashboard" badge="Genel Bakış">
      {/* App ID Ayarı */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Uygulamanızın Package Name'i</div>
        <div className="input-row">
          <input
            className="input"
            placeholder="com.sirket.uygulama"
            value={appId}
            onChange={e => setAppId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchApp(appId)}
          />
          <button className="btn btn-primary" onClick={() => fetchApp(appId)} disabled={loading || !appId}>
            {loading ? <span className="spinner" /> : 'Kaydet'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)' }}>
          Play Store URL'den bulunur: play.google.com/store/apps/details?id=<strong>com.sirket.uygulama</strong>
        </p>
      </div>

      {!appInfo && !loading && (
        <div className="empty">
          <div className="icon">◈</div>
          <div>Package name girerek uygulamanızı ekleyin</div>
        </div>
      )}

      {loading && <div className="loading-row"><span className="spinner" /> Uygulama bilgileri çekiliyor...</div>}

      {appInfo && (
        <>
          {/* App Header */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              {appInfo.icon && <img className="app-icon" src={appInfo.icon} style={{ width: 56, height: 56, borderRadius: 12 }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{appInfo.title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{appInfo.developer} · {appInfo.genre}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className="tag">{appInfo.contentRating}</span>
                  <span className="tag">{appInfo.free ? 'Ücretsiz' : `${appInfo.price}`}</span>
                  <span className="tag">v{appInfo.version}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid-4" style={{ marginBottom: 20 }}>
            <div className="card">
              <div className="stat-val stat-good">{appInfo.score?.toFixed(1) ?? '—'}</div>
              <div className="stat-label">⭐ Ortalama Puan</div>
            </div>
            <div className="card">
              <div className="stat-val">{fmtNum(appInfo.ratings)}</div>
              <div className="stat-label">Toplam Puanlama</div>
            </div>
            <div className="card">
              <div className="stat-val">{appInfo.installs ?? '—'}</div>
              <div className="stat-label">İndirme</div>
            </div>
            <div className="card">
              <div className="stat-val">{fmtDate(appInfo.updated)}</div>
              <div className="stat-label">Son Güncelleme</div>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: 20 }}>
            {/* Rating histogram */}
            <div className="card">
              <div className="card-title">Puan Dağılımı</div>
              {[5,4,3,2,1].map(s => {
                const cnt = hist[s] || 0
                const pct = Math.round((cnt / totalVotes) * 100)
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', width: 14 }}>{s}</span>
                    <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: s >= 4 ? 'var(--accent)' : s === 3 ? 'var(--warn)' : 'var(--red)', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--muted)', width: 32, textAlign: 'right', fontFamily: 'var(--mono)' }}>{pct}%</span>
                  </div>
                )
              })}
            </div>

            {/* Recent changes */}
            <div className="card">
              <div className="card-title">Son Güncelleme Notları</div>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
                {appInfo.recentChanges || 'Güncelleme notu yok.'}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="card">
            <div className="card-title">Açıklama (İlk 800 karakter)</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {appInfo.description}
            </p>
          </div>
        </>
      )}
    </Layout>
  )
}

function fmtNum(n) {
  if (!n) return '—'
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K'
  return n.toString()
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
}
