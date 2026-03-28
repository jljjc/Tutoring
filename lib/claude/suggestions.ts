import { getChatCompletionText, OPENAI_TUTOR_MODEL } from './client'
import { formatSectionLabel, type SectionGapSummary, type TopicGapSummary } from '@/lib/report-analysis'

interface SuggestionsInput {
  recentTestsAnalyzed: number
  totalWrongAnswers: number
  sectionCounts: SectionGapSummary[]
  topicCounts: TopicGapSummary[]
}

function buildSuggestionFallback(input: SuggestionsInput): string[] {
  if (input.totalWrongAnswers === 0) {
    return [`No incorrect answers were recorded across the last ${input.recentTestsAnalyzed} completed test${input.recentTestsAnalyzed === 1 ? '' : 's'}.`]
  }

  const topSections = input.sectionCounts.slice(0, 2)
  const topTopics = input.topicCounts.slice(0, 3)
  const suggestions: string[] = []

  if (topSections.length > 0) {
    const sectionList = topSections
      .map(section => `${formatSectionLabel(section.section)} (${section.wrongCount} misses)`)
      .join(' and ')
    suggestions.push(`Prioritise ${sectionList} first, because those sections produced the most incorrect answers across recent tests.`)
  }

  for (const topic of topTopics) {
    suggestions.push(
      `Spend 10-15 minutes three times a week on ${topic.topic.toLowerCase()} in ${formatSectionLabel(topic.section)}, then finish with 2-3 fresh questions to check the idea sticks.`
    )
  }

  if (input.topicCounts.every(topic => topic.occurrenceCount === 1)) {
    suggestions.push('The errors are spread across several one-off topics, so use mixed review sets and ask the student to explain their reasoning aloud after each question.')
  }

  return suggestions.slice(0, 5)
}

export async function generateSuggestions(input: SuggestionsInput): Promise<string[]> {
  if (input.totalWrongAnswers === 0) {
    return buildSuggestionFallback(input)
  }

  const sectionList = input.sectionCounts
    .map(section => `- ${formatSectionLabel(section.section)}: ${section.wrongCount} incorrect answers`)
    .join('\n')
  const topicList = input.topicCounts
    .slice(0, 8)
    .map(topic => `- ${topic.topic} (${formatSectionLabel(topic.section)}): ${topic.occurrenceCount} misses`)
    .join('\n')

  try {
    const text = await getChatCompletionText({
      model: OPENAI_TUTOR_MODEL,
      prompt: `A Western Australian Year 6 student preparing for Year 7 selective-entry tests has completed ${input.recentTestsAnalyzed} recent tests with ${input.totalWrongAnswers} incorrect answers.

Section evidence:
${sectionList || '- none'}

Topic evidence:
${topicList || '- none'}

Write 3-5 specific, parent-facing improvement suggestions.

Rules:
- Base every suggestion on the evidence above
- Name the weak skill or topic explicitly
- Recommend a concrete practice routine
- Mention frequency or volume
- Do not say "no major gaps identified" when there are incorrect answers

Return valid JSON only in this shape:
{
  "suggestions": ["..."]
}`,
      maxTokens: 512,
      json: true,
    })

    const parsed = JSON.parse(text) as { suggestions?: string[] }
    const suggestions = (parsed.suggestions ?? []).filter(Boolean)
    return suggestions.length > 0 ? suggestions : buildSuggestionFallback(input)
  } catch (error) {
    console.error('[suggestions] failed:', error)
    return buildSuggestionFallback(input)
  }
}
