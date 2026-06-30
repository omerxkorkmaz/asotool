import { GoogleGenAI } from '@google/genai'

// Bu endpoint Play Store'a hiç istek atmaz — kullanıcının zaten Bulk Scan'de
// taradığı keyword sonuçlarını (frontend'den gönderilir) taslak metinle karşılaştırır.
// Böylece "taslağı kontrol et" anlık ve ücretsiz olur, tekrar Play Store taraması gerekmez.

function checkKeywordInDraft(keyword, title, description) {
  const kw = keyword.toLowerCase()
  const t = (title || '').toLowerCase()
  const d = (description || '').toLowerCase()
  const inTitle = t.includes(kw)
  // İlk 200 karakter "ilk satırlar" kabul edilir (Google'ın ağırlık verdiği bölge)
  const inFirstLines = d.slice(0, 200).includes(kw)
  const inDescription = d.includes(kw)
  // Kelime kaç kez geçiyor (basit sayım, üst üste binmeleri tam saymaz ama yeterli sinyal)
  const occurrences = d.split(kw).length - 1 + (t.split(kw).length - 1)

  return { keyword, inTitle, inFirstLines, inDescription, occurrences }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { draftTitle, draftDescription, scanResults } = req.body
  if (!draftTitle && !draftDescription) {
    return res.status(400).json({ error: 'draftTitle veya draftDescription zorunlu' })
  }
  if (!scanResults?.length) {
    return res.status(400).json({ error: 'scanResults zorunlu — önce Toplu Tarama çalıştırılmalı' })
  }

  // 1) Her taranan kelime için taslakta durumu hesapla (hızlı, kural tabanlı, her zaman çalışır)
  const keywordChecks = scanResults
    .filter(r => !r.error)
    .map(r => {
      const check = checkKeywordInDraft(r.keyword, draftTitle, draftDescription)
      return {
        ...check,
        previousDurum: r.durum,
        previousFirsatSkoru: r.firsatSkoru,
        myRank: r.myRank,
      }
    })

  // Bozuk/anlamsız kelime tespiti: aynı kökü birden fazla kez içeren veya 5+ kelimelik
  // öbekler genelde "iptv, iptv player" gibi yanlışlıkla birleştirilmiş girdilerdir, gerçek
  // arama terimi değildir. Bunları ayrı işaretliyoruz ki hem ekranda hem Gemini'ye gönderirken
  // yanıltıcı "kritik eksik" gibi görünmesinler.
  function looksMalformed(keyword) {
    const words = keyword.trim().split(/\s+/)
    if (words.length >= 5) return true
    const lower = words.map(w => w.toLowerCase().replace(/[,.-]/g, ''))
    const uniqueRatio = new Set(lower).size / lower.length
    if (lower.length >= 3 && uniqueRatio < 0.6) return true // aynı kelime tekrar tekrar geçiyor
    return false
  }

  const validChecks = keywordChecks.filter(k => !looksMalformed(k.keyword))
  const malformedChecks = keywordChecks.filter(k => looksMalformed(k.keyword))

  const missingInDraft = validChecks.filter(k => !k.inTitle && !k.inDescription)
  const weakInDraft = validChecks.filter(k => (k.inDescription && !k.inFirstLines) && !k.inTitle)
  const strongInDraft = validChecks.filter(k => k.inTitle || k.inFirstLines)

  // 2) Gemini ile derin analiz (key varsa)
  let aiAnalysis = null
  const apiKey = process.env.GEMINI_API_KEY
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey })

      const keywordSummary = validChecks.map(k =>
        `- "${k.keyword}" (önceki tarama durumu: ${k.previousDurum}, fırsat skoru: ${k.previousFirsatSkoru}/100) → taslakta: ${k.inTitle ? 'BAŞLIKTA VAR' : k.inFirstLines ? 'İLK SATIRLARDA VAR' : k.inDescription ? 'AÇIKLAMADA VAR (geç konumda)' : 'HİÇ YOK'}`
      ).join('\n')

      const prompt = `Sen bir Google Play ASO (App Store Optimization) uzmanısın. Bir geliştirici henüz YAYINLAMADIĞI bir başlık ve açıklama taslağı hazırladı. Bu taslağı, daha önce yaptığı keyword (anahtar kelime) taramasının sonuçlarına göre değerlendir.

TASLAK BAŞLIK:
${draftTitle || '(girilmedi)'}

TASLAK AÇIKLAMA:
${draftDescription || '(girilmedi)'}

DAHA ÖNCE TARANAN KELİMELER VE TASLAKTAKİ DURUMU:
${keywordSummary || '(geçerli kelime bulunamadı)'}

ÖNEMLİ UYARI: Yukarıdaki kelime listesinde hâlâ anlamsız, gerçek bir kullanıcının asla aramayacağı türden
öbekler görürsen (örneğin aynı kelimenin art arda tekrarı, virgülle birleştirilmiş iki farklı arama terimi,
5+ kelimelik anlamsız diziler) bunları analiz dışı bırak, "kritik eksik" olarak gösterme ve bunlardan skor
düşürme. Sadece gerçekçi, bir kullanıcının Play Store'da gerçekten yazabileceği türden kelime/öbekleri dikkate al.

GÖREV: SADECE aşağıdaki JSON formatında yanıt ver, başka metin ekleme.

{
  "aso_skoru": 0-100 arası tek bir sayı (taslağın taranan GEÇERLİ kelimeleri ne kadar iyi kapsadığına göre),
  "genel_degerlendirme": "2-3 cümlelik özet: taslak genel olarak iyi mi, neyi kaçırıyor",
  "iyi_yapilanlar": ["taslağın doğru yaptığı 2-3 somut şey"],
  "kritik_eksikler": ["en önemli 2-4 eksik veya risk, her biri somut ve aksiyona dönüştürülebilir, sadece geçerli kelimelere dayalı"],
  "risk_uyarilari": ["varsa: marka ihlali riski, yasaklı kelime, telif riski, ban riski gibi politika uyarıları — yoksa boş array"],
  "iyilestirilmis_baslik_onerisi": "taslağı temel alan, eksikleri gideren somut bir başlık önerisi (50 karakter altı)",
  "iyilestirilmis_aciklama_ilk_paragraf_onerisi": "taslağın açıklama ilk paragrafını temel alan, eksik kelimeleri doğal şekilde ekleyen geliştirilmiş bir versiyon (2-4 cümle)"
}

Önemli kurallar: Rakip marka/uygulama isimlerini (örn. başka bir uygulamanın adı) metne eklemeyi ASLA önerme, bu marka ihlali riski taşır. Sadece jenerik, kategoriyi tanımlayan kelimeleri öner. Taslağın tonunu ve markasını koru, baştan yazma.`

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      })
      aiAnalysis = JSON.parse(response.text)
    } catch (err) {
      console.error('Gemini taslak analiz hatası:', err.message)
      aiAnalysis = null
    }
  }

  return res.status(200).json({
    titleLength: (draftTitle || '').length,
    descriptionLength: (draftDescription || '').length,
    totalKeywordsChecked: validChecks.length,
    missingInDraft,
    weakInDraft,
    strongInDraft,
    keywordChecks: validChecks,
    malformedChecks, // ekranda "bunlar analiz dışı bırakıldı" diye gösterilebilir
    aiAnalysis,
    aiAvailable: !!apiKey,
  })
}
