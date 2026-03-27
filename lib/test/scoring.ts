import type { TestType } from '@/lib/types'
import type { WritingScores } from '@/lib/types'
import { TEST_CONFIG, TSS_BANDS, WRITING_RAW_MAX, WRITING_NORM_MAX } from './constants'

interface AnswerWithSection {
  section: string
  is_correct: boolean
}

export function computeSectionScores(
  answers: AnswerWithSection[]
): Record<string, number> {
  return answers.reduce((acc, a) => {
    if (a.is_correct) acc[a.section] = (acc[a.section] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
}

export function computeTSS(
  sectionScores: Record<string, number>,
  testType: TestType
): number {
  const sections = TEST_CONFIG[testType].filter(s => s.type === 'mcq')

  // Normalise writing (0–WRITING_RAW_MAX) → (0–WRITING_NORM_MAX)
  const writingRaw = sectionScores['writing_total'] ?? 0
  const writingNorm = (writingRaw / WRITING_RAW_MAX) * WRITING_NORM_MAX

  const allNorm = [
    ...sections.map(s => ({
      score: sectionScores[s.key] ?? 0,
      max: s.questionCount,
    })),
    { score: writingNorm, max: WRITING_NORM_MAX },
  ]

  const totalPercent = allNorm.reduce((sum, s) => sum + s.score / s.max, 0) / allNorm.length
  return Math.round(totalPercent * 400)
}

export function getTSSBand(tss: number): string {
  return TSS_BANDS.find(b => tss >= b.minTss)?.label ?? 'Below Top 35%'
}

export function computeWritingTotal(scores: WritingScores): number {
  return Object.values(scores).reduce((sum, v) => sum + v, 0)
}
