import { getChatCompletionText, OPENAI_TUTOR_MODEL } from './client'

interface GapSummary {
  topic: string
  section: string
  attempts: number
}

export async function generateSuggestions(gaps: GapSummary[]): Promise<string[]> {
  if (gaps.length === 0) return ['Keep practising — no major gaps identified yet.']

  const gapList = gaps.map(g => `- ${g.section}: ${g.topic} (${g.attempts} failed attempts)`).join('\n')

  const text = await getChatCompletionText({
    model: OPENAI_TUTOR_MODEL,
    prompt: `A Year 6 student preparing for the WA GATE test has the following knowledge gaps:\n${gapList}\n\nWrite 3-5 specific, actionable improvement suggestions for their parent. Each suggestion should name the topic, recommend a concrete practice activity, and suggest a frequency (e.g. 10 min daily). Return a JSON object with a "suggestions" array of strings, no other text.`,
    maxTokens: 512,
    json: true,
  })

  try {
    const parsed = JSON.parse(text) as { suggestions?: string[] }
    return parsed.suggestions ?? []
  } catch {
    throw new Error(`OpenAI returned non-JSON response: ${text.slice(0, 200)}`)
  }
}
