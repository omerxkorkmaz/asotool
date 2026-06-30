import { GoogleGenAI } from '@google/genai'
import type { WebMention } from './types'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function scanWebMentions(
  appName: string,
  developerName: string
): Promise<WebMention[]> {
  try {
    const prompt = `Search the web for mentions of the mobile app "${appName}" by "${developerName}".
Find reviews, news articles, "best of" lists, tutorials, forum discussions.

Return ONLY a valid JSON array. Each object must have:
- source: string
- title: string
- url: string (empty if not found)
- type: "review" | "news" | "list" | "tutorial" | "forum" | "other"
- relevance: "high" | "medium" | "low"
- date: string (ISO date or empty)
- snippet: string (1-2 sentences)

Max 10 mentions. If none found, return [].
No text outside the JSON array.`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    })

    const text = response.text
    if (!text) return []

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const mentions: WebMention[] = JSON.parse(jsonMatch[0])
    return mentions.filter((m) => m.source && m.title)
  } catch (error) {
    console.error(`Web mention scan failed for "${appName}":`, error)
    return []
  }
}
