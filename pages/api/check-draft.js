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

  const { draftTitle, draftDescription, scanResults, language = 'Türkçe' } = req.body
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
        totalResults: r.totalResults,
      }
    })

  // Bozuk/anlamsız kelime tespiti: aynı kökü birden fazla kez içeren veya 5+ kelimelik
  // öbekler genelde "iptv, iptv player" gibi yanlışlıkla birleştirilmiş girdilerdir, gerçek
  // arama terimi değildir. Bunları ayrı işaretliyoruz ki hem ekranda hem Gemini'ye gönderirken
  // yanıltıcı "kritik eksik" gibi görünmesinler.
  //
  // Ayrıca: bilinen rakip IPTV uygulama markaları marka ihlali riski taşıdığı için baştan
  // ayıklanır. Kişi isimleri (örn. "iptv alexander sofronov") büyük/küçük harf örüntüsüyle
  // yakalanamıyor çünkü kaynak veride kelimeler zaten küçük harfe çevrilmiş geliyor — bunun
  // yerine previousFirsatSkoru/appearsIn gibi sinyaller kullanılır: gerçek kategori kelimeleri
  // (player, stream, smart) genelde birden fazla rakipte tekrar eder, bir kişi adı ise
  // genelde çok nadir/tesadüfi geçer ve fırsat skoru anormal yüksek (rakipsiz) çıkar.
  const KNOWN_COMPETITOR_BRANDS = [
    'smarters', 'ibo player', 'iboplayer', 'tivimate', 'gse smart', 'perfect player',
    'ss iptv', 'duplex play', 'xciptv',
  ]

  // Teknoloji/IPTV bağlamıyla alakalı, gerçek ASO kelimesi olabilecek kökler.
  // Bir kelime öbeği bu köklerden hiçbirini içermiyorsa (yani sadece "iptv" + tanımadığımız
  // 2 kelime ise) muhtemelen isim/anlamsız bir kombinasyondur.
  const RELEVANT_ROOTS = [
    'player', 'stream', 'smart', 'app', 'live', 'tv', 'm3u', 'xtream', 'pro', 'free',
    'hd', '4k', 'box', 'channel', 'watch', 'view', 'play', 'cast', 'code', 'list',
  ]

  function looksMalformed(keyword) {
    const lowerFull = keyword.trim().toLowerCase()
    const words = keyword.trim().split(/\s+/)

    if (words.length >= 5) return true

    const lower = words.map(w => w.toLowerCase().replace(/[,.-]/g, ''))
    const uniqueRatio = new Set(lower).size / lower.length
    if (lower.length >= 3 && uniqueRatio < 0.6) return true // aynı kelime tekrar tekrar geçiyor

    // Bilinen rakip marka adı içeriyor mu?
    if (KNOWN_COMPETITOR_BRANDS.some(brand => lowerFull.includes(brand))) return true

    // 3+ kelimelik öbeklerde, "iptv" dışındaki kelimelerin HİÇBİRİ bilinen teknoloji/ASO
    // köküyle eşleşmiyorsa muhtemelen isim/anlamsız kombinasyondur (örn. "iptv alexander sofronov")
    if (words.length >= 3) {
      const nonSeedWords = lower.filter(w => w !== 'iptv')
      const hasRelevantRoot = nonSeedWords.some(w => RELEVANT_ROOTS.some(root => w.includes(root)))
      if (!hasRelevantRoot) return true
    }

    return false
  }

  // Düşük hacim filtresi: Toplu Tarama zaten bu kelimeyi "Düşük Hacim" diye etiketlediyse
  // (çok az sonuç dönüyor, gerçek kullanıcı arama davranışı değil — örn. "iptval" gibi rastgele
  // birleşmiş tek kelimeler) taslak kontrolünde de "kritik eksik" diye gösterilmemeli.
  function isLowVolume(check) {
    return check.previousDurum === 'Düşük Hacim'
  }

  const validChecks = keywordChecks.filter(k => !looksMalformed(k.keyword) && !isLowVolume(k))
  const malformedChecks = keywordChecks.filter(k => looksMalformed(k.keyword) || isLowVolume(k))

  const missingInDraft = validChecks.filter(k => !k.inTitle && !k.inDescription)
  const weakInDraft = validChecks.filter(k => (k.inDescription && !k.inFirstLines) && !k.inTitle)
  const strongInDraft = validChecks.filter(k => k.inTitle || k.inFirstLines)

  // 2) Gemini ile derin analiz (key varsa)
  let aiAnalysis = null
  let aiError = null
  const apiKey = process.env.GEMINI_API_KEY

  // ASO skorunu kod tarafında deterministik hesapla (Gemini'nin her seferinde farklı
  // sezgisel sayı üretmesini önlemek için). Basit ve şeffaf bir formül: kapsama oranı.
  // Güçlü konum 1 puan, zayıf konum 0.4 puan, hiç yok 0 puan üzerinden ağırlıklı ortalama.
  const total = validChecks.length || 1
  const weightedSum = strongInDraft.length * 1 + weakInDraft.length * 0.4
  const asoSkoru = Math.round((weightedSum / total) * 100)

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey })

      // Taslaktaki durum ile eski/yayındaki durum birbirine karışmasın diye iki ayrı
      // bölüm halinde veriyoruz. Gemini önceki tarama bilgisini sadece bağlam için kullansın,
      // "taslak iyi mi" sorusunu SADECE taslak sütununa bakarak cevaplasın.
      const keywordSummary = validChecks.map(k => {
        const taslakDurum = k.inTitle ? 'GÜÇLÜ (başlıkta)' : k.inFirstLines ? 'GÜÇLÜ (açıklama ilk satırlarında)' : k.inDescription ? 'ZAYIF (açıklamada geç konumda)' : 'HİÇ YOK'
        return `- "${k.keyword}" → TASLAKTAKİ DURUM: ${taslakDurum} (bağlam: yayındaki eski sürümde bu kelime "${k.previousDurum}" durumundaydı, bu sadece geçmiş bilgi, taslağı bundan bağımsız değerlendir)`
      }).join('\n')

      const prompt = `Sen bir Google Play ASO (App Store Optimization) uzmanısın. Bir geliştirici henüz YAYINLAMADIĞI bir başlık ve açıklama taslağı hazırladı. Bu taslak ${language} dilinde ve ${language} konuşulan pazar(lar) için hazırlanmıştır. Tüm önerilerini ve değerlendirmeni ${language} dilinde, o dilin doğal/native konuşan bir kullanıcısının gerçekten arayacağı terimlere göre yap — başka bir dilden kelime kelime çeviri yapma, o dilin kendi ASO kalıplarını kullan.

TASLAK BAŞLIK:
${draftTitle || '(girilmedi)'}

TASLAK AÇIKLAMA:
${draftDescription || '(girilmedi)'}

HER KELİMENİN TASLAKTAKİ GERÇEK DURUMU (bu en güncel ve doğru bilgi, buna göre değerlendir):
${keywordSummary || '(geçerli kelime bulunamadı)'}

KRİTİK KURAL: Yukarıda "TASLAKTAKİ DURUM: GÜÇLÜ" yazan bir kelime için ASLA "eksik", "zayıf" veya "iyileştirilmeli"
deme — bu kelime taslakta zaten güçlü konumda, övgüyü hak ediyor. Sadece "TASLAKTAKİ DURUM: HİÇ YOK" veya
"ZAYIF" yazan kelimeler için eksiklik/iyileştirme öner. "bağlam" notundaki eski yayın bilgisini değerlendirmene
katma, o sadece geçmişe dair ek bilgi, taslağın kalitesini etkilemez.

ÖNEMLİ UYARI: Kelime listesinde hâlâ anlamsız, gerçek bir kullanıcının asla aramayacağı türden öbekler
görürsen (aynı kelimenin art arda tekrarı, virgülle birleştirilmiş iki farklı terim, 5+ kelimelik anlamsız
diziler) bunları analiz dışı bırak, eksiklik olarak gösterme.

HESAPLANMIŞ ASO SKORU: ${asoSkoru}/100 (bu skor kod tarafında matematiksel olarak hesaplandı: ${strongInDraft.length} kelime güçlü, ${weakInDraft.length} kelime zayıf, ${missingInDraft.length} kelime hiç yok, toplam ${total} kelime üzerinden). Bu skoru olduğu gibi kullan, kendi skorunu üretme.

GÖREV: SADECE aşağıdaki JSON formatında yanıt ver, başka metin ekleme. JSON alan isimleri Türkçe kalsın ama
İÇERİKLERİ (genel_degerlendirme, iyi_yapilanlar, kritik_eksikler, başlık/açıklama önerileri) ${language} dilinde yaz.
Sadece "iyi_yapilanlar" ve "kritik_eksikler" maddelerinin AÇIKLAMA CÜMLELERİ Türkçe kalabilir (sen Türkçe konuşan
geliştiriciye rapor veriyorsun), AMA önerilen başlık ve açıklama metinleri MUTLAKA ${language} dilinde olmalı çünkü
bunlar doğrudan Play Store'a o dilde yayınlanacak.

{
  "aso_skoru": ${asoSkoru},
  "genel_degerlendirme": "2-3 cümlelik özet: taslak genel olarak iyi mi, neyi kaçırıyor (SADECE 'HİÇ YOK' veya 'ZAYIF' durumundaki kelimelere odaklan)",
  "iyi_yapilanlar": ["taslağın doğru yaptığı 2-3 somut şey, GÜÇLÜ durumdaki kelimelere referansla"],
  "kritik_eksikler": ["en önemli 2-4 eksik, SADECE 'HİÇ YOK' durumundaki kelimelerden seç, her biri somut ve aksiyona dönüştürülebilir"],
  "risk_uyarilari": ["varsa: marka ihlali riski, yasaklı kelime, telif riski, ban riski gibi politika uyarıları — yoksa boş array"],
  "iyilestirilmis_baslik_onerisi": "taslağı temel alan, eksikleri gideren somut bir başlık önerisi (50 karakter altı)",
  "iyilestirilmis_aciklama_ilk_paragraf_onerisi": "taslağın açıklama ilk paragrafını temel alan, eksik kelimeleri doğal şekilde ekleyen geliştirilmiş bir versiyon (2-4 cümle)"
}

Önemli kurallar:
1. Rakip marka/uygulama isimlerini (örn. başka bir uygulamanın adı, geliştirici/yayıncı ismi) metne eklemeyi ASLA önerme, bu marka ihlali riski taşır. Sadece jenerik, kategoriyi tanımlayan kelimeleri öner.
2. Önerdiğin başlık ve açıklama metinlerinde KESİNLİKLE markdown işareti kullanma (**, *, #, _, vb.) — Google Play açıklamaları düz metin gösterir, yıldız işaretleri kullanıcıya çift yıldız olarak görünür, çok kötü durur. Vurgu yapmak istiyorsan emoji veya büyük harf kullan, markdown değil.
3. Taslağın tonunu ve markasını koru, baştan yazma.`

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      })
      aiAnalysis = JSON.parse(response.text)
      aiAnalysis.aso_skoru = asoSkoru // her ihtimale karşı kod-hesaplı skoru zorla, tutarlılık garantisi
    } catch (err) {
      console.error('Gemini taslak analiz hatası:', err.message)
      aiAnalysis = null
      aiError = err.message
    }
  }

  return res.status(200).json({
    titleLength: (draftTitle || '').length,
    descriptionLength: (draftDescription || '').length,
    totalKeywordsChecked: validChecks.length,
    asoSkoru, // her zaman mevcut, Gemini olmasa bile deterministik kapsama skoru görünür
    missingInDraft,
    weakInDraft,
    strongInDraft,
    keywordChecks: validChecks,
    malformedChecks,
    aiAnalysis,
    aiAvailable: !!apiKey,
    aiError,
  })
}
