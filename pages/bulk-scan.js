import { useState, useEffect } from 'react'
import Layout from '../components/Layout'

const RENK_MAP = {
  yeşil:   { bg: 'var(--accent-dim)', text: 'var(--accent)', border: 'var(--accent)' },
  turuncu: { bg: 'var(--warn-dim)',   text: 'var(--warn)',   border: 'var(--warn)' },
  kırmızı: { bg: 'var(--red-dim)',    text: 'var(--red)',    border: 'var(--red)' },
  mavi:    { bg: 'var(--blue-dim)',   text: 'var(--blue)',   border: 'var(--blue)' },
  gri:     { bg: 'var(--border)',     text: 'var(--muted)',  border: 'var(--border2)' },
}

export default function BulkScan() {
  const [appId, setAppId] = useState('')
  const [seed, setSeed] = useState('')
  const [expanding, setExpanding] = useState(false)
  const [expansion, setExpansion] = useState(null)
  const [selectedKeywords, setSelectedKeywords] = useState([])
  const [manualKw, setManualKw] = useState('')

  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [openRow, setOpenRow] = useState(null)

  const [draftTitle, setDraftTitle] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [checkingDraft, setCheckingDraft] = useState(false)
  const [draftResult, setDraftResult] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('myAppId') || ''
    setAppId(saved)
  }, [])

  async function expandKeyword() {
    if (!seed.trim()) return
    setExpanding(true)
    setExpansion(null)
    setScanResult(null)
    try {
      const r = await fetch('/api/expand-keyword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: seed.trim() })
      })
      const d = await r.json()
      if (d.error) { alert(d.error); return }
      setExpansion(d)
      // Kök kelime + ilk 9 öneri otomatik seçili gelsin
      setSelectedKeywords([seed.trim(), ...d.suggestions.slice(0, 9).map(s => s.keyword)])
    } finally { setExpanding(false) }
  }

  function toggleKeyword(kw) {
    setSelectedKeywords(s => s.includes(kw) ? s.filter(x => x !== kw) : [...s, kw])
  }

  function addManual() {
    const kw = manualKw.trim().toLowerCase()
    if (!kw || selectedKeywords.includes(kw)) return
    setSelectedKeywords(s => [...s, kw])
    setManualKw('')
  }

  async function runScan() {
    if (selectedKeywords.length === 0) return
    setScanning(true)
    setScanResult(null)
    setDraftResult(null)
    try {
      const r = await fetch('/api/bulk-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: selectedKeywords.slice(0, 20), appId })
      })
      const d = await r.json()
      if (d.error) { alert(d.error); return }
      setScanResult(d)
    } finally { setScanning(false) }
  }

  async function checkDraft() {
    if (!draftTitle.trim() && !draftDescription.trim()) return
    if (!scanResult?.results?.length) return
    setCheckingDraft(true)
    setDraftResult(null)
    try {
      const r = await fetch('/api/check-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftTitle: draftTitle.trim(),
          draftDescription: draftDescription.trim(),
          scanResults: scanResult.results,
        })
      })
      const d = await r.json()
      if (d.error) { alert(d.error); return }
      setDraftResult(d)
    } finally { setCheckingDraft(false) }
  }

  return (
    <Layout title="Toplu Tarama & Aksiyon" badge="Keyword Genişletme + Strateji">

      {/* Adım 1: Kök kelime gir, genişlet */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">1. Adım — Kök Kelime Gir</div>
        <div className="input-row">
          <input className="input" placeholder="örn: iptv" value={seed}
            onChange={e => setSeed(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && expandKeyword()} />
          <input className="input" style={{ maxWidth: 260 }} placeholder="Package name" value={appId}
            onChange={e => setAppId(e.target.value)} />
          <button className="btn btn-primary" onClick={expandKeyword} disabled={expanding || !seed}>
            {expanding ? <span className="spinner" /> : 'Kelimeleri Bul'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)' }}>
          "iptv" yazarsan: Google'ın otomatik tamamlama önerilerini ve ilk 25 rakibin metninde en sık geçen kelimeleri bulup sana ilgili varyasyonlar önereceğiz.
        </p>
      </div>

      {expanding && <div className="loading-row"><span className="spinner" /> "{seed}" için ilgili kelimeler aranıyor...</div>}

      {/* Adım 2: Önerilen kelimeleri seç */}
      {expansion && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">2. Adım — Taramak İstediğin Kelimeleri Seç ({selectedKeywords.length} seçili)</div>

          {expansion.autocomplete.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--blue)', marginBottom: 8, fontWeight: 500 }}>
                ⌕ GOOGLE'IN ÖNERDİĞİ ARAMALAR (gerçek kullanıcı davranışı)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {expansion.autocomplete.map(kw => (
                  <Chip key={kw} kw={kw} selected={selectedKeywords.includes(kw)} onClick={() => toggleKeyword(kw)} />
                ))}
              </div>
            </div>
          )}

          {expansion.competitorWords.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8, fontWeight: 500 }}>
                ⊙ RAKİPLERİN SIK KULLANDIĞI KELİMELER (ilk {expansion.scannedCompetitors} rakipten çıkarıldı)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {expansion.competitorWords.map(w => (
                  <Chip key={w.suggestedKeyword} kw={w.suggestedKeyword}
                    extra={`${w.appearsIn}/${w.totalScanned} rakipte var`}
                    selected={selectedKeywords.includes(w.suggestedKeyword)}
                    onClick={() => toggleKeyword(w.suggestedKeyword)} />
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, fontWeight: 500 }}>+ MANUEL KELİME EKLE</div>
            <div className="input-row" style={{ marginBottom: 0 }}>
              <input className="input" placeholder="Kendi aklına gelen bir kelime varsa ekle"
                value={manualKw} onChange={e => setManualKw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addManual()} />
              <button className="btn btn-ghost" onClick={addManual}>Ekle</button>
            </div>
          </div>

          {selectedKeywords.length > 20 && (
            <p style={{ fontSize: 11, color: 'var(--warn)', marginTop: 8 }}>
              ⚠ En fazla 20 kelime taranabilir, ilk 20'si taranacak.
            </p>
          )}

          <button className="btn btn-primary" style={{ marginTop: 12, width: '100%' }}
            onClick={runScan} disabled={scanning || selectedKeywords.length === 0}>
            {scanning ? <span className="spinner" /> : `${Math.min(selectedKeywords.length, 20)} Kelimeyi Tara ve Aksiyon Planı Çıkar`}
          </button>
        </div>
      )}

      {scanning && <div className="loading-row"><span className="spinner" /> Kelimeler taranıyor ve aksiyon önerileri hazırlanıyor, bu biraz sürebilir...</div>}

      {/* Adım 3: Sonuçlar */}
      {scanResult && (
        <div className="stack">
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            <strong style={{ color: 'var(--text)' }}>{scanResult.total}</strong> kelime tarandı.
            En kolay kazanımlar üstte, en zor durumlar altta sıralı.
          </div>

          {scanResult.results.map((r, i) => {
            const c = RENK_MAP[r.renk] || RENK_MAP.gri
            const isOpen = openRow === i
            return (
              <div key={i} className="card" style={{ borderLeft: `3px solid ${c.border}`, cursor: 'pointer' }}
                onClick={() => setOpenRow(isOpen ? null : i)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{r.keyword}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: c.bg, color: c.text }}>
                        {r.durum}
                      </span>
                    </div>
                    {!r.error && (
                      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--muted)' }}>
                        <span>Sıran: <strong style={{ color: 'var(--text)' }}>{r.myRank ?? 'İlk 100\'de yok'}</strong></span>
                        <span>Fırsat Skoru: <strong style={{ color: c.text }}>{r.firsatSkoru}/100</strong></span>
                        <span>Tahmini Hacim: <strong style={{ color: 'var(--text)' }}>{r.hacimTahmini}</strong></span>
                        <span>{r.totalResults} rakip</span>
                      </div>
                    )}
                    {r.error && <span style={{ fontSize: 12, color: 'var(--red)' }}>Hata: {r.error}</span>}
                  </div>
                  <span style={{ color: 'var(--muted)', fontSize: 18 }}>{isOpen ? '−' : '+'}</span>
                </div>

                {isOpen && !r.error && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 }}>NEDEN BU DURUMDASIN</div>
                      <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{r.sebep}</p>
                    </div>
                    <div style={{ marginBottom: 12, padding: 12, background: c.bg, borderRadius: 6 }}>
                      <div style={{ fontSize: 11, color: c.text, marginBottom: 4, fontWeight: 500 }}>✓ NE YAPMALISIN</div>
                      <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{r.aksiyon}</p>
                    </div>
                    {r.top3?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>BU KELİMEDE İLK 3</div>
                        {r.top3.map(a => (
                          <div key={a.appId} style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 3 }}>
                            <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>#{a.rank}</span> {a.title}
                            <span style={{ marginLeft: 6 }}>({fmtNum(a.ratings)} rating)</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* ============ 3. ADIM: TASLAĞINI KONTROL ET ============ */}
          <div className="card" style={{ borderLeft: '3px solid var(--accent)', marginTop: 8 }}>
            <div className="card-title">3. Adım — Yayınlamadan Önce Taslağını Kontrol Et</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 16 }}>
              Yukarıda taradığın {scanResult.total} kelimeye göre, henüz Play Store'a basmadığın bir başlık/açıklama
              taslağını buraya yapıştır. Tekrar Play Store'u taramadan, sadece taslağın bu kelimeleri ne kadar iyi
              kapsadığını kontrol ederiz — yanlış çıkarsa düzeltip tekrar deneyebilirsin, hiçbir şey yayınlamadan.
            </p>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>TASLAK BAŞLIK</div>
              <input className="input" style={{ width: '100%' }} placeholder="Örn: Setbox IPTV Player – M3U & Xtream Codes..."
                value={draftTitle} onChange={e => setDraftTitle(e.target.value)} />
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, fontFamily: 'var(--mono)' }}>
                {draftTitle.length} karakter {draftTitle.length > 50 && <span style={{ color: 'var(--warn)' }}>(Play Store başlık limiti genelde 50)</span>}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>TASLAK AÇIKLAMA</div>
              <textarea className="input" style={{ width: '100%', minHeight: 160, fontFamily: 'inherit', resize: 'vertical' }}
                placeholder="Tam açıklama metnini buraya yapıştır..."
                value={draftDescription} onChange={e => setDraftDescription(e.target.value)} />
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, fontFamily: 'var(--mono)' }}>
                {draftDescription.length} karakter
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%' }}
              onClick={checkDraft} disabled={checkingDraft || (!draftTitle.trim() && !draftDescription.trim())}>
              {checkingDraft ? <span className="spinner" /> : 'Taslağı Kontrol Et'}
            </button>
          </div>

          {checkingDraft && (
            <div className="loading-row"><span className="spinner" /> Taslak, taranan {scanResult.total} kelimeyle karşılaştırılıyor ve analiz ediliyor...</div>
          )}

          {draftResult && (
            <div className="stack">
              {!draftResult.aiAvailable && (
                <div className="card" style={{ borderLeft: '3px solid var(--blue)' }}>
                  <div style={{ fontSize: 12, color: 'var(--blue)', marginBottom: 6, fontWeight: 500 }}>ℹ AI ANALİZ KAPALI</div>
                  <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                    Aşağıda kelime bazlı kontrol (her zaman çalışır) görünüyor. ASO skoru ve somut düzeltme önerileri için
                    <strong> GEMINI_API_KEY</strong> ortam değişkenini Vercel'e ekleyip redeploy etmen gerekiyor.
                  </p>
                </div>
              )}

              {draftResult.aiAnalysis && (
                <>
                  <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 40, fontWeight: 600, color: scoreColor(draftResult.aiAnalysis.aso_skoru) }}>
                        {draftResult.aiAnalysis.aso_skoru}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>ASO SKORU / 100</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{draftResult.totalKeywordsChecked} kelime baz alındı</div>
                      </div>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>{draftResult.aiAnalysis.genel_degerlendirme}</p>
                  </div>

                  {draftResult.aiAnalysis.risk_uyarilari?.length > 0 && (
                    <div className="card" style={{ borderLeft: '3px solid var(--red)' }}>
                      <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 10, fontWeight: 500 }}>⚠ RİSK UYARILARI</div>
                      <div className="stack">
                        {draftResult.aiAnalysis.risk_uyarilari.map((r, i) => (
                          <div key={i} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, padding: '8px 12px', background: 'var(--red-dim)', borderRadius: 6 }}>
                            {r}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid-2">
                    <div className="card">
                      <div className="card-title" style={{ color: 'var(--accent)' }}>✓ İyi Yapılanlar</div>
                      <div className="stack">
                        {draftResult.aiAnalysis.iyi_yapilanlar?.map((s, i) => (
                          <div key={i} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>• {s}</div>
                        ))}
                      </div>
                    </div>
                    <div className="card">
                      <div className="card-title" style={{ color: 'var(--warn)' }}>△ Kritik Eksikler</div>
                      <div className="stack">
                        {draftResult.aiAnalysis.kritik_eksikler?.map((s, i) => (
                          <div key={i} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>• {s}</div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-title">İyileştirilmiş Başlık Önerisi</div>
                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, marginBottom: 8 }}>
                      {draftResult.aiAnalysis.iyilestirilmis_baslik_onerisi}
                    </div>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => navigator.clipboard.writeText(draftResult.aiAnalysis.iyilestirilmis_baslik_onerisi)}>
                      Kopyala
                    </button>
                  </div>

                  <div className="card">
                    <div className="card-title">İyileştirilmiş Açıklama İlk Paragraf Önerisi</div>
                    <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, marginBottom: 8 }}>
                      {draftResult.aiAnalysis.iyilestirilmis_aciklama_ilk_paragraf_onerisi}
                    </p>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => navigator.clipboard.writeText(draftResult.aiAnalysis.iyilestirilmis_aciklama_ilk_paragraf_onerisi)}>
                      Kopyala
                    </button>
                  </div>
                </>
              )}

              {/* Kelime bazlı kontrol — her zaman gösterilir */}
              <div className="card">
                <div className="card-title">Kelime Bazlı Kapsama Kontrolü</div>
                <div className="grid-3" style={{ marginBottom: 16 }}>
                  <div style={{ textAlign: 'center', padding: 12, background: 'var(--accent-dim)', borderRadius: 8 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 24, color: 'var(--accent)', fontWeight: 600 }}>{draftResult.strongInDraft.length}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Güçlü Konumda</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 12, background: 'var(--warn-dim)', borderRadius: 8 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 24, color: 'var(--warn)', fontWeight: 600 }}>{draftResult.weakInDraft.length}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Zayıf Konumda</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: 12, background: 'var(--red-dim)', borderRadius: 8 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 24, color: 'var(--red)', fontWeight: 600 }}>{draftResult.missingInDraft.length}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Hiç Yok</div>
                  </div>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Kelime</th>
                        <th>Taslakta Durumu</th>
                        <th>Önceki Tarama Durumu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftResult.keywordChecks.map((k, i) => (
                        <tr key={i}>
                          <td style={{ fontSize: 13, color: 'var(--text)' }}>{k.keyword}</td>
                          <td>
                            {k.inTitle
                              ? <span className="tag" style={{ color: 'var(--accent)' }}>Başlıkta</span>
                              : k.inFirstLines
                                ? <span className="tag" style={{ color: 'var(--accent)' }}>İlk satırlarda</span>
                                : k.inDescription
                                  ? <span className="tag" style={{ color: 'var(--warn)' }}>Açıklamada (geç)</span>
                                  : <span className="tag" style={{ color: 'var(--red)' }}>Hiç yok</span>
                            }
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--muted)' }}>{k.previousDurum}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}

function scoreColor(score) {
  if (score >= 70) return 'var(--accent)'
  if (score >= 40) return 'var(--warn)'
  return 'var(--red)'
}

function Chip({ kw, extra, selected, onClick }) {
  return (
    <div onClick={onClick} style={{
      cursor: 'pointer', padding: '6px 12px', borderRadius: 6, fontSize: 12,
      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
      background: selected ? 'var(--accent-dim)' : 'var(--bg)',
      color: selected ? 'var(--accent)' : 'var(--muted)',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {selected ? '✓' : '+'} {kw}
      {extra && <span style={{ fontSize: 10, opacity: 0.7 }}>· {extra}</span>}
    </div>
  )
}

function fmtNum(n) {
  if (!n) return '0'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toString()
}
