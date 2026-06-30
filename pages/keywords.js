import { useState, useEffect } from 'react'
import Layout from '../components/Layout'

export default function Keywords() {
  const [keyword, setKeyword] = useState('')
  const [appId, setAppId] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => {
    const saved = localStorage.getItem('myAppId') || ''
    setAppId(saved)
    const h = JSON.parse(localStorage.getItem('kwHistory') || '[]')
    setHistory(h)
  }, [])

  async function search() {
    if (!keyword.trim()) return
    setLoading(true)
    setResults(null)
    try {
      const url = `/api/keywords?q=${encodeURIComponent(keyword)}&appId=${encodeURIComponent(appId)}&num=100`
      const r = await fetch(url)
      const d = await r.json()
      if (d.error) { alert(d.error); return }
      setResults(d)

      // Geçmişe kaydet
      const entry = { keyword, myRank: d.myRank, date: new Date().toISOString() }
      const newH = [entry, ...history.filter(h => h.keyword !== keyword)].slice(0, 20)
      setHistory(newH)
      localStorage.setItem('kwHistory', JSON.stringify(newH))
    } finally { setLoading(false) }
  }

  return (
    <Layout title="Keyword Tracker" badge="Sıralama Takibi">
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Keyword Ara</div>
        <div className="input-row">
          <input className="input" placeholder="Keyword girin (örn: not defteri)" value={keyword}
            onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
          <input className="input" style={{ maxWidth: 280 }} placeholder="Package name (isteğe bağlı)" value={appId}
            onChange={e => setAppId(e.target.value)} />
          <button className="btn btn-primary" onClick={search} disabled={loading || !keyword}>
            {loading ? <span className="spinner" /> : 'Ara'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)' }}>Package name girerseniz kendi sıranız vurgulanır</p>
      </div>

      {/* Geçmiş */}
      {history.length > 0 && !results && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Arama Geçmişi</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {history.map((h, i) => (
              <div key={i} style={{ cursor: 'pointer', padding: '6px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                onClick={() => { setKeyword(h.keyword); }}>
                <span style={{ color: 'var(--text)' }}>{h.keyword}</span>
                {h.myRank && <span style={{ color: 'var(--accent)', marginLeft: 8, fontFamily: 'var(--mono)' }}>#{h.myRank}</span>}
                {!h.myRank && <span style={{ color: 'var(--muted)', marginLeft: 8 }}>—</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="loading-row"><span className="spinner" /> Arama sonuçları çekiliyor (Play Store'dan gerçek veri)...</div>}

      {results && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>"{results.keyword}" — {results.total} sonuç</div>
            {results.myRank
              ? <span className={`rank ${results.myRank === 1 ? 'rank-1' : results.myRank <= 10 ? 'rank-top10' : 'rank-top50'}`}>
                  Senin sıran: #{results.myRank}
                </span>
              : appId && <span className="rank rank-none">İlk {results.total}'de yok</span>
            }
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Uygulama</th>
                  <th>Geliştirici</th>
                  <th>Puan</th>
                  <th>İndirme</th>
                  <th>Ücret</th>
                </tr>
              </thead>
              <tbody>
                {results.results.map(a => (
                  <tr key={a.appId} style={a.isMe ? { background: 'var(--accent-dim)' } : {}}>
                    <td>
                      <span className={`rank ${a.rank === 1 ? 'rank-1' : a.rank <= 10 ? 'rank-top10' : a.rank <= 50 ? 'rank-top50' : ''}`}>
                        {a.rank}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {a.icon && <img src={a.icon} style={{ width: 28, height: 28, borderRadius: 6 }} />}
                        <div>
                          <div style={{ color: a.isMe ? 'var(--accent)' : 'var(--text)', fontSize: 13, fontWeight: a.isMe ? 600 : 400 }}>
                            {a.title} {a.isMe && '← SEN'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{a.appId}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{a.developer}</td>
                    <td>
                      <span style={{ color: 'var(--warn)', fontSize: 13 }}>★ {a.score?.toFixed(1) ?? '—'}</span>
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>{a.installs ?? '—'}</td>
                    <td><span className="tag">{a.free ? 'Ücretsiz' : 'Ücretli'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  )
}
