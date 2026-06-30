import { GoogleGenAI } from '@google/genai'

export const GEMINI_MODEL = 'gemini-2.5-flash'

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  return new GoogleGenAI({ apiKey })
}

export async function geminiJson<T>(prompt: string, systemInstruction?: string): Promise<T | null> {
  const ai = getGeminiClient()
  if (!ai) return null

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        ...(systemInstruction ? { systemInstruction } : {}),
      },
    })
    return JSON.parse(response.text ?? '{}') as T
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
