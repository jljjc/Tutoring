import { getChatCompletionText, OPENAI_TUTOR_MODEL } from './client'
import type { Question } from '@/lib/types'

export interface ConceptCheck {
  question_text: string
  options: { A: string; B: string; C: string; D: string }
  correct_answer: string
  explanation: string
}

export interface GapQuestion {
  question_text: string
  options: { A: string; B: string; C: string; D: string }
  correct_answer: string
  difficulty: number
  explanation: string
  topic: string
  section: string
  test_type: string
}

export interface TutorMcqResult {
  explanation: string
  conceptChecks: ConceptCheck[]
  gapQuestion: GapQuestion
}

export async function tutorMcq(params: {
  question: Question
  wrongAnswer: string
  attemptNumber: number
}): Promise<TutorMcqResult> {
  const { question, wrongAnswer, attemptNumber } = params

  const optionsList = Object.entries(question.options)
    .map(([k, v]) => `${k}: ${v}`).join('\n')

  const gapDifficulty = Math.min(5, question.difficulty + 1)

  const prompt = `You are a skilled tutor helping a Year 6 student (age 11-12) who answered a ${question.section.replace(/_/g, ' ')} question incorrectly.

QUESTION: "${question.question_text}"
OPTIONS:
${optionsList}
CORRECT ANSWER: ${question.correct_answer} — ${question.options[question.correct_answer as keyof typeof question.options]}
STUDENT CHOSE: ${wrongAnswer} — ${question.options[wrongAnswer as keyof typeof question.options]}
ATTEMPT NUMBER: ${attemptNumber} (max 3)
${attemptNumber > 1 ? '\nThe student has already attempted a similar question and got it wrong. Take a different explanation angle this time.' : ''}

Your task has THREE parts:

PART 1 — EXPLANATION (student-facing, warm and encouraging):
- Explain specifically why "${wrongAnswer}" is wrong
- Explain clearly why "${question.correct_answer}" is correct
- Give a memory tip or strategy to avoid this mistake
- Keep it to 3-4 sentences, friendly tone for an 11-year-old

PART 2 — CONCEPT CHECKS (1 to 3 questions):
Decide how many concept/theory checks the student needs based on the complexity of the underlying skill.
- Simple topic (e.g. basic vocabulary): 1 check
- Moderate topic (e.g. multi-step reasoning): 2 checks
- Complex topic (e.g. abstract patterns, advanced problem types): 3 checks
Each check must target a prerequisite concept or formula BEFORE the harder question.
These should be quick, focused, and easier than the original.

PART 3 — GAP QUESTION (difficulty ${gapDifficulty}/5):
Write one targeted question at difficulty ${gapDifficulty}/5 that:
- Tests the SAME underlying skill but in a different context/wording
- Is harder and more probing than the original
- Exposes whether the student truly understands, not just memorised the answer
- Must NOT reuse any words or numbers from the original question

Return ONLY valid JSON — no markdown, no extra text:
{
  "explanation": "...",
  "concept_checks": [
    {
      "question_text": "...",
      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "correct_answer": "B",
      "explanation": "..."
    }
  ],
  "gap_question": {
    "question_text": "...",
    "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
    "correct_answer": "C",
    "difficulty": ${gapDifficulty},
    "explanation": "...",
    "topic": "${question.topic}",
    "section": "${question.section}",
    "test_type": "${question.test_type}"
  }
}`

  const text = await getChatCompletionText({
    model: OPENAI_TUTOR_MODEL,
    prompt,
    maxTokens: 2048,
    json: true,
  })

  let parsed: {
    explanation: string
    concept_checks: ConceptCheck[]
    gap_question: GapQuestion
  }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`OpenAI returned non-JSON: ${text.slice(0, 200)}`)
  }

  return {
    explanation: parsed.explanation,
    conceptChecks: parsed.concept_checks,
    gapQuestion: parsed.gap_question,
  }
}
