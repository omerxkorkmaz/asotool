import { GoogleGenAI } from '@google/genai'

// MİMARİ
// =======
// Bu endpoint iki katmanlı bir filtreleme + analiz yapar:
//
// KATMAN 1 — YAPISAL FİLTRE (kod, kategori/dil bağımsız)
// Sadece "matematiksel olarak kesin bozuk" olanları yakalar:
//   • 5+ kelimelik öbekler (büyük ihtimalle yanlışlıkla birleşmiş girdiler)
//   • Aynı kelimenin 3+ kez tekrarı (örn. "iptv iptv player iptv")
//   • "Düşük Hacim" etiketi (Bulk Scan zaten az sonuç tespit etmiş)
// Bu katman dil/kategori bilmeden çalışır, Gemini key olmasa bile aktiftir.
//
// KATMAN 2 — SEMANTİK FİLTRE (Gemini, kategori/dil bağımsız)
// Gemini'ye verilen kelimelerden hangileri:
//   • Marka adı / rakip uygulama adı
//   • Kişi adı / geliştirici adı
//   • Anlamsız harf dizisi (örn. "iptval", "iptvalways")
//   • Hedef dilde gerçek bir kullanıcının asla aramayacağı kombinasyon
// olduğunu söyler. Gemini her dilde, her kategoride bunu yapabilir — sabit liste tutmaktan
// çok daha esnek ve sürdürülebilir. Gemini key yoksa sadece Katman 1 çalışır.
//
// SKOR HESABI
// İki katmandan geçtikten sonra kalan "gerçekten geçerli" kelimeler üzerinden, kod tarafında
// matematiksel olarak hesaplanır. Gemini'nin sezgisel sayı üretmesine izin verilmez.

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

// KATMAN 1: kategori/dil bağımsız yapısal kontroller
function isStructurallyMalformed(keyword) {
  const words = keyword.trim().split(/\s+/)

  // 5+ kelimelik öbek — gerçek arama terimleri nadiren bu kadar uzun olur,
  // genelde "iptv, iptv player m3u support" gibi yanlış birleştirmelerdir.
  if (words.length >= 5) return { malformed: true, reason: 'çok uzun öbek (5+ kelime)' }

  // Aynı kelimenin anormal tekrarı (3+ kelimede %60'tan fazla aynı kelime)
  const lower = words.map(w => w.toLowerCase().replace(/[,.-]/g, ''))
  const uniqueRatio = new Set(lower).size / lower.length
  if (lower.length >= 3 && uniqueRatio < 0.6) {
    return { malformed: true, reason: 'aynı kelime tekrar tekrar geçiyor' }
  }

  return { malformed: false }
}

// KATMAN 2: Gemini ile semantik filtreleme. Tek bir çağrıda hem geçersiz kelimeleri
// işaretler hem de değerlendirme + öneri üretir. Tek çağrı = düşük maliyet + tutarlı durum.
async function analyzeWithGemini({ ai, draftTitle, draftDescription, candidateKeywords, language, asoSkoruInitial }) {
  // Gemini'ye her kelimenin taslakta nerede geçtiğini de gönderiyoruz ki hem geçersizleri
  // işaretlerken hem de değerlendirme yaparken aynı bağlamı kullansın.
  const keywordList = candidateKeywords.map(k => {
    const status = k.inTitle ? 'GÜÇLÜ (başlıkta)'
      : k.inFirstLines ? 'GÜÇLÜ (açıklama ilk satırlarında)'
      : k.inDescription ? 'ZAYIF (açıklamada geç konumda)'
      : 'HİÇ YOK'
    return `- "${k.keyword}" → ${status}`
  }).join('\n')

  const prompt = `Sen bir Google Play ASO (App Store Optimization) uzmanısın. Bir geliştirici henüz YAYINLAMADIĞI bir başlık + açıklama taslağı hazırladı (dil: ${language}). Bu taslağı değerlendireceksin.

TASLAK BAŞLIK:
${draftTitle || '(girilmedi)'}

TASLAK AÇIKLAMA:
${draftDescription || '(girilmedi)'}

KELİMELER VE TASLAKTAKİ DURUMU:
${keywordList || '(kelime listesi boş)'}

═══════════════════════════════════════════════════════
GÖREV 1 — GEÇERSİZ KELİMELERİ AYIKLA
═══════════════════════════════════════════════════════
Yukarıdaki kelime listesinde aşağıdaki türde olanları "geçersiz" olarak işaretle:
- Rakip uygulama markaları / tescilli marka isimleri (örn. başka bir bilinen uygulamanın adı)
- Kişi adı / geliştirici adı / yayıncı adı görünümünde olanlar
- Anlamsız harf dizileri (örn. gerçek bir kelime olmayan "iptval" gibi typo kombinasyonları)
- ${language} dilinde gerçek bir kullanıcının asla aramayacağı kombinasyonlar
- Sözlükte/yaygın kullanımda bulunmayan uyduruk kelimeler

Bu değerlendirmeyi sadece kategoriden ve dilden bağımsız genel bir mantıkla yap — sen Google Play
ekosistemini ve genel ASO kalıplarını biliyorsun, bu bilgini kullan.

Geçerli kelimeler ise: gerçek kategori/özellik terimleri, jenerik açıklayıcı kelimeler, bilinen
teknik terimler (örn. "m3u player", "live tv", "video editor", "step counter" gibi).

═══════════════════════════════════════════════════════
GÖREV 2 — DEĞERLENDİRME VE ÖNERİ
═══════════════════════════════════════════════════════
SADECE geçerli kelimeleri baz alarak taslağı değerlendir ve geliştirilmiş başlık + açıklama önerisi üret.
Geçersiz kelimeleri eksiklik olarak SAYMA, övgü/eleştiri konusu YAPMA.

KRİTİK KURALLAR:
1. Taslakta "GÜÇLÜ" durumundaki bir kelime için ASLA "eksik" veya "iyileştirilmeli" deme — bu kelime zaten orada.
2. Önerdiğin başlık/açıklamada "HİÇ YOK" durumundaki her geçerli kelimeyi TAM İFADE OLARAK, kelimesi kelimesine, bölmeden ekle. Örn. eksik kelime "video editor" ise metinde "video editor" üç-iki kelime art arda geçmeli, "editor for video" YETERLİ DEĞİL.
3. Markdown ASLA kullanma (**, *, #, _, vb.) — Play Store düz metin gösterir, yıldızlar çıplak görünür.
4. Rakip marka adı önerme.
5. Taslağın tonunu ve marka adını koru, baştan yazma.

═══════════════════════════════════════════════════════
DİL KURALI
═══════════════════════════════════════════════════════
- "genel_degerlendirme", "iyi_yapilanlar", "kritik_eksikler", "risk_uyarilari", "gecersiz_kelimeler" alanları HER ZAMAN TÜRKÇE yazılır — çünkü bunlar Türkçe konuşan geliştiriciye rapor, dil fark etmez.
- "iyilestirilmis_baslik_onerisi" ve "iyilestirilmis_aciklama_ilk_paragraf_onerisi" alanları MUTLAKA ${language} dilinde yazılır — çünkü bunlar Play Store'a o dilde yayınlanacak.

═══════════════════════════════════════════════════════
ÇIKTI FORMATI (SADECE bu JSON, başka metin yok)
═══════════════════════════════════════════════════════
{
  "gecersiz_kelimeler": [
    {"kelime": "tam olarak yukarıdaki listedeki kelime", "sebep": "TÜRKÇE kısa açıklama (örn: 'rakip uygulama markası', 'kişi adı', 'anlamsız harf dizisi', 'gerçek arama terimi değil')"}
  ],
  "genel_degerlendirme": "TÜRKÇE 2-3 cümle: taslak genel olarak nasıl, geçerli kelimelerden hangileri eksik",
  "iyi_yapilanlar": ["TÜRKÇE 2-3 madde, GÜÇLÜ durumdaki geçerli kelimelere referansla"],
  "kritik_eksikler": ["TÜRKÇE 2-4 madde, SADECE 'HİÇ YOK' durumundaki GEÇERLİ kelimelerden seç, somut ve aksiyon odaklı"],
  "risk_uyarilari": ["TÜRKÇE — varsa marka ihlali / yasaklı kelime / telif / ban riski uyarıları, yoksa boş array"],
  "iyilestirilmis_baslik_onerisi": "${language} DİLİNDE, 50 karakter altı, tüm geçerli eksik kelimeleri kapsayan başlık",
  "iyilestirilmis_aciklama_ilk_paragraf_onerisi": "${language} DİLİNDE 2-4 cümle, tüm geçerli eksik kelimeleri TAM İFADE OLARAK doğal şekilde içeren açıklama paragrafı"
}`

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  })

  return JSON.parse(response.text)
}

function stripMarkdown(text) {
  if (!text) return text
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { draftTitle, draftDescription, scanResults, language = 'Türkçe' } = req.body
  if (!draftTitle && !draftDescription) {
    return res.status(400).json({ error: 'draftTitle veya draftDescription zorunlu' })
  }
  if (!scanResults?.length) {
    return res.status(400).json({ error: 'scanResults zorunlu — önce Toplu Tarama çalıştırılmalı' })
  }

  // ADIM 1 — Tüm taranan kelimeler için taslak durumunu hesapla
  const allChecks = scanResults
    .filter(r => !r.error)
    .map(r => {
      const check = checkKeywordInDraft(r.keyword, draftTitle, draftDescription)
      return {
        ...check,
        previousDurum: r.durum,
        previousFirsatSkoru: r.firsatSkoru,
        myRank: r.myRank,
        totalResults: r.totalResults,
      }
    })

  // ADIM 2 — Katman 1: kategori/dil bağımsız yapısal filtre
  const structurallyFiltered = []
  const afterStructuralFilter = []
  for (const check of allChecks) {
    const struct = isStructurallyMalformed(check.keyword)
    if (struct.malformed) {
      structurallyFiltered.push({ ...check, filterReason: struct.reason })
    } else if (check.previousDurum === 'Düşük Hacim') {
      structurallyFiltered.push({ ...check, filterReason: 'düşük arama hacmi' })
    } else {
      afterStructuralFilter.push(check)
    }
  }

  // ADIM 3 — Katman 2: Gemini ile semantik filtre + analiz (tek çağrı)
  let aiAnalysis = null
  let aiError = null
  let semanticallyFiltered = []
  let finalValidChecks = afterStructuralFilter
  const apiKey = process.env.GEMINI_API_KEY

  if (apiKey && afterStructuralFilter.length > 0) {
    try {
      const ai = new GoogleGenAI({ apiKey })

      // İlk skor tahmini (semantik filtre öncesi) — Gemini'ye bağlamlı bilgi olarak verilir,
      // ama final skor semantik filtre sonrası tekrar hesaplanır.
      const initialStrong = afterStructuralFilter.filter(k => k.inTitle || k.inFirstLines).length
      const initialWeak = afterStructuralFilter.filter(k => (k.inDescription && !k.inFirstLines) && !k.inTitle).length
      const initialTotal = afterStructuralFilter.length
      const initialScore = Math.round(((initialStrong + initialWeak * 0.4) / initialTotal) * 100)

      aiAnalysis = await analyzeWithGemini({
        ai,
        draftTitle,
        draftDescription,
        candidateKeywords: afterStructuralFilter,
        language,
        asoSkoruInitial: initialScore,
      })

      // Gemini'nin geçersiz dediği kelimeleri ayır
      const invalidKeywordSet = new Set(
        (aiAnalysis.gecersiz_kelimeler || []).map(g => g.kelime?.toLowerCase().trim()).filter(Boolean)
      )
      semanticallyFiltered = afterStructuralFilter
        .filter(k => invalidKeywordSet.has(k.keyword.toLowerCase().trim()))
        .map(k => {
          const reason = aiAnalysis.gecersiz_kelimeler.find(g => g.kelime?.toLowerCase().trim() === k.keyword.toLowerCase().trim())?.sebep || 'AI tarafından geçersiz işaretlendi'
          return { ...k, filterReason: reason }
        })
      finalValidChecks = afterStructuralFilter.filter(k => !invalidKeywordSet.has(k.keyword.toLowerCase().trim()))

      // Markdown sızıntısı için güvenlik ağı (prompt yasağına ek)
      aiAnalysis.iyilestirilmis_baslik_onerisi = stripMarkdown(aiAnalysis.iyilestirilmis_baslik_onerisi)
      aiAnalysis.iyilestirilmis_aciklama_ilk_paragraf_onerisi = stripMarkdown(aiAnalysis.iyilestirilmis_aciklama_ilk_paragraf_onerisi)

      // Tam-ifade doğrulaması: önerilen metinde her eksik geçerli kelime tam olarak geçiyor mu
      const finalMissing = finalValidChecks.filter(k => !k.inTitle && !k.inDescription)
      const suggestedText = `${aiAnalysis.iyilestirilmis_baslik_onerisi || ''} ${aiAnalysis.iyilestirilmis_aciklama_ilk_paragraf_onerisi || ''}`.toLowerCase()
      aiAnalysis.onerideEksikKalanlar = finalMissing
        .map(k => k.keyword)
        .filter(kw => !suggestedText.includes(kw.toLowerCase()))
    } catch (err) {
      console.error('Gemini taslak analiz hatası:', err.message)
      aiAnalysis = null
      aiError = err.message
    }
  }

  // ADIM 4 — Final skoru ve kategorileri hesapla (semantik filtre sonrası geçerli kelimeler üzerinden)
  const missingInDraft = finalValidChecks.filter(k => !k.inTitle && !k.inDescription)
  const weakInDraft = finalValidChecks.filter(k => (k.inDescription && !k.inFirstLines) && !k.inTitle)
  const strongInDraft = finalValidChecks.filter(k => k.inTitle || k.inFirstLines)

  const total = finalValidChecks.length || 1
  const weightedSum = strongInDraft.length * 1 + weakInDraft.length * 0.4
  const asoSkoru = Math.round((weightedSum / total) * 100)

  // Gemini'nin yanıttaki kendi skorunu da bizim hesapladığımızla zorla değiştir (tutarlılık)
  if (aiAnalysis) aiAnalysis.aso_skoru = asoSkoru

  // Filtre dışı bırakılan tüm kelimeleri tek listede topla (frontend için)
  const allFilteredOut = [...structurallyFiltered, ...semanticallyFiltered]

  return res.status(200).json({
    titleLength: (draftTitle || '').length,
    descriptionLength: (draftDescription || '').length,
    totalKeywordsChecked: finalValidChecks.length,
    asoSkoru,
    missingInDraft,
    weakInDraft,
    strongInDraft,
    keywordChecks: finalValidChecks,
    malformedChecks: allFilteredOut, // hem yapısal hem semantik filtre dışı bırakılanlar
    aiAnalysis,
    aiAvailable: !!apiKey,
    aiError,
  })
}
