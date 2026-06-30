// Senin uygulamanın desteklediği 4 dil/pazar için ortak preset.
// gl = Google Play country code, hl = dil kodu, label = ekranda görünen isim
export const APP_LANGUAGES = [
  { gl: 'tr', hl: 'tr', label: 'Türkçe (TR)', flag: '🇹🇷' },
  { gl: 'us', hl: 'en', label: 'English (US)', flag: '🇺🇸' },
  { gl: 'de', hl: 'de', label: 'Deutsch (DE)', flag: '🇩🇪' },
  { gl: 'es', hl: 'es', label: 'Español (ES)', flag: '🇪🇸' },
]

export function getLanguageByGl(gl) {
  return APP_LANGUAGES.find(l => l.gl === gl) || APP_LANGUAGES[0]
}
