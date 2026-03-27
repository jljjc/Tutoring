import { getClaudeClient } from './client'

interface GapSummary {
  topic: string
  section: string
  attempts: number
}

export async function generateSuggestions(gaps: GapSummary[]): Promise<string[]> {
  if (gaps.length === 0) return ['Keep practising — no major gaps identified yet.']

  const client = getClaudeClient()
  const gapList = gaps.map(g => `- ${g.section}: ${g.topic} (${g.attempts} failed attempts)`).join('\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `A Year 6 student preparing for the WA GATE test has the following knowledge gaps:\n${gapList}\n\nWrite 3-5 specific, actionable improvement suggestions for their parent. Each suggestion should name the topic, recommend a concrete practice activity, and suggest a frequency (e.g. 10 min daily). Return a JSON array of strings, no other text.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  try {
    return JSON.parse(text) as string[]
  } catch {
    throw new Error(`Claude returned non-JSON response: ${text.slice(0, 200)}`)
  }
}
