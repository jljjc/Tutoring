import { getClaudeClient } from './client'
import type { Question, TestType } from '@/lib/types'

interface GenerateQuestionsParams {
  testType: TestType
  section: string
  topic: string
  difficulty: number
  count: number
}

export async function generateQuestions(params: GenerateQuestionsParams): Promise<Omit<Question, 'id' | 'generated_at'>[]> {
  const { testType, section, topic, difficulty, count } = params
  const client = getClaudeClient()

  const diffLabel = difficulty <= 2 ? 'easy' : difficulty <= 4 ? 'medium' : 'hard'

  const isAbstractReasoning = section === 'abstract_reasoning'

  const abstractInstructions = isAbstractReasoning ? `
IMPORTANT for Abstract Reasoning: Since these are text-based questions, use unicode shapes and symbols to represent visual patterns. Use characters like: ▲ △ ● ○ ■ □ ◆ ◇ ★ ☆ ▶ ▷ and arrange them in grid or sequence format using spaces and newlines.

Example format for a sequence question:
"question_text": "What comes next in the pattern?\n\n  Row 1: ■  ■  □\n  Row 2: ■  □  □\n  Row 3: □  □  ?"

Example format for a matrix question:
"question_text": "Which shape completes the pattern?\n\n  ▲  ▲▲  ▲▲▲\n  ●  ●●  ●●●\n  ■  ■■   ?"

Make patterns that test: rotation, reflection, size progression, number sequence, shape transformation, or odd-one-out.` : ''

  const prompt = `You are creating multiple-choice questions for Western Australia Year 6 students preparing for the ${testType === 'gate' ? 'GATE/ASET test' : 'Academic Scholarship test'}.

Generate exactly ${count} multiple-choice questions for the "${section}" section on the topic "${topic}" at ${diffLabel} difficulty (level ${difficulty}/5).

Requirements:
- Appropriate for Year 6 students (age 11-12)
- Clear, unambiguous wording
- Four options (A, B, C, D) with exactly one correct answer
- Brief explanation of why the correct answer is right
${abstractInstructions}

Return ONLY a valid JSON array, no other text:
[
  {
    "question_text": "...",
    "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
    "correct_answer": "A",
    "explanation": "..."
  }
]`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  let parsed: unknown[]
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Claude returned non-JSON response: ${text.slice(0, 200)}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (parsed as any[]).map((q) => ({
    test_type: testType,
    section,
    topic,
    difficulty,
    question_text: q.question_text as string,
    options: q.options as { A: string; B: string; C: string; D: string },
    correct_answer: q.correct_answer as string,
    explanation: q.explanation as string,
  }))
}
