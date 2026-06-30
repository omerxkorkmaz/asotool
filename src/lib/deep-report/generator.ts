import { GoogleGenAI } from '@google/genai'
import type { AppSnapshot, DeepReport } from './types'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function generateReport(
  snapshots: AppSnapshot[]
): Promise<DeepReport['analysis']> {
  const myApp = snapshots[0]
  const competitors = snapshots.slice(1)

  const systemInstruction = `You are a world-class ASO (App Store Optimization) strategist and competitive intelligence analyst. 
Your job is to analyze detailed app data and tell me EXACTLY why competitors are ranking higher and what I should do about it.

Be specific, data-driven, and actionable. Never give vague advice like "improve your ASO."
Always reference specific keywords, metrics, or signals from the data provided.

Return ONLY valid JSON matching the structure specified. No markdown, no extra text.`

  const prompt = `## MY APP
${JSON.stringify(myApp, null, 2)}

## COMPETITORS
${competitors.map((c, i) => `### Competitor ${i + 1}: ${c.title}\n${JSON.stringify(c, null, 2)}`).join('\n')}

## YOUR TASK
Analyze this data and return a JSON object with this EXACT structure:

{
  "executiveSummary": "3-sentence summary of the competitive landscape and my position",
  "competitors": [
    {
      "appId": "string",
      "title": "string",
      "strengths": ["3 specific strengths with data evidence"],
      "weaknesses": ["3 specific weaknesses I can exploit"],
      "whyTheyRankHigher": "2-3 specific, data-backed reasons"
    }
  ],
  "opportunities": [
    "List 3-5 specific opportunities based on competitor weaknesses or market gaps"
  ],
  "keywordGapAnalysis": {
    "missingKeywords": ["Keywords competitors rank for that I don't"],
    "lowCompetitionKeywords": ["Keywords where competition seems weak and I could enter"]
  },
  "actionPlan": {
    "immediate": [
      "3-5 actions to take in the next 7 days. Be specific: include exact keywords to add, metadata changes, etc."
    ],
    "shortTerm": [
      "3-5 actions for days 7-30. Include marketing, content, and external signal improvement ideas."
    ]
  },
  "externalSignalInsights": "Analysis of off-store presence. Which competitor has strongest external signals? What can I learn from their strategy? Mention specific YouTube channels, web mentions, or ad patterns if available."
}

Rules:
- Reference specific data points from the input (ratings, keyword ranks, review counts, signal scores)
- If data is missing (null), acknowledge it and work with what's available
- Be direct and actionable. I need a battle plan, not theory.
- Keep "whyTheyRankHigher" concrete. Don't say "better ASO" — say "title starts with target keyword, has 3x more reviews, and runs Facebook ads"`

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction,
      temperature: 0.3,
      topP: 0.9,
      maxOutputTokens: 4096,
    },
  })

  const text = response.text || '{}'

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse Gemini response as JSON')

  return JSON.parse(jsonMatch[0])
}
