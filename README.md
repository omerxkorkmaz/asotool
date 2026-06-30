# ASO Tool — Google Play Scraper Dashboard

Ücretsiz, kendi sunucun, `google-play-scraper` tabanlı ASO aracı.

## Özellikler

- **Keyword Tracker** — Bir keyword'de kaçıncı sıradasın, tüm rakip listesi, takibe alabilirsin
- **Sıralama Trendi** — Takip ettiğin kelimeler her gün otomatik taranır (Vercel Cron), zaman içindeki sıra değişimini grafikte gör
- **Çoklu Ülke Tarama** — Aynı keyword'ü farklı ülkelerde (TR, US, DE, SA, BR vb.) aynı anda tara
- **Toplu Tarama & Aksiyon** — TR/EN/DE/ES dillerinden birini seç, o pazar için kök kelime gir, otomatik ilgili kelimeleri bul (Google autocomplete + rakip kelime analizi), seçtiğin kelimeleri topluca tara, her biri için fırsat skoru + somut aksiyon önerisi al. Üstüne: o dilin başlık/açıklama taslağını yapıştır (her dil için ayrı taslak saklanır), taranan kelimeleri ne kadar kapsadığını gör, Gemini ile o dilde ASO skoru + risk uyarısı (marka ihlali vb.) + düzeltilmiş metin önerisi al — hiçbir şeyi Play Store'a basmadan
- **Rakip Analizi** — Rakip uygulama detayları, puan dağılımı, açıklama
- **Yorum Madencisi** — Tek tek okuma + kategorilere göre özet (hata/UX/reklam/fiyat/övgü), Gemini API key varsa AI destekli akıllı özet
- **Başlık & Açıklama Önerisi** — Rakip kelime analizine ve (varsa) Gemini'ye dayalı somut başlık/özet önerileri, tek tıkla kopyala
- **Kategori Radar** — Top 50 listelerini çek, kendi sıranı gör

## Kurulum

```bash
npm install
npm run dev
```

Tarayıcıda aç: http://localhost:3000

## Vercel'e Deploy (Ücretsiz)

### 1. GitHub'a yükle

```bash
git init
git add .
git commit -m "aso tool"
git remote add origin https://github.com/SENIN_KULLANICI/aso-tool.git
git push -u origin main
```

### 2. Vercel'de deploy et

1. https://vercel.com adresine git, GitHub ile giriş yap
2. "New Project" → GitHub reposunu seç
3. Framework: Next.js (otomatik algılar)
4. "Deploy" tıkla

Deploy tamamlandığında sana `https://aso-tool-xxx.vercel.app` gibi bir URL verir.

### 3. (İsteğe Bağlı) Otomatik Günlük Takip için KV Kurulumu

Sıralama Trendi sayfasının çalışması için Vercel'de bir Redis (KV) veritabanı bağlaman gerekiyor:

1. Vercel projende → **Storage** sekmesi → **Create Database** → **Marketplace Database Providers** altından **Upstash** seç (⚠ "Redis" yazan ayrı kart **Redis Cloud**'dur, o farklı bir bağlantı formatı kullanır ve bu projeyle uyumlu değildir — mutlaka **Upstash**'i seç)
2. Upstash ekranında **Redis** türünü seç (Vector/Queue değil)
3. Oluştur ve projene bağla — gerekli environment variable'lar (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) otomatik eklenir
4. Projeyi **Redeploy** et
5. Artık Keyword Tracker sayfasından "+ Günlük Takip Et" butonunu kullanabilirsin, cron job her gün 06:00 UTC'de otomatik tarar

KV kurmazsan diğer tüm özellikler (toplu tarama, rakip analizi, yorum madenciliği vb.) sorunsuz çalışmaya devam eder — sadece Sıralama Trendi sayfası "Redis bağlı değil" uyarısı gösterir.

### 4. (İsteğe Bağlı) AI Destekli Özellikler için Gemini API Key

Yorum Madencisi'nde akıllı özet ve Başlık & Açıklama Önerisi'nde somut metin önerileri için ücretsiz bir Gemini API key gerekiyor:

1. https://aistudio.google.com/apikey adresine git, Google hesabınla giriş yap
2. **Create API Key** → **Create API key in new project** (kredi kartı gerekmez)
3. Oluşan key'i kopyala (`AIzaSy...` ile başlar)
4. Vercel projende → **Settings** → **Environment Variables** → Key: `GEMINI_API_KEY`, Value: kopyaladığın key → **Save**
5. Projeyi **Redeploy** et

Gemini ücretsiz katmanı günde ~1.500 istek, dakikada ~15 istek veriyor — bu araç için fazlasıyla yeterli. Key eklemezsen Yorum Madencisi anahtar kelime eşleştirmesiyle, Başlık Önerisi ise sadece eksik kelime listesiyle (AI metni olmadan) çalışmaya devam eder.

## Notlar

- `google-play-scraper` Play Store'a istek atar, Türkiye için `gl=tr&hl=tr` parametreleri kullanılır
- Vercel free plan: Serverless functions 10 saniye timeout — tekli keyword/rakip/yorum istekleri 2-5 saniyede döner, sorun yok
- **Çoklu Ülke Tarama** özelliği birden fazla ülkeyi paralel tarar; `vercel.json`'da `maxDuration: 60` tanımlı ama bu **sadece Vercel Pro planında** geçerlidir. Free (Hobby) planda hâlâ 10 saniye sınırı var. Bu yüzden sayfada aynı anda 5-8 ülkeyi geçmemeni öneririz (Quick Set butonları zaten bu aralıkta tutuyor). 10'dan fazla ülke seçersen sayfa seni uyarır.
- **Toplu Tarama & Aksiyon** sayfası 20 kelimeye kadar tek seferde tarayabilir, ama her kelime için 100 sonuçluk arama yapıldığından Vercel free plan'ın 10sn limitini aşma riski var. Güvenli kullanım için **tek seferde 8-10 kelimeyle başla**, sorun yaşarsan azalt. `maxDuration: 60` ayarı sadece Pro planda etkili.
- Aynı şekilde **Keyword Genişletme** (autocomplete + rakip kelime analizi) tek bir kök kelime için birkaç saniye sürer, bu sorunsuz çalışır.
- **Sıralama Trendi** cron job'u Vercel Hobby planda günde sadece 1 kez çalışabilir (Vercel'in kısıtı). `vercel.json`'daki `0 6 * * *` ifadesi her gün UTC 06:00'da çalışacak şekilde ayarlı, bu Hobby planda desteklenir.
- **Yorum Madencisi** ve **Başlık Önerisi**'ndeki AI özellikleri Gemini API key olmadan da çalışır, sadece anahtar kelime eşleştirmesine düşer (daha az isabetli ama yine de kullanışlı).
- Veri localStorage'da tutulur (package name, rakip listesi, keyword geçmişi). Takip edilen kelimeler ve sıralama geçmişi ise KV kurulduysa Redis'te tutulur.
- Rate limit: Kişisel kullanım için sorun olmaz. Çok fazla istek atarsan Google geçici IP block uygulayabilir.

## Eklenebilecek Özellikler (İleride)

- [ ] CSV export
- [ ] Email alert (sıra değişince)
- [ ] Apple App Store desteği (apple-app-store-scraper paketi ile)
- [ ] Çoklu uygulama desteği (şu an tek package name ile çalışıyor)

