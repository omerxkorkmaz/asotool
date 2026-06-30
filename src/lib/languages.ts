export interface AppLanguage {
  gl: string
  hl: string
  label: string
  flag: string
}

export const APP_LANGUAGES: AppLanguage[] = [
  { gl: 'tr', hl: 'tr', label: 'Türkçe (TR)', flag: '🇹🇷' },
  { gl: 'us', hl: 'en', label: 'English (US)', flag: '🇺🇸' },
  { gl: 'de', hl: 'de', label: 'Deutsch (DE)', flag: '🇩🇪' },
  { gl: 'es', hl: 'es', label: 'Español (ES)', flag: '🇪🇸' },
]

/** Bulk Scan sayfası dil seçici — 7 pazar */
export const BULK_SCAN_LANGUAGES: AppLanguage[] = [
  { gl: 'tr', hl: 'tr', label: 'Türkiye (TR)', flag: '🇹🇷' },
  { gl: 'us', hl: 'en', label: 'ABD (US)', flag: '🇺🇸' },
  { gl: 'de', hl: 'de', label: 'Almanya (DE)', flag: '🇩🇪' },
  { gl: 'es', hl: 'es', label: 'İspanya (ES)', flag: '🇪🇸' },
  { gl: 'fr', hl: 'fr', label: 'Fransa (FR)', flag: '🇫🇷' },
  { gl: 'br', hl: 'pt', label: 'Brezilya (BR)', flag: '🇧🇷' },
  { gl: 'sa', hl: 'ar', label: 'Suudi Arabistan (SA)', flag: '🇸🇦' },
]

export function getLanguageByGl(gl: string): AppLanguage {
  return APP_LANGUAGES.find((l) => l.gl === gl) ?? APP_LANGUAGES[0]
}

export const COUNTRY_PRESETS = [
  { gl: 'tr', hl: 'tr', label: 'Türkiye', flag: '🇹🇷' },
  { gl: 'us', hl: 'en', label: 'ABD', flag: '🇺🇸' },
  { gl: 'gb', hl: 'en', label: 'İngiltere', flag: '🇬🇧' },
  { gl: 'de', hl: 'de', label: 'Almanya', flag: '🇩🇪' },
  { gl: 'fr', hl: 'fr', label: 'Fransa', flag: '🇫🇷' },
  { gl: 'es', hl: 'es', label: 'İspanya', flag: '🇪🇸' },
  { gl: 'it', hl: 'it', label: 'İtalya', flag: '🇮🇹' },
  { gl: 'br', hl: 'pt', label: 'Brezilya', flag: '🇧🇷' },
  { gl: 'pt', hl: 'pt', label: 'Portekiz', flag: '🇵🇹' },
  { gl: 'ru', hl: 'ru', label: 'Rusya', flag: '🇷🇺' },
  { gl: 'sa', hl: 'ar', label: 'Suudi Arabistan', flag: '🇸🇦' },
  { gl: 'ae', hl: 'ar', label: 'BAE', flag: '🇦🇪' },
  { gl: 'eg', hl: 'ar', label: 'Mısır', flag: '🇪🇬' },
  { gl: 'in', hl: 'en', label: 'Hindistan', flag: '🇮🇳' },
  { gl: 'id', hl: 'id', label: 'Endonezya', flag: '🇮🇩' },
  { gl: 'pk', hl: 'en', label: 'Pakistan', flag: '🇵🇰' },
  { gl: 'nl', hl: 'nl', label: 'Hollanda', flag: '🇳🇱' },
  { gl: 'pl', hl: 'pl', label: 'Polonya', flag: '🇵🇱' },
  { gl: 'mx', hl: 'es', label: 'Meksika', flag: '🇲🇽' },
  { gl: 'ar', hl: 'es', label: 'Arjantin', flag: '🇦🇷' },
  { gl: 'jp', hl: 'ja', label: 'Japonya', flag: '🇯🇵' },
  { gl: 'kr', hl: 'ko', label: 'G. Kore', flag: '🇰🇷' },
] 

export type CountryPreset = (typeof COUNTRY_PRESETS)[number]

export function fmtNum(n?: number | null): string {
  if (!n) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toString()
}

export function fmtDate(ts?: string | number | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDateTime(ts?: string | number | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
