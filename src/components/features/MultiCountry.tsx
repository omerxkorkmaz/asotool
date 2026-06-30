// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import type { MultiCountryResponse } from '@/types/api'

const COUNTRY_PRESETS = [
  { gl: 'tr', label: 'Türkiye', flag: '🇹🇷' },
  { gl: 'us', label: 'ABD', flag: '🇺🇸' },
  { gl: 'gb', label: 'İngiltere', flag: '🇬🇧' },
  { gl: 'de', label: 'Almanya', flag: '🇩🇪' },
  { gl: 'fr', label: 'Fransa', flag: '🇫🇷' },
  { gl: 'es', label: 'İspanya', flag: '🇪🇸' },
  { gl: 'it', label: 'İtalya', flag: '🇮🇹' },
  { gl: 'br', label: 'Brezilya', flag: '🇧🇷' },
  { gl: 'pt', label: 'Portekiz', flag: '🇵🇹' },
  { gl: 'ru', label: 'Rusya', flag: '🇷🇺' },
  { gl: 'sa', label: 'Suudi Arabistan', flag: '🇸🇦' },
  { gl: 'ae', label: 'BAE', flag: '🇦🇪' },
  { gl: 'eg', label: 'Mısır', flag: '🇪🇬' },
  { gl: 'in', label: 'Hindistan', flag: '🇮🇳' },
  { gl: 'id', label: 'Endonezya', flag: '🇮🇩' },
  { gl: 'pk', label: 'Pakistan', flag: '🇵🇰' },
  { gl: 'nl', label: 'Hollanda', flag: '🇳🇱' },
  { gl: 'pl', label: 'Polonya', flag: '🇵🇱' },
  { gl: 'mx', label: 'Meksika', flag: '🇲🇽' },
  { gl: 'ar', label: 'Arjantin', flag: '🇦🇷' },
  { gl: 'jp', label: 'Japonya', flag: '🇯🇵' },
  { gl: 'kr', label: 'G. Kore', flag: '🇰🇷' },
]

const QUICK_SETS = {
  'Avrupa': ['de', 'fr', 'es', 'it', 'gb', 'nl', 'pl'],
  'Orta Doğu': ['sa', 'ae', 'eg', 'tr'],
  'Amerika': ['us', 'br', 'mx', 'ar'],
  'Asya': ['in', 'id', 'pk', 'jp', 'kr'],
}

export default function MultiCountry() {
  const [keyword, setKeyword] = useState('')
  const [appId, setAppId] = useState('')
  const [selected, setSelected] = useState(['tr', 'us', 'de', 'sa', 'br'])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<MultiCountryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('myAppId') || ''
    setAppId(saved)
  }, [])

  function toggleCountry(gl) {
    setSelected(s => s.includes(gl) ? s.filter(x => x !== gl) : [...s, gl])
  }

  function applyQuickSet(name) {
    setSelected(QUICK_SETS[name])
  }

  async function scan() {
    if (!keyword.trim() || selected.length === 0) return
    setLoading(true)
    setData(null)
    setError(null)
    try {
      const r = await fetch('/api/multi-country', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, appId, countries: selected })
      })
      const d = await r.json()
      if (d.error) { setError(d.error); return }
      setData(d)
    } catch (e) {
      setError('İstek başarısız: ' + e.message)
    } finally { setLoading(false) }
  }

  return (
    <Layout title="Çoklu Ülke Tarama" badge="Global Keyword Radar">
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">Keyword & Hedef Ülkeler</div>
        <div className="input-row">
          <input className="input" placeholder="Keyword (örn: iptv, live tv, canlı tv)"
            value={keyword} onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && scan()} />
          <input className="input" style={{ maxWidth: 260 }} placeholder="Package name (isteğe bağlı)"
            value={appId} onChange={e => setAppId(e.target.value)} />
          <button className="btn btn-primary" onClick={scan} disabled={loading || !keyword || selected.length === 0}>
            {loading ? <span className="spinner" /> : `${selected.length} Ülkede Tara`}
          </button>
        </div>

        {/* Quick sets */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {Object.keys(QUICK_SETS).map(name => (
            <button key={name} className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }}
              onClick={() => applyQuickSet(name)}>{name}</button>
          ))}
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }}
            onClick={() => setSelected(COUNTRY_PRESETS.map(c => c.gl))}>Tümünü Seç</button>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 10px' }}
            onClick={() => setSelected([])}>Temizle</button>
        </div>

        {/* Country chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {COUNTRY_PRESETS.map(c => (
            <div key={c.gl}
              onClick={() => toggleCountry(c.gl)}
              style={{
                cursor: 'pointer', padding: '6px 12px', borderRadius: 6, fontSize: 12,
                border: `1px solid ${selected.includes(c.gl) ? 'var(--accent)' : 'var(--border)'}`,
                background: selected.includes(c.gl) ? 'var(--accent-dim)' : 'var(--bg)',
                color: selected.includes(c.gl) ? 'var(--accent)' : 'var(--muted)',
              }}>
              {c.flag} {c.label}
            </div>
          ))}
        </div>

        {selected.length > 10 && (
          <p style={{ fontSize: 11, color: 'var(--warn)', marginTop: 10 }}>
            ⚠ 10'dan fazla ülke seçtiniz — Vercel free plan timeout riski olabilir (10sn limit). Daha az ülkeyle deneyin veya birkaç gruba bölün.
          </p>
        )}
      </div>

      {loading && (
        <div className="loading-row">
          <span className="spinner" /> {selected.length} ülkede "{keyword}" taranıyor, bu biraz sürebilir...
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: 'var(--red)' }}>
          <span style={{ color: 'var(--red)' }}>{error}</span>
        </div>
      )}

      {data && (
        <div className="card">
          <div className="card-title">"{data.keyword}" — {data.scannedCountries} Ülke Sonucu</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ülke</th>
                  <th>Senin Sıran</th>
                  <th>O Ülkede İlk 3</th>
                </tr>
              </thead>
              <tbody>
                {data.results
                  .sort((a, b) => (a.myRank ?? 999) - (b.myRank ?? 999))
                  .map(r => (
                  <tr key={r.gl}>
                    <td style={{ fontWeight: 500 }}>{r.country}</td>
                    <td>
                      {r.error
                        ? <span className="tag" style={{ color: 'var(--red)' }}>Hata</span>
                        : r.myRank
                          ? <span className={`rank ${r.myRank <= 3 ? 'rank-1' : r.myRank <= 10 ? 'rank-top10' : 'rank-top50'}`}>#{r.myRank}</span>
                          : appId ? <span className="rank rank-none">İlk 50'de yok</span> : <span style={{ color: 'var(--muted)' }}>—</span>
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {r.top5?.slice(0, 3).map(a => (
                          <div key={a.appId} style={{ fontSize: 11, color: 'var(--muted)' }}>
                            <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>#{a.rank}</span> {a.title}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Insight */}
          <div style={{ marginTop: 20, padding: 14, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 6, fontWeight: 500 }}>💡 NE ANLAMA GELİYOR</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
              Aynı kelime farklı ülkelerde farklı rekabet yoğunluğu gösteriyor. Senin sıranın iyi olduğu ülkeler organik fırsat —
              o pazarlarda lokalize ASO yatırımı yapmaya değer. Sıranın kötü/yok olduğu ülkelerde ise ya kelime o dilde
              farklı aratılıyor (örn. "iptv" yerine yerel terim), ya da rekabet güçlü. Bu durumda o ülkenin yerel
              terimini ayrıca taramayı dene (örn. Brezilya'da "tv ao vivo").
            </p>
          </div>
        </div>
      )}
    </Layout>
  )
}
