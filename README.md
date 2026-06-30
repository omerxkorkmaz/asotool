# ASO Tool — Kişisel Google Play ASO Silahı

Ücretsiz, kendi sunucun, `google-play-scraper` + **Gemini Flash** tabanlı profesyonel ASO dashboard.

## Hızlı Başlangıç

```bash
npm install
cp .env.example .env.local   # GEMINI_API_KEY ve Upstash opsiyonel
npm run dev
```

Tarayıcı: **http://localhost:3000** → **Komuta Merkezi** ana panel.

## Önerilen İş Akışı

```
Komuta Merkezi → Uygulama ekle
       ↓
Bulk Scan → Keyword fırsatları + 7 günlük plan
       ↓
Metadata Optimizer → A/B metadata varyasyonları
       ↓
Full ASO Audit → Health score + rakip gap + strateji özeti
```

Her analiz sonucunda **JSON / CSV / Rapor Oluştur** (yazdır → PDF) export kullanılabilir.

## Ana Özellikler

| Modül | Route | Açıklama |
|-------|-------|----------|
| **Komuta Merkezi** | `/` | App listesi, health score, quick audit |
| **Bulk Scan** | `/keywords/bulk-scan` | AI keyword analizi, autocomplete, rakip verisi |
| **Metadata Optimizer** | `/keywords/metadata-optimizer` | Gemini A/B title/short/full önerileri |
| **Full ASO Audit** | `/aso-audit` | Health + keyword + metadata + gap + 7 gün plan |
| Keyword Tracker | `/keywords` | Sıra takibi |
| Sıralama Trendi | `/trend` | Cron ile günlük tarama (Redis gerekli) |
| Rakip / Yorum / Kategori | `/rivals`, `/reviews`, `/category` | Scrape tabanlı analiz |

## Ortam Değişkenleri

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `GEMINI_API_KEY` | Hayır | AI analiz kalitesi için önerilir |
| `KV_REST_API_URL` | Hayır | Upstash Redis — kalıcı app/bulk scan geçmişi |
| `KV_REST_API_TOKEN` | Hayır | Upstash token |
| `CRON_SECRET` | Hayır | Vercel cron koruması |

Redis yoksa: uygulamalar **localStorage**'da saklanır, dashboard uyarı gösterir — diğer scrape özellikleri çalışır.

## Deploy (Vercel)

1. GitHub'a push
2. Vercel → New Project → Deploy
3. **Storage → Upstash Redis** bağla (Sıralama Trendi + app registry için)
4. `GEMINI_API_KEY` ekle → Redeploy

Ağır endpoint'ler (`bulk-scan`, `aso-audit`, `metadata-optimizer`) `vercel.json`'da `maxDuration: 60` — **Pro plan** gerektirir. Hobby'de 10sn limit; 5–8 keyword ile test edin.

## Veri Kalitesi Prensipleri

- Tüm Gemini prompt'ları **gerçek scrape verisine** dayanır; halüsinasyon önleme kuralları merkezi (`src/lib/gemini-prompts.ts`)
- Volume/difficulty **muhafazakar** skorlanır
- Öneriler **app'e özel** yazılır (generic ASO tavsiyesi yok)
- Redis cache + stale-while-revalidate (`src/lib/data-layer.ts`)

## Rate Limit

- Genel API: 60 istek/dk/IP
- Ağır analiz (bulk scan, audit, metadata): 12 istek/dk/IP

## Notlar

- Kişisel kullanım için tasarlandı; Play Store'a aşırı istek IP block riski taşır
- Export: JSON, CSV, print-ready HTML rapor (tarayıcı PDF)
- Eski route `/audit` → `/aso-audit` yönlendirmesi

## Geliştirme

```bash
npm run build      # production build
npm run typecheck  # TypeScript kontrol
```

Stack: Next.js 14 (App Router UI + Pages API), TypeScript, Upstash Redis, Recharts, Gemini 2.5 Flash.
