import type { WebMention } from './types'
import { getGeminiClient, getGeminiModel } from '@/lib/gemini'

export async function scanWebMentions(
  appName: string,
  developerName: string
): Promise<WebMention[]> {
  try {
    const prompt = `"${appName}" uygulaması (geliştirici: ${developerName}) hakkında web'de bahseden kaynakları ara.
İncelemeler, haber makaleleri, "en iyi" listeleri, eğitim videoları, forum tartışmaları (Reddit, X vb.) bul.

SADECE geçerli bir JSON dizisi döndür. Her nesne şu anahtarlara sahip olmalı:
- source: string (web sitesi/yayın adı)
- title: string (başlık veya gönderi başlığı)
- url: string (bulunursa tam URL, yoksa boş string)
- type: "review" | "news" | "list" | "tutorial" | "forum" | "other"
- relevance: "high" | "medium" | "low"
- date: string (biliniyorsa ISO tarih, yoksa boş string)
- snippet: string (1-2 cümlelik alıntı, TÜRKÇE özetle)

En fazla 10 bahis bul. Hiç bahis yoksa boş dizi [] döndür.
JSON dizisinin dışında hiçbir metin ekleme.`

    const ai = getGeminiClient()
    if (!ai) return []

    const response = await ai.models.generateContent({
      model: getGeminiModel(),
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
