import { getClaudeClient } from './client'
import type { Question } from '@/lib/types'

interface TutorMcqResult {
  explanation: string
  followupQuestion: Omit<Question, 'id' | 'generated_at'>
}

export async function tutorMcq(params: {
  question: Question
  wrongAnswer: string
  attemptNumber: number
}): Promise<TutorMcqResult> {
  const client = getClaudeClient()
  const { question, wrongAnswer, attemptNumber } = params

  const optionsList = Object.entries(question.options)
    .map(([k, v]) => `${k}: ${v}`).join('\n')

  const prompt = `You are a patient tutor helping a Year 6 student who got a ${question.section.replace(/_/g, ' ')} question wrong.

Question: "${question.question_text}"
Options:
${optionsList}
Correct answer: ${question.correct_answer}
Student chose: ${wrongAnswer}
This is attempt ${attemptNumber} (max 3).

${attemptNumber > 1 ? 'The student got the follow-up question wrong too. Try a different explanation approach.' : ''}

Provide:
1. A clear explanation of WHY "${wrongAnswer}" is wrong (reference what that option actually means)
2. WHY "${question.correct_answer}" is correct
3. A memory tip or strategy to avoid this mistake
4. A new follow-up question testing the same concept (different wording)

Return ONLY valid JSON:
{
  "explanation": "...",
  "followup_question": {
    "question_text": "...",
    "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
    "correct_answer": "A",
    "topic": "${question.topic}",
    "section": "${question.section}",
    "test_type": "${question.test_type}",
    "difficulty": ${question.difficulty},
    "explanation": "..."
  }
}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Claude returned non-JSON response: ${text.slice(0, 200)}`)
  }

  return {
    explanation: parsed.explanation as string,
    followupQuestion: parsed.followup_question as Omit<Question, 'id' | 'generated_at'>,
  }
}
