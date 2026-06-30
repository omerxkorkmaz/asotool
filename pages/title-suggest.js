import { useState, useEffect } from 'react'
import Layout from '../components/Layout'

export default function TitleSuggest() {
  const [appId, setAppId] = useState('')
  const [seedKeyword, setSeedKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('myAppId') || ''
    setAppId(saved)
  }, [])

  async function analyze() {
    if (!appId) return
    setLoading(true)
    setData(null)
    try {
      const r = await fetch('/api/title-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, seedKeyword: seedKeyword || undefined })
      })
      const d = await r.json()
      if (d.error) { alert(d.error); return }
      setData(d)
    } finally { setLoading(false) }
  }

  function copyText(text, key) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <Layout title="Başlık & Açıklama Önerisi" badge="ASO Metin Optimizasyonu">
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Analiz Et</div>
        <div className="input-row">
          <input className="input" placeholder="Package name" value={appId}
            onChange={e => setAppId(e.target.value)} />
          <input className="input" style={{ maxWidth: 260 }}
            placeholder="Aranacak kelime (boş bırakılırsa kategori kullanılır)"
            value={seedKeyword} onChange={e => setSeedKeyword(e.target.value)} />
          <button className="btn btn-primary" onClick={analyze} disabled={loading || !appId}>
            {loading ? <span className="spinner" /> : 'Analiz Et'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)' }}>
          Rakiplerini tarar, başlık/açıklamanda eksik olan ama rakiplerde sık geçen kelimeleri bulur ve
          (Gemini key'i varsa) somut başlık/özet önerisi üretir.
        </p>
      </div>

      {loading && <div className="loading-row"><span className="spinner" /> Rakipler taranıyor ve öneriler hazırlanıyor...</div>}

      {data && (
        <div className="stack">
          {!data.aiAvailable && (
            <div className="card" style={{ borderLeft: '3px solid var(--blue)' }}>
              <div style={{ fontSize: 12, color: 'var(--blue)', marginBottom: 6, fontWeight: 500 }}>ℹ AI ÖNERİ KAPALI</div>
              <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                Aşağıda eksik kelime listesi (rakip analizinden) görünüyor, ama somut başlık/açıklama metni önerisi için
                Gemini API key gerekiyor. <strong>GEMINI_API_KEY</strong> ortam değişkenini Vercel'e ekleyip redeploy edersen
                burada hazır başlık önerileri görünür.
              </p>
            </div>
          )}

          {/* Mevcut durum */}
          <div className="card">
            <div className="card-title">Mevcut Başlık & Özet</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>BAŞLIK</div>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>{data.myApp.title}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>ÖZET / ALT BAŞLIK</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{data.myApp.summary || '(boş)'}</div>
            </div>
          </div>

          {/* AI önerisi varsa */}
          {data.aiSuggestion && (
            <>
              <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
                <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 10, fontWeight: 500 }}>✦ MEVCUT BAŞLIK ANALİZİ</div>
                <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>{data.aiSuggestion.mevcut_baslik_analizi}</p>
              </div>

              <div className="card">
                <div className="card-title">Önerilen Başlıklar</div>
                <div className="stack">
                  {data.aiSuggestion.onerilen_basliklar?.map((s, i) => (
                    <div key={i} style={{ padding: 14, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{s.baslik}</span>
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={() => copyText(s.baslik, `title-${i}`)}>
                          {copied === `title-${i}` ? '✓ Kopyalandı' : 'Kopyala'}
                        </button>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{s.neden}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6, fontFamily: 'var(--mono)' }}>
                        {s.baslik.length} karakter
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid-2">
                <div className="card">
                  <div className="card-title">Önerilen Özet (Alt Başlık)</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, marginBottom: 10 }}>
                    {data.aiSuggestion.onerilen_ozet}
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                    onClick={() => copyText(data.aiSuggestion.onerilen_ozet, 'summary')}>
                    {copied === 'summary' ? '✓ Kopyalandı' : 'Kopyala'}
                  </button>
                </div>
                <div className="card">
                  <div className="card-title">Açıklama İlk Satır Önerisi</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, marginBottom: 10 }}>
                    {data.aiSuggestion.aciklama_ilk_satir_onerisi}
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                    onClick={() => copyText(data.aiSuggestion.aciklama_ilk_satir_onerisi, 'desc')}>
                    {copied === 'desc' ? '✓ Kopyalandı' : 'Kopyala'}
                  </button>
                </div>
              </div>

              {data.aiSuggestion.eklenmesi_gereken_kelimeler?.length > 0 && (
                <div className="card">
                  <div className="card-title">Eklenmesi Gereken Anahtar Kelimeler</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {data.aiSuggestion.eklenmesi_gereken_kelimeler.map((w, i) => (
                      <span key={i} className="tag" style={{ fontSize: 12, padding: '6px 12px' }}>{w}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Ham eksik kelime listesi (her zaman gösterilir) */}
          <div className="card">
            <div className="card-title">
              Rakiplerde Sık Geçen Ama Sende Olmayan Kelimeler ({data.rivalsScanned} rakip tarandı)
            </div>
            {data.missingWords.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Eksik kelime bulunamadı, mevcut metnin rakiplerle örtüşüyor.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {data.missingWords.map((w, i) => (
                  <div key={i} className="tag" style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {w.word}
                    <span style={{ opacity: 0.6, fontSize: 10 }}>{w.appearsIn}/{w.totalRivals} rakipte</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
