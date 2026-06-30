# ASO Tool — Google Play Scraper Dashboard

Ücretsiz, kendi sunucun, `google-play-scraper` tabanlı ASO aracı.

## Özellikler

- **Keyword Tracker** — Bir keyword'de kaçıncı sıradasın, tüm rakip listesi
- **Rakip Analizi** — Rakip uygulama detayları, puan dağılımı, açıklama
- **Yorum Madencisi** — Herhangi bir uygulamanın yorumları, yıldız filtreli
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

## Notlar

- `google-play-scraper` Play Store'a istek atar, Türkiye için `gl=tr&hl=tr` parametreleri kullanılır
- Vercel free plan: Serverless functions 10 saniye timeout — tekli keyword/rakip/yorum istekleri 2-5 saniyede döner, sorun yok
- **Çoklu Ülke Tarama** özelliği birden fazla ülkeyi paralel tarar; `vercel.json`'da `maxDuration: 60` tanımlı ama bu **sadece Vercel Pro planında** geçerlidir. Free (Hobby) planda hâlâ 10 saniye sınırı var. Bu yüzden sayfada aynı anda 5-8 ülkeyi geçmemeni öneririz (Quick Set butonları zaten bu aralıkta tutuyor). 10'dan fazla ülke seçersen sayfa seni uyarır.
- Eğer sık sık 15-20+ ülke taramak istersen iki seçenek var: (1) Vercel Pro'ya geç ($20/ay), (2) taramayı 2-3 gruba bölüp ayrı ayrı çalıştır (Quick Set butonları zaten bunun için var: Avrupa, Orta Doğu, Amerika, Asya)
- Veri localStorage'da tutulur (package name, rakip listesi, keyword geçmişi)
- Rate limit: Kişisel kullanım için sorun olmaz. Çok fazla istek atarsan Google geçici IP block uygulayabilir.

## Eklenebilecek Özellikler (İleride)

- [ ] Keyword sıralama geçmişi grafiği (Vercel KV ile)
- [ ] Otomatik günlük tracking (Vercel Cron ile — ücretsiz planda 1/gün)
- [ ] CSV export
- [ ] Email alert (sıra değişince)
- [ ] Apple App Store desteği (apple-app-store-scraper paketi ile)
