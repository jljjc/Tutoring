import { getChatCompletionText, OPENAI_TUTOR_MODEL } from './client'

interface WrongQuestionSummary {
  topic: string
  section: string
  selectedAnswer: string | null
  correctAnswer: string
}

export interface TestGapAnalysis {
  summary: string
  gaps: Array<{
    section: string
    skill: string
    whyItMatters: string
    nextStep: string
  }>
}

export async function generateTestGapAnalysis(
  wrongQuestions: WrongQuestionSummary[]
): Promise<TestGapAnalysis | null> {
  if (wrongQuestions.length === 0) return null

  const wrongList = wrongQuestions
    .map((item, index) => (
      `${index + 1}. Section: ${item.section}; Topic: ${item.topic}; ` +
      `Student chose: ${item.selectedAnswer ?? 'blank'}; Correct answer: ${item.correctAnswer}`
    ))
    .join('\n')

  const text = await getChatCompletionText({
    model: OPENAI_TUTOR_MODEL,
    prompt: `You are writing a concise parent-facing analysis for one completed selective-entry practice test.

The student is a high-performing Western Australian Year 6 student preparing for Year 7 entry tests.

Analyse the mistakes below and identify the underlying knowledge gaps.

Wrong questions:
${wrongList}

Return ONLY valid JSON in this shape:
{
  "summary": "2-3 sentence plain-English summary for the parent",
  "gaps": [
    {
      "section": "reading_comprehension",
      "skill": "Inference from evidence",
      "whyItMatters": "Short explanation",
      "nextStep": "Concrete next practice step"
    }
  ]
}

Rules:
- Combine repeated mistakes into broader skills where appropriate
- Focus on reasoning gaps, not just topic labels
- Keep the summary practical and parent-friendly
- Return 2 to 5 gaps max`,
    maxTokens: 900,
    json: true,
  })

  const parsed = JSON.parse(text) as TestGapAnalysis
  return {
    summary: parsed.summary,
    gaps: parsed.gaps ?? [],
  }
}
