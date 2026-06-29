import { useState, useEffect } from 'react'
import Layout from '../components/Layout'

export default function Rivals() {
  const [input, setInput] = useState('')
  const [rivals, setRivals] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('rivals') || '[]')
    setRivals(saved)
  }, [])

  async function addRival() {
    const id = input.trim()
    if (!id || rivals.find(r => r.appId === id)) return
    setLoading(true)
    try {
      const r = await fetch(`/api/rival?appId=${encodeURIComponent(id)}`)
      const d = await r.json()
      if (d.error) { alert(d.error); return }
      const newRivals = [...rivals, d]
      setRivals(newRivals)
      localStorage.setItem('rivals', JSON.stringify(newRivals))
      setInput('')
    } finally { setLoading(false) }
  }

  function removeRival(appId) {
    const newR = rivals.filter(r => r.appId !== appId)
    setRivals(newR)
    localStorage.setItem('rivals', JSON.stringify(newR))
    if (selected?.appId === appId) setSelected(null)
  }

  const hist = selected?.histogram || {}
  const totalVotes = Object.values(hist).reduce((a, b) => a + b, 0) || 1

  return (
    <Layout title="Rakip Analizi" badge="Detaylı Karşılaştırma">
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Rakip Ekle</div>
        <div className="input-row">
          <input className="input" placeholder="Rakip package name (örn: com.rakip.uygulama)"
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRival()} />
          <button className="btn btn-primary" onClick={addRival} disabled={loading || !input}>
            {loading ? <span className="spinner" /> : '+ Ekle'}
          </button>
        </div>
      </div>

      {rivals.length === 0 && (
        <div className="empty"><div className="icon">⊙</div><div>Rakip uygulamaları ekleyin</div></div>
      )}

      {rivals.length > 0 && (
        <>
          {/* Karşılaştırma tablosu */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Karşılaştırma Tablosu</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Uygulama</th>
                    <th>Puan</th>
                    <th>Puanlama</th>
                    <th>İndirme</th>
                    <th>Kategori</th>
                    <th>Güncelleme</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rivals.map(r => (
                    <tr key={r.appId} style={{ cursor: 'pointer' }} onClick={() => setSelected(selected?.appId === r.appId ? null : r)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {r.icon && <img src={r.icon} style={{ width: 28, height: 28, borderRadius: 6 }} />}
                          <div>
                            <div style={{ color: 'var(--text)', fontSize: 13 }}>{r.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{r.developer}</div>
                          </div>
                        </div>
                      </td>
                      <td><span style={{ color: 'var(--warn)' }}>★ {r.score?.toFixed(1) ?? '—'}</span></td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>{fmtNum(r.ratings)}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>{r.installs ?? '—'}</td>
                      <td><span className="tag">{r.genre ?? '—'}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtDate(r.updated)}</td>
                      <td>
                        <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={e => { e.stopPropagation(); removeRival(r.appId) }}>Kaldır</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Seçili rakip detayı */}
          {selected && (
            <div className="stack">
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: -8 }}>
                Detay: <strong style={{ color: 'var(--text)' }}>{selected.title}</strong>
              </div>

              <div className="grid-2">
                {/* Histogram */}
                <div className="card">
                  <div className="card-title">Puan Dağılımı</div>
                  {[5,4,3,2,1].map(s => {
                    const cnt = hist[s] || 0
                    const pct = Math.round((cnt / totalVotes) * 100)
                    return (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)', width: 14 }}>{s}★</span>
                        <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: s >= 4 ? 'var(--accent)' : s === 3 ? 'var(--warn)' : 'var(--red)', borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--muted)', width: 36, textAlign: 'right', fontFamily: 'var(--mono)' }}>{pct}%</span>
                        <span style={{ fontSize: 11, color: 'var(--muted)', width: 48, textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtNum(cnt)}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Son güncellemeler */}
                <div className="card">
                  <div className="card-title">Son Güncelleme Notları</div>
                  <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
                    {selected.recentChanges || 'Güncelleme notu yok.'}
                  </p>
                </div>
              </div>

              {/* Açıklama */}
              <div className="card">
                <div className="card-title">Açıklama Metni</div>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {selected.description}
                </p>
              </div>
            </div>
          )}
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
