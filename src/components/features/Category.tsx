// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/layout/Layout'

const CATEGORIES = [
  { id: 'APPLICATION', label: 'Genel Uygulamalar' },
  { id: 'PRODUCTIVITY', label: 'Verimlilik' },
  { id: 'EDUCATION', label: 'Eğitim' },
  { id: 'ENTERTAINMENT', label: 'Eğlence' },
  { id: 'TOOLS', label: 'Araçlar' },
  { id: 'COMMUNICATION', label: 'İletişim' },
  { id: 'SOCIAL', label: 'Sosyal' },
  { id: 'FINANCE', label: 'Finans' },
  { id: 'HEALTH_AND_FITNESS', label: 'Sağlık & Fitness' },
  { id: 'SHOPPING', label: 'Alışveriş' },
  { id: 'TRAVEL_AND_LOCAL', label: 'Seyahat & Yerel' },
  { id: 'FOOD_AND_DRINK', label: 'Yiyecek & İçecek' },
  { id: 'BUSINESS', label: 'İş' },
  { id: 'LIFESTYLE', label: 'Yaşam Tarzı' },
  { id: 'GAME', label: 'Oyunlar' },
]

const COLLECTIONS = [
  { id: 'TOP_FREE', label: 'En Çok İndirilen (Ücretsiz)' },
  { id: 'TOP_PAID', label: 'En Çok İndirilen (Ücretli)' },
  { id: 'GROSSING', label: 'En Çok Kazanan' },
  { id: 'NEW_FREE', label: 'Yeni Ücretsiz' },
  { id: 'NEW_PAID', label: 'Yeni Ücretli' },
]

export default function Category() {
  const [category, setCategory] = useState('APPLICATION')
  const [collection, setCollection] = useState('TOP_FREE')
  const [appId, setAppId] = useState('')
  const [results, setResults] = useState<{
    category: string
    collection: string
    myRank: number | null
    total: number
    results: Array<{ rank: number; appId: string; title: string; developer: string; score?: number; installs?: string; icon?: string; isMe: boolean }>
  } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('myAppId') || ''
    setAppId(saved)
  }, [])

  async function fetchList() {
    setLoading(true)
    setResults(null)
    try {
      const url = `/api/category?category=${category}&collection=${collection}&country=tr&num=50&appId=${encodeURIComponent(appId)}`
      const r = await fetch(url)
      const d = await r.json()
      if (d.error) { alert(d.error); return }
      setResults(d)
    } finally { setLoading(false) }
  }

  return (
    <Layout title="Kategori Radar" badge="Top Listeler">
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Filtreler</div>
        <div className="grid-2" style={{ marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Kategori</div>
            <select className="input" value={category} onChange={e => setCategory(e.target.value)}
              style={{ cursor: 'pointer' }}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Liste Türü</div>
            <select className="input" value={collection} onChange={e => setCollection(e.target.value)}
              style={{ cursor: 'pointer' }}>
              {COLLECTIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div className="input-row">
          <input className="input" placeholder="Kendi package name'in (isteğe bağlı)" value={appId}
            onChange={e => setAppId(e.target.value)} />
          <button className="btn btn-primary" onClick={fetchList} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Listele'}
          </button>
        </div>
      </div>

      {loading && <div className="loading-row"><span className="spinner" /> Top liste çekiliyor...</div>}

      {results && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>
              {CATEGORIES.find(c => c.id === results.category)?.label} — {COLLECTIONS.find(c => c.id === results.collection)?.label}
            </div>
            {results.myRank
              ? <span className={`rank ${results.myRank <= 3 ? 'rank-1' : results.myRank <= 10 ? 'rank-top10' : 'rank-top50'}`}>
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
                </tr>
              </thead>
              <tbody>
                {results.results.map(a => (
                  <tr key={a.appId} style={a.isMe ? { background: 'var(--accent-dim)' } : {}}>
                    <td>
                      <span className={`rank ${a.rank <= 3 ? 'rank-1' : a.rank <= 10 ? 'rank-top10' : 'rank-top50'}`}>
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
                    <td><span style={{ color: 'var(--warn)' }}>★ {a.score?.toFixed(1) ?? '—'}</span></td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>{a.installs ?? '—'}</td>
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
