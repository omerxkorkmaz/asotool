import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import Layout from '../components/Layout'

const LINE_COLORS = ['#4ade80', '#60a5fa', '#fb923c', '#f87171', '#a78bfa', '#fbbf24', '#34d399', '#f472b6']

export default function Trend() {
  const [appId, setAppId] = useState('')
  const [tracked, setTracked] = useState([])
  const [allHistory, setAllHistory] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('myAppId') || ''
    setAppId(saved)
    if (saved) loadData(saved)
  }, [])

  async function loadData(id) {
    setLoading(true)
    setError(null)
    try {
      const [trackedRes, historyRes] = await Promise.all([
        fetch(`/api/tracked?appId=${encodeURIComponent(id)}`),
        fetch(`/api/history?appId=${encodeURIComponent(id)}`),
      ])
      const trackedData = await trackedRes.json()
      const historyData = await historyRes.json()

      if (trackedData.error) { setError(trackedData.error); return }

      setTracked(trackedData.tracked || [])
      setAllHistory(historyData.allHistory || {})
    } catch (e) {
      setError('Veri yüklenemedi: ' + e.message)
    } finally { setLoading(false) }
  }

  async function removeKeyword(kw) {
    if (!confirm(`"${kw}" takipten çıkarılsın mı?`)) return
    await fetch('/api/tracked', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, keyword: kw })
    })
    loadData(appId)
  }

  async function runManualScan() {
    setRunning(true)
    try {
      const r = await fetch('/api/cron-scan')
      const d = await r.json()
      if (d.error) { alert(d.error); return }
      alert(`Tarama tamamlandı: ${d.totalScanned} kelime tarandı.`)
      loadData(appId)
    } finally { setRunning(false) }
  }

  // Grafik için veri birleştir: tüm tarihleri topla, her keyword için o tarihteki rank
  function buildChartData() {
    if (!allHistory) return []
    const dateSet = new Set()
    Object.values(allHistory).forEach(h => h.forEach(entry => dateSet.add(entry.date)))
    const dates = Array.from(dateSet).sort()

    return dates.map(date => {
      const row = { date: fmtShortDate(date) }
      Object.entries(allHistory).forEach(([kw, hist]) => {
        const entry = hist.find(h => h.date === date)
        row[kw] = entry?.rank ?? null
      })
      return row
    })
  }

  const chartData = buildChartData()
  const hasAnyData = chartData.length > 0
  const hasEnoughForTrend = chartData.length >= 2

  return (
    <Layout title="Sıralama Trendi" badge="Günlük Otomatik Takip">

      {!appId && (
        <div className="empty">
          <div className="icon">◈</div>
          <div>Önce Dashboard'dan package name'ini kaydet</div>
        </div>
      )}

      {appId && (
        <>
          <div className="card" style={{ marginBottom: 20, borderLeft: '3px solid var(--accent)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 12 }}>
                  ◈ BU SAYFA NE İŞE YARAR
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>
                    1. Ne ölçüyoruz?
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                    Takip ettiğin her kelime için, uygulamanın Google Play arama sonuçlarında <strong style={{ color: 'var(--text)' }}>kaçıncı sırada
                    çıktığını</strong> her gün otomatik kaydediyoruz. Bu sıralama; başlığın, açıklamanın, yorumların ve
                    rakiplerin durumuna göre günden güne değişir — bu sayfa o değişimi görünür kılar.
                  </p>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>
                    2. Nasıl çalışır (teknik akış)
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                    Keyword Tracker sayfasında bir kelime aratıp <strong style={{ color: 'var(--text)' }}>"+ Günlük Takip Et"</strong> butonuna
                    bastığında, o kelime bir veritabanına (Redis) kaydedilir. Vercel'in zamanlayıcısı (Cron Job) her gün
                    saat 06:00 UTC'de (Türkiye saatiyle yaz aylarında 09:00, kış aylarında 09:00 civarı) otomatik olarak
                    çalışır, takip listendeki tüm kelimeleri tek tek Play Store'da arar, uygulamanın o günkü sırasını
                    bulur ve geçmişe bir satır olarak ekler. Sen hiçbir şey yapmasan bile bu işlem arka planda kendiliğinden
                    devam eder.
                  </p>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>
                    3. Bu veri sana ne sağlar?
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                    Tek bir günün sırası ("bugün 47.sin") aslında çok az şey anlatır — o gün rastgele dalgalanma da olabilir.
                    Asıl değerli olan <strong style={{ color: 'var(--text)' }}>yöndür</strong>: başlığını değiştirdikten sonra sıra
                    düşüyor mu (iyileşiyor mu), yoksa rakiplerin önüne mi geçiyor? Bu sayfa olmadan bunu fark etmenin tek yolu
                    her gün elle arama yapıp not tutmaktı. Birkaç haftalık veri biriktiğinde, hangi ASO değişikliğinin işe
                    yarayıp yaramadığını gerçek veriyle görebileceksin — tahmin etmek yerine.
                  </p>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>
                    4. Şu an neden grafik boş/eksik görünebilir?
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                    Bir çizgi grafiği en az 2 farklı günün verisiyle anlamlı bir çizgi çizebilir. Daha yeni takibe aldıysan
                    elinde sadece bugünün verisi var — bu normal ve beklenen bir durum. Cron job her gün otomatik çalıştıkça
                    (veya sen "Şimdi Manuel Tara" ile farklı günlerde elle tetikledikçe) veri birikecek ve çizgi 2-3 gün
                    içinde belirginleşmeye başlayacak.
                  </p>
                </div>
              </div>
              <button className="btn btn-ghost" onClick={runManualScan} disabled={running} style={{ flexShrink: 0 }}>
                {running ? <span className="spinner" /> : 'Şimdi Manuel Tara'}
              </button>
            </div>
          </div>

          {error && (
            <div className="card" style={{ borderColor: 'var(--red)', marginBottom: 20 }}>
              <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{error}</div>
              {error.includes('Redis') && (
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
                  <strong>Kurulum adımları:</strong><br/>
                  1. Vercel projende → Storage sekmesi → Create Database → KV (Upstash Redis) seç<br/>
                  2. Oluştur ve projene bağla (environment variable'lar otomatik eklenir)<br/>
                  3. Projeyi yeniden deploy et (Redeploy)<br/>
                  4. Bu sayfayı yenile
                </div>
              )}
            </div>
          )}

          {loading && <div className="loading-row"><span className="spinner" /> Veriler yükleniyor...</div>}

          {!loading && tracked.length === 0 && !error && (
            <div className="empty">
              <div className="icon">⌕</div>
              <div>Henüz takip edilen kelime yok. Keyword Tracker sayfasından bir kelime aratıp takibe al.</div>
            </div>
          )}

          {!loading && tracked.length > 0 && (
            <>
              {/* Takip listesi */}
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-title">Takip Edilen Kelimeler ({tracked.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tracked.map((t, i) => {
                    const hist = allHistory?.[t.keyword] || []
                    const latest = hist[hist.length - 1]
                    const prev = hist[hist.length - 2]
                    const trend = latest && prev
                      ? (latest.rank && prev.rank ? latest.rank - prev.rank : null)
                      : null
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12,
                      }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: LINE_COLORS[i % LINE_COLORS.length] }} />
                        <span style={{ color: 'var(--text)' }}>{t.keyword}</span>
                        <span style={{ color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                          {latest?.rank ? `#${latest.rank}` : '—'}
                        </span>
                        {trend !== null && trend !== 0 && (
                          <span style={{ color: trend < 0 ? 'var(--accent)' : 'var(--red)' }}>
                            {trend < 0 ? `↑${Math.abs(trend)}` : `↓${trend}`}
                          </span>
                        )}
                        <span style={{ cursor: 'pointer', color: 'var(--muted)' }} onClick={() => removeKeyword(t.keyword)}>✕</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Grafik */}
              <div className="card">
                <div className="card-title">Sıralama Geçmişi (Düşük = İyi)</div>
                {!hasAnyData ? (
                  <div className="empty">
                    <div className="icon">📊</div>
                    <div>Henüz veri yok. İlk cron taraması çalıştıktan sonra (veya "Şimdi Manuel Tara" ile) grafik burada görünecek.</div>
                  </div>
                ) : !hasEnoughForTrend ? (
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
                      {tracked.map((t, i) => {
                        const hist = allHistory?.[t.keyword] || []
                        const latest = hist[hist.length - 1]
                        return (
                          <div key={t.keyword} style={{
                            flex: '1 1 200px', padding: 18, background: 'var(--bg)',
                            border: '1px solid var(--border)', borderRadius: 8,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                              <span style={{ width: 10, height: 10, borderRadius: 2, background: LINE_COLORS[i % LINE_COLORS.length] }} />
                              <span style={{ fontSize: 13, color: 'var(--text)' }}>{t.keyword}</span>
                            </div>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 36, fontWeight: 500, color: 'var(--text)', lineHeight: 1 }}>
                              {latest?.rank ? `#${latest.rank}` : '—'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                              {latest?.date ? fmtShortDate(latest.date) : ''} itibarıyla sıran
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ padding: 14, background: 'var(--blue-dim)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 16 }}>⏳</span>
                      <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}>
                        Henüz sadece <strong>1 günlük</strong> veri var, bu yüzden trend çizgisi çizilemiyor (en az 2 farklı
                        gün gerekir). Yukarıdaki rakamlar bugünkü gerçek sıralaman — doğru ve kullanılabilir. Cron job yarın
                        otomatik çalışınca (veya "Şimdi Manuel Tara" ile farklı bir günde tekrar tetiklersen) ikinci nokta
                        eklenecek ve aşağıda gerçek bir trend çizgisi belirmeye başlayacak.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{ width: '100%', height: 360 }}>
                    <ResponsiveContainer>
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e2330" />
                        <XAxis dataKey="date" stroke="#5a6480" fontSize={11} />
                        <YAxis stroke="#5a6480" fontSize={11} reversed allowDecimals={false}
                          label={{ value: 'Sıra', angle: -90, position: 'insideLeft', fill: '#5a6480', fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: '#151820', border: '1px solid #2a3045', borderRadius: 6, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {tracked.map((t, i) => (
                          <Line key={t.keyword} type="monotone" dataKey={t.keyword}
                            stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2}
                            connectNulls dot={{ r: 3 }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </Layout>
  )
}

function fmtShortDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}
