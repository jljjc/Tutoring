import { getClaudeClient } from './client'
import type { WritingScores, TestType } from '@/lib/types'

interface ScoreWritingResult {
  scores: WritingScores
  feedback: string
  followUpPrompt: string
  weakestCriterion: keyof WritingScores
}

export async function scoreWriting(params: {
  prompt: string
  responseText: string
  testType: TestType
}): Promise<ScoreWritingResult> {
  const client = getClaudeClient()

  const systemPrompt = `You are an experienced Australian primary school writing assessor marking Year 6 students preparing for the ${params.testType === 'gate' ? 'GATE/ASET' : 'scholarship'} test.`

  const userPrompt = `Writing prompt given to student:
"${params.prompt}"

Student's response:
"${params.responseText}"

Score this response on 5 criteria, each from 1 (very weak) to 5 (excellent):
1. Ideas & Content (relevance, depth, originality)
2. Structure & Organisation (intro, paragraphing, conclusion)
3. Vocabulary (word choice, variety, precision)
4. Grammar & Punctuation (sentence construction, punctuation)
5. Spelling (accuracy)

Then provide:
- Specific feedback (2-3 sentences) referencing the student's actual text
- A follow-up writing prompt targeting their weakest criterion

Return ONLY valid JSON, no other text:
{
  "scores": {
    "ideas": 1-5,
    "structure": 1-5,
    "vocabulary": 1-5,
    "grammar": 1-5,
    "spelling": 1-5
  },
  "feedback": "...",
  "follow_up_prompt": "..."
}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Claude returned non-JSON response: ${text.slice(0, 200)}`)
  }

  const scores = parsed.scores as WritingScores
  const weakestCriterion = (Object.entries(scores) as [keyof WritingScores, number][])
    .sort(([, a], [, b]) => a - b)[0][0]

  return {
    scores,
    feedback: parsed.feedback as string,
    followUpPrompt: parsed.follow_up_prompt as string,
    weakestCriterion,
  }
}
