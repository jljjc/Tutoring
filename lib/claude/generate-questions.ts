import { getChatCompletionText, OPENAI_QUESTION_MODEL } from './client'
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

  const sectionGuidance: Record<string, string> = {
    reading_comprehension: 'Use short but information-dense passages. Questions should test inference, author intent, vocabulary-in-context, tone, and evidence, not just literal recall.',
    quantitative_reasoning: 'Use selective-entry style maths reasoning: multi-step arithmetic, number patterns, ratios, fractions, units, geometry, and worded problem solving. Avoid trivial single-step sums.',
    abstract_reasoning: 'Use true reasoning patterns: transformations, sequences, matrices, symmetry, rotation, reflection, positional logic, and rule detection.',
    english: 'Test advanced reading and language: grammar in context, cloze-style reasoning, vocabulary precision, sentence meaning, and comprehension.',
    mathematics: 'Use scholarship-style maths with multi-step reasoning, algebraic thinking, number sense, geometry, and problem solving. Avoid routine worksheet questions.',
    general_ability: 'Use competitive reasoning questions involving analogies, classification, logical deduction, coded relationships, and higher-order pattern recognition.',
  }

  const prompt = `You are creating premium-quality multiple-choice questions for high-performing Western Australian Year 6 students competing for Year 7 entry into ${testType === 'gate' ? 'GATE/ASET selective programs' : 'academic scholarship programs'}.

These students are upper-primary candidates sitting a competitive exam. Do NOT write questions that feel like they are for six-year-olds, early primary, or routine classroom worksheets.

Generate exactly ${count} multiple-choice questions for the "${section}" section on the topic "${topic}" at ${diffLabel} difficulty (level ${difficulty}/5).

Requirements:
- Use Australian English
- Target academically strong Year 6 students preparing for a competitive Year 7 entry exam
- Even "easy" questions must still feel like the easier end of a selective-entry paper, not trivial recall
- Medium questions should require genuine reasoning or multi-step thinking
- Hard questions should feel stretching, exam-standard, and intellectually fair
- Clear, unambiguous wording
- Four options (A, B, C, D) with exactly one correct answer
- Plausible distractors that reflect common mistakes
- Brief explanation of why the correct answer is right
- Avoid babyish scenarios, overly simple vocabulary, or one-step questions unless the section truly demands it
- Section guidance: ${sectionGuidance[section] ?? 'Make the question exam-like, rigorous, and age-appropriate for a selective-entry candidate.'}
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
    model: OPENAI_QUESTION_MODEL,
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
