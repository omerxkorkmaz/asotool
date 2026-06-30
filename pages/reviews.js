import { useState, useEffect } from 'react'
import Layout from '../components/Layout'

const STARS = [null, 1, 2, 3, 4, 5]
const SORTS = [
  { val: '1', label: 'En Faydalı' },
  { val: '2', label: 'En Yeni' },
  { val: '0', label: 'İlgili' },
]

const RENK_MAP = {
  yeşil:   { bg: 'var(--accent-dim)', text: 'var(--accent)', border: 'var(--accent)' },
  turuncu: { bg: 'var(--warn-dim)',   text: 'var(--warn)',   border: 'var(--warn)' },
  kırmızı: { bg: 'var(--red-dim)',    text: 'var(--red)',    border: 'var(--red)' },
  mavi:    { bg: 'var(--blue-dim)',   text: 'var(--blue)',   border: 'var(--blue)' },
  gri:     { bg: 'var(--border)',     text: 'var(--muted)',  border: 'var(--border2)' },
}

export default function Reviews() {
  const [appId, setAppId] = useState('')
  const [view, setView] = useState('list') // 'list' | 'categorized'

  const [sort, setSort] = useState('1')
  const [rating, setRating] = useState(null)
  const [reviews, setReviews] = useState(null)
  const [loading, setLoading] = useState(false)

  const [catData, setCatData] = useState(null)
  const [catLoading, setCatLoading] = useState(false)
  const [openCat, setOpenCat] = useState(null)

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

  async function fetchCategorized() {
    if (!appId) return
    setCatLoading(true)
    setCatData(null)
    try {
      const r = await fetch(`/api/categorize-reviews?appId=${encodeURIComponent(appId)}&num=200`)
      const d = await r.json()
      if (d.error) { alert(d.error); return }
      setCatData(d)
    } finally { setCatLoading(false) }
  }

  function switchView(v) {
    setView(v)
    if (v === 'categorized' && !catData && appId) fetchCategorized()
  }

  const starColor = s => s >= 4 ? 'var(--accent)' : s === 3 ? 'var(--warn)' : 'var(--red)'

  return (
    <Layout title="Yorum Madencisi" badge="Review Intelligence">
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Uygulama</div>
        <div className="input-row" style={{ marginBottom: 12 }}>
          <input className="input" placeholder="Package name" value={appId}
            onChange={e => setAppId(e.target.value)} />
        </div>
        <div className="tabs">
          <div className={`tab ${view === 'list' ? 'active' : ''}`} onClick={() => switchView('list')}>Tek Tek Oku</div>
          <div className={`tab ${view === 'categorized' ? 'active' : ''}`} onClick={() => switchView('categorized')}>Kategorilere Göre Özet</div>
        </div>
      </div>

      {view === 'list' && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
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
        </>
      )}

      {view === 'categorized' && (
        <>
          {catLoading && <div className="loading-row"><span className="spinner" /> Yorumlar analiz ediliyor (200 yorum kategorize ediliyor)...</div>}

          {!catLoading && !catData && appId && (
            <div className="card">
              <button className="btn btn-primary" onClick={fetchCategorized}>Analiz Et</button>
            </div>
          )}

          {catData && (
            <div className="stack">
              {!catData.aiAvailable && (
                <div className="card" style={{ borderLeft: '3px solid var(--blue)' }}>
                  <div style={{ fontSize: 12, color: 'var(--blue)', marginBottom: 6, fontWeight: 500 }}>ℹ AI ÖZET KAPALI</div>
                  <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                    Şu an sadece anahtar kelime eşleştirmesi ile kategorize ediliyor. Daha akıllı, bağlamı anlayan
                    özetler için ücretsiz bir Gemini API key alıp Vercel'de <strong>GEMINI_API_KEY</strong> ortam
                    değişkeni olarak ekleyebilirsin (aistudio.google.com/apikey adresinden 2 dakikada alınır).
                  </p>
                </div>
              )}

              {catData.aiSummary && (
                <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
                  <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 10, fontWeight: 500 }}>✦ AI ÖZETİ (Gemini)</div>
                  <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7, marginBottom: 16 }}>
                    {catData.aiSummary.ozet}
                  </p>
                  <div className="grid-2">
                    <div style={{ padding: 12, background: 'var(--red-dim)', borderRadius: 6 }}>
                      <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 4, fontWeight: 500 }}>EN BÜYÜK SORUN</div>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{catData.aiSummary.en_buyuk_sorun}</div>
                    </div>
                    <div style={{ padding: 12, background: 'var(--accent-dim)', borderRadius: 6 }}>
                      <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 4, fontWeight: 500 }}>EN BÜYÜK GÜÇ</div>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{catData.aiSummary.en_buyuk_guc}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, padding: 12, background: 'var(--blue-dim)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--blue)', marginBottom: 4, fontWeight: 500 }}>✓ ÖNCELİKLİ AKSİYON</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{catData.aiSummary.onerilen_aksiyon}</div>
                  </div>
                </div>
              )}

              <div className="card">
                <div className="card-title">{catData.totalReviews} Yorumun Kategori Dağılımı</div>
                <div className="stack">
                  {(catData.aiSummary?.kategoriler || catData.categories.map(c => ({
                    isim: c.label, yuzde: c.percentage, ornek_cumle: c.topReviews[0]?.text
                  }))).map((cat, i) => {
                    const matchedCat = catData.categories.find(c => c.label === cat.isim || c.category === cat.isim)
                    const color = RENK_MAP[matchedCat?.color] || RENK_MAP.gri
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, minWidth: 160 }}>{cat.isim}</span>
                          <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${cat.yuzde}%`, height: '100%', background: color.text, borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)', width: 36, textAlign: 'right' }}>{cat.yuzde}%</span>
                        </div>
                        {cat.ornek_cumle && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', marginLeft: 2, marginBottom: 8 }}>
                            "{cat.ornek_cumle.slice(0, 120)}{cat.ornek_cumle.length > 120 ? '...' : ''}"
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="card">
                <div className="card-title">Kategoriye Göre Örnek Yorumlar (Anahtar Kelime Eşleştirmesi)</div>
                <div className="stack">
                  {catData.categories.map((c, i) => {
                    const color = RENK_MAP[c.color] || RENK_MAP.gri
                    const isOpen = openCat === c.category
                    return (
                      <div key={c.category} style={{ borderLeft: `3px solid ${color.border}`, paddingLeft: 12, cursor: 'pointer' }}
                        onClick={() => setOpenCat(isOpen ? null : c.category)}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{c.label}</span>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: color.bg, color: color.text }}>
                              {c.count} yorum · ort. {c.avgScore}★
                            </span>
                          </div>
                          <span style={{ color: 'var(--muted)' }}>{isOpen ? '−' : '+'}</span>
                        </div>
                        {isOpen && (
                          <div className="stack" style={{ marginTop: 10, marginBottom: 14 }} onClick={e => e.stopPropagation()}>
                            {c.topReviews.map((r, ri) => (
                              <div key={ri} style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 10px', background: 'var(--bg)', borderRadius: 6 }}>
                                <span style={{ color: starColor(r.score) }}>{'★'.repeat(r.score)}</span> {r.text}
                                {r.thumbsUp > 0 && <span style={{ marginLeft: 6, opacity: 0.7 }}>· 👍{r.thumbsUp}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
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
