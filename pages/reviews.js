import { useState, useEffect } from 'react'
import Layout from '../components/Layout'

const STARS = [null, 1, 2, 3, 4, 5]
const SORTS = [
  { val: '1', label: 'En Faydalı' },
  { val: '2', label: 'En Yeni' },
  { val: '0', label: 'İlgili' },
]

export default function Reviews() {
  const [appId, setAppId] = useState('')
  const [sort, setSort] = useState('1')
  const [rating, setRating] = useState(null)
  const [reviews, setReviews] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('myAppId') || ''
    setAppId(saved)
  }, [])

  async function fetchReviews() {
    if (!appId) return
    setLoading(true)
    setReviews(null)
    try {
      let url = `/api/reviews?appId=${encodeURIComponent(appId)}&sort=${sort}&num=100`
      if (rating) url += `&rating=${rating}`
      const r = await fetch(url)
      const d = await r.json()
      if (d.error) { alert(d.error); return }
      setReviews(d)
    } finally { setLoading(false) }
  }

  const starColor = s => s >= 4 ? 'var(--accent)' : s === 3 ? 'var(--warn)' : 'var(--red)'

  return (
    <Layout title="Yorum Madencisi" badge="Review Intelligence">
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Yorumları Çek</div>
        <div className="input-row">
          <input className="input" placeholder="Package name" value={appId}
            onChange={e => setAppId(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Sıralama</div>
            <div className="tabs">
              {SORTS.map(s => (
                <div key={s.val} className={`tab ${sort === s.val ? 'active' : ''}`} onClick={() => setSort(s.val)}>{s.label}</div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Yıldız Filtresi</div>
            <div className="tabs">
              {STARS.map(s => (
                <div key={s ?? 'all'} className={`tab ${rating === s ? 'active' : ''}`} onClick={() => setRating(s)}>
                  {s ? `${s}★` : 'Tümü'}
                </div>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" style={{ alignSelf: 'flex-end', marginBottom: 1 }}
            onClick={fetchReviews} disabled={loading || !appId}>
            {loading ? <span className="spinner" /> : 'Çek'}
          </button>
        </div>
      </div>

      {loading && <div className="loading-row"><span className="spinner" /> Yorumlar çekiliyor...</div>}

      {reviews && (
        <>
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--muted)' }}>
            <strong style={{ color: 'var(--text)' }}>{reviews.total}</strong> yorum bulundu
            {rating && <span> · {rating}★ filtreli</span>}
          </div>
          <div className="stack">
            {reviews.reviews.map((r, i) => (
              <div key={r.id ?? i} className="review-card">
                <div className="review-meta">
                  <span style={{ color: starColor(r.score), fontWeight: 600 }}>{'★'.repeat(r.score)}{'☆'.repeat(5 - r.score)}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{r.userName}</span>
                  <span>·</span>
                  <span>{fmtDate(r.date)}</span>
                </div>
                <div className="review-text">{r.text}</div>
                {r.thumbsUp > 0 && (
                  <div className="review-likes">👍 {r.thumbsUp} kişi faydalı buldu</div>
                )}
                {r.replyText && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--surface)', borderRadius: 6, borderLeft: '2px solid var(--accent)' }}>
                    <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>Geliştirici yanıtı · {fmtDate(r.replyDate)}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.replyText}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  )
}

function fmtDate(ts) {
  if (!ts) return '—'
  try { return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return ts }
}
