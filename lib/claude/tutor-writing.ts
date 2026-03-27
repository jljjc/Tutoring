import { getClaudeClient } from './client'
import type { WritingScores } from '@/lib/types'

export async function tutorWriting(params: {
  criterion: keyof WritingScores
  originalPrompt: string
  originalResponse: string
  originalScores: WritingScores
}): Promise<{ feedback: string; followUpPrompt: string }> {
  const client = getClaudeClient()
  const criterionLabels: Record<keyof WritingScores, string> = {
    ideas: 'Ideas & Content',
    structure: 'Structure & Organisation',
    vocabulary: 'Vocabulary',
    grammar: 'Grammar & Punctuation',
    spelling: 'Spelling',
  }

  const prompt = `You are a writing tutor helping a Year 6 student improve their "${criterionLabels[params.criterion]}" in writing.

Original prompt: "${params.originalPrompt}"
Student's response: "${params.originalResponse}"
Score for ${criterionLabels[params.criterion]}: ${params.originalScores[params.criterion]}/5

Give:
1. Specific feedback referencing the student's actual text — what they did and exactly how to improve it
2. A new short writing prompt that specifically exercises "${criterionLabels[params.criterion]}"

Return ONLY valid JSON:
{
  "feedback": "...",
  "follow_up_prompt": "..."
}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  let parsed: { feedback: string; follow_up_prompt: string }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Claude returned non-JSON response: ${text.slice(0, 200)}`)
  }
  return { feedback: parsed.feedback, followUpPrompt: parsed.follow_up_prompt }
}
