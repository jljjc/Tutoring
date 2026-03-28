import { getChatCompletionText, OPENAI_TUTOR_MODEL } from './client'
import { formatSectionLabel } from '@/lib/report-analysis'

interface WrongQuestionSummary {
  topic: string
  section: string
  selectedAnswer: string | null
  correctAnswer: string
  questionText?: string
  explanation?: string
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

function buildFallbackTestGapAnalysis(wrongQuestions: WrongQuestionSummary[]): TestGapAnalysis | null {
  if (wrongQuestions.length === 0) return null

  const grouped = new Map<string, { section: string; topic: string; count: number }>()
  for (const question of wrongQuestions) {
    const key = `${question.section}::${question.topic}`
    const current = grouped.get(key)
    if (current) {
      current.count += 1
    } else {
      grouped.set(key, {
        section: question.section,
        topic: question.topic,
        count: 1,
      })
    }
  }

  const topGroups = Array.from(grouped.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.topic.localeCompare(b.topic)
    })
    .slice(0, 3)

  const sectionCounts = new Map<string, number>()
  for (const question of wrongQuestions) {
    sectionCounts.set(question.section, (sectionCounts.get(question.section) ?? 0) + 1)
  }

  const topSection = Array.from(sectionCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]

  const summaryBits: string[] = []
  if (topSection) {
    summaryBits.push(
      `Most of the review is in ${formatSectionLabel(topSection[0])}, with ${topSection[1]} incorrect question${topSection[1] === 1 ? '' : 's'}.`
    )
  }
  if (topGroups.length > 0) {
    const topicList = topGroups.map(group => `${group.topic} (${formatSectionLabel(group.section)})`).join(', ')
    summaryBits.push(`The clearest gaps from this test were ${topicList}.`)
  }
  summaryBits.push('Focus next practice on explaining the rule behind each mistake, then completing a few fresh questions on the same skill.')

  return {
    summary: summaryBits.join(' '),
    gaps: topGroups.map(group => ({
      section: group.section,
      skill: group.topic,
      whyItMatters: group.count >= 2
        ? `This skill caused ${group.count} separate errors in the same test, which points to a repeatable reasoning gap rather than a one-off slip.`
        : 'This skill produced a clear mistake in the test and is worth reviewing before the next sitting.',
      nextStep: `Review ${group.topic.toLowerCase()} in ${formatSectionLabel(group.section)}, then do 3-5 fresh questions and explain each answer aloud.`,
    })),
  }
}

function shouldUseFallback(parsed: TestGapAnalysis | null): boolean {
  if (!parsed) return true
  if (!parsed.summary || parsed.gaps.length === 0) return true

  const loweredSummary = parsed.summary.toLowerCase()
  return loweredSummary.includes('no major gap')
    || loweredSummary.includes('no significant gap')
    || loweredSummary.includes('no major knowledge gap')
}

export async function generateTestGapAnalysis(
  wrongQuestions: WrongQuestionSummary[]
): Promise<TestGapAnalysis | null> {
  if (wrongQuestions.length === 0) return null

  const wrongList = wrongQuestions
    .map((item, index) => (
      `${index + 1}. Section: ${item.section}; Topic: ${item.topic}; ` +
      `Student chose: ${item.selectedAnswer ?? 'blank'}; Correct answer: ${item.correctAnswer}; ` +
      `Question: ${item.questionText ?? 'n/a'}; Explanation: ${item.explanation ?? 'n/a'}`
    ))
    .join('\n')

  try {
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
 - Return 2 to 5 gaps max
 - Do not claim there are no major gaps when the student has made mistakes
 - Every gap must be supported by the mistakes listed above`,
      maxTokens: 900,
      json: true,
    })

    const parsed = JSON.parse(text) as TestGapAnalysis
    if (shouldUseFallback(parsed)) {
      return buildFallbackTestGapAnalysis(wrongQuestions)
    }

    return {
      summary: parsed.summary,
      gaps: parsed.gaps ?? [],
    }
  } catch (error) {
    console.error('[test-gap-analysis] failed:', error)
    return buildFallbackTestGapAnalysis(wrongQuestions)
  }
}
