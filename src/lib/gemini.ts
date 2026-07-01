import { GoogleGenAI } from '@google/genai'

/** Varsayılan model. GEMINI_MODEL ile override edilebilir. */
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash'

const MODEL_FALLBACK_CHAIN = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'] as const

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL
}

/** Deep Report için ayrı model (varsayılan: GEMINI_MODEL). */
export function getGeminiDeepReportModel(): string {
  return process.env.GEMINI_DEEP_REPORT_MODEL?.trim() || getGeminiModel()
}

/** Yoğunluk/kota durumunda denenecek modeller (birincil + yedekler). */
export function getGeminiModelCandidates(preferred?: string): string[] {
  const primary = preferred?.trim() || getGeminiModel()
  const envFallback = process.env.GEMINI_FALLBACK_MODEL?.trim()
  const chain: string[] = []

  for (const model of [primary, envFallback, ...MODEL_FALLBACK_CHAIN]) {
    if (model && !chain.includes(model)) chain.push(model)
  }
  return chain
}

export function isGeminiTransientError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  const status = (err as { status?: number })?.status
  return (
    status === 503 ||
    status === 429 ||
    message.includes('"code":503') ||
    message.includes('"code":429') ||
    message.includes('503') ||
    message.includes('429') ||
    message.includes('UNAVAILABLE') ||
    message.includes('high demand') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('quota')
  )
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface GenerateGeminiContentParams {
  models?: string[]
  contents: string
  config?: Record<string, unknown>
  maxRetriesPerModel?: number
}

/** Geçici hatalarda bekleme + alternatif model ile Gemini çağrısı. */
export async function generateGeminiContent(
  params: GenerateGeminiContentParams
): Promise<{ text: string; model: string }> {
  const ai = getGeminiClient()
  if (!ai) {
    throw new Error('GEMINI_API_KEY tanımlı değil. Vercel Production ortamına ekleyip redeploy edin.')
  }

  const models = params.models ?? getGeminiModelCandidates()
  const maxRetries = params.maxRetriesPerModel ?? 2
  let lastError: unknown

  for (const model of models) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delayMs = 2000 * attempt
          console.warn(`[gemini] ${model} yeniden deneniyor (${attempt + 1}/${maxRetries + 1}) — ${delayMs}ms bekleniyor`)
          await sleep(delayMs)
        }

        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        })

        return { text: response.text || '{}', model }
      } catch (err) {
        lastError = err
        if (!isGeminiTransientError(err)) throw err
        console.warn(`[gemini] ${model} geçici hata:`, err instanceof Error ? err.message : err)
      }
    }
  }

  throw lastError
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
  if (
    message.includes('503') ||
    message.includes('UNAVAILABLE') ||
    message.includes('high demand')
  ) {
    return (
      'Gemini API şu an yoğun (503). Bu Google tarafında geçici bir durum — 1-2 dakika bekleyip tekrar deneyin. ' +
      'Sorun sürerse Vercel\'de GEMINI_FALLBACK_MODEL=gemini-2.5-flash ekleyin.'
    )
  }
  if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('quota')) {
    const model = message.match(/model: ([^\s\\n]+)/)?.[1] || getGeminiModel()
    return (
      `Gemini API kotası doldu (model: ${model}). ` +
      `Vercel'de GEMINI_MODEL ayarını kontrol edin ve redeploy edin. ` +
      `Kullanım: https://ai.dev/rate-limit`
    )
  }
  if (message.includes('API key') || message.includes('API_KEY_INVALID')) {
    return 'GEMINI_API_KEY geçersiz veya eksik. Vercel → Settings → Environment Variables → Production.'
  }
  return message
}

function normalizeJsonCandidate(raw: string): string {
  let jsonStr = raw.trim()
  jsonStr = jsonStr.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'")
  jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')
  return jsonStr
}

function repairTruncatedJson(jsonStr: string): string {
  let s = jsonStr.trim().replace(/,\s*$/, '')

  const stack: string[] = []
  let inString = false
  let escape = false

  for (const ch of s) {
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\') {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{') stack.push('}')
    else if (ch === '[') stack.push(']')
    else if (ch === '}' || ch === ']') stack.pop()
  }

  if (inString) s += '"'
  while (stack.length) s += stack.pop()
  return s
}

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()

  const trimmed = text.trim()
  if (trimmed.startsWith('{')) return trimmed

  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Gemini yanıtında JSON nesnesi bulunamadı')
  }
  return text.slice(start, end + 1)
}

export function parseGeminiJsonText<T>(raw: string): T {
  const text = raw.trim()
  if (!text) throw new Error('Gemini boş yanıt döndürdü')

  const candidates = [
    text,
    extractJsonObject(text),
    repairTruncatedJson(extractJsonObject(text)),
  ]

  let lastError = 'bilinmeyen hata'
  for (const candidate of candidates) {
    try {
      return JSON.parse(normalizeJsonCandidate(candidate)) as T
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  throw new Error(`Gemini JSON parse hatası: ${lastError}`)
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
