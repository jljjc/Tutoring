import { describe, it, expect } from 'vitest'
import { computeSectionScores, computeTSS, getTSSBand } from './scoring'

describe('computeSectionScores', () => {
  it('counts correct answers per section', () => {
    const answers = [
      { section: 'reading_comprehension', is_correct: true },
      { section: 'reading_comprehension', is_correct: false },
      { section: 'quantitative_reasoning', is_correct: true },
    ]
    const result = computeSectionScores(answers as any)
    expect(result.reading_comprehension).toBe(1)
    expect(result.quantitative_reasoning).toBe(1)
  })
})

describe('computeTSS', () => {
  it('returns 400 for perfect scores', () => {
    const sectionScores = {
      reading_comprehension: 35,
      quantitative_reasoning: 35,
      abstract_reasoning: 35,
      writing_total: 25,
    }
    expect(computeTSS(sectionScores, 'gate')).toBe(400)
  })

  it('normalises writing_total from 0-25 to 0-35 range', () => {
    const sectionScores = {
      reading_comprehension: 0,
      quantitative_reasoning: 0,
      abstract_reasoning: 0,
      writing_total: 25, // perfect writing
    }
    // writing normalised = 25/25 * 35 = 35, other sections 0 → TSS = (35/35) * 100 = 25% → 100
    const tss = computeTSS(sectionScores, 'gate')
    expect(tss).toBe(100)
  })
})

describe('getTSSBand', () => {
  it('returns correct band for TSS score', () => {
    expect(getTSSBand(350)).toBe('Top 10%')
    expect(getTSSBand(295)).toBe('Top 35%')
    expect(getTSSBand(270)).toBe('Below Top 35%')
  })
})
