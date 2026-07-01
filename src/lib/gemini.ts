import { GoogleGenAI } from '@google/genai'

/** Varsayılan model. GEMINI_MODEL ile override edilebilir. */
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL
}

/** Deep Report için ayrı model (varsayılan: GEMINI_MODEL — Pro free tier'da kotası 0). */
export function getGeminiDeepReportModel(): string {
  return process.env.GEMINI_DEEP_REPORT_MODEL?.trim() || getGeminiModel()
}

/** @deprecated getGeminiModel() kullanın */
export const GEMINI_MODEL = getGeminiModel()

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) return null
  return new GoogleGenAI({ apiKey })
}

export function formatGeminiError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('quota')) {
    const model = message.match(/model: ([^\s\\n]+)/)?.[1] || getGeminiModel()
    return (
      `Gemini API kotası doldu (model: ${model}). ` +
      `Vercel'de GEMINI_MODEL ayarını kontrol edin (ör. gemini-3.5-flash) ve redeploy edin. ` +
      `Kullanım: https://ai.dev/rate-limit`
    )
  }
  if (message.includes('API key') || message.includes('API_KEY_INVALID')) {
    return 'GEMINI_API_KEY geçersiz veya eksik. Vercel → Settings → Environment Variables → Production.'
  }
  return message
}

export function parseGeminiJsonText<T>(raw: string): T {
  let text = raw.trim()
  if (!text) throw new Error('Gemini boş yanıt döndürdü')

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) text = fenced[1].trim()

  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Gemini yanıtında JSON nesnesi bulunamadı')
  }

  let jsonStr = text.slice(start, end + 1)
  jsonStr = jsonStr.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'")
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')

  try {
    return JSON.parse(jsonStr) as T
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Gemini JSON parse hatası: ${message}`)
  }
}

export async function geminiJson<T>(prompt: string, systemInstruction?: string): Promise<T | null> {
  const ai = getGeminiClient()
  if (!ai) return null

  try {
    const response = await ai.models.generateContent({
      model: getGeminiModel(),
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        ...(systemInstruction ? { systemInstruction } : {}),
      },
    })
    return parseGeminiJsonText<T>(response.text ?? '{}')
  } catch (err) {
    console.error('[gemini]', err)
    return null
  }
}

export function stripMarkdown(text?: string | null): string | undefined {
  if (!text) return text ?? undefined
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
}
