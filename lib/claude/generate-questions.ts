import { getChatCompletionText } from './client'
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

Return ONLY a valid JSON object, no other text:
{
  "questions": [
    {
      "question_text": "...",
      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "correct_answer": "A",
      "explanation": "..."
    }
  ]
}`

  const text = await getChatCompletionText({
    prompt,
    maxTokens: 4096,
    json: true,
  })

  let parsed: { questions?: unknown[] }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`OpenAI returned non-JSON response: ${text.slice(0, 200)}`)
  }

  return (parsed.questions ?? []).map((q) => {
    const question = q as {
      question_text: string
      options: { A: string; B: string; C: string; D: string }
      correct_answer: string
      explanation: string
    }

    return {
      test_type: testType,
      section,
      topic,
      difficulty,
      question_text: question.question_text,
      options: question.options,
      correct_answer: question.correct_answer,
      explanation: question.explanation,
    }
  })
}
