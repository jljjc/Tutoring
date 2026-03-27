import { describe, it, expect } from 'vitest'
import { buildDifficultySlots, shuffleArray } from './assemble'

describe('buildDifficultySlots', () => {
  it('returns correct easy/medium/hard counts for 35 questions', () => {
    const slots = buildDifficultySlots(35)
    expect(slots.easy).toBe(10)   // floor(35 * 0.30) = 10
    expect(slots.medium).toBe(18) // remainder: 35 - 10 - 7 = 18
    expect(slots.hard).toBe(7)    // floor(35 * 0.20) = 7
    expect(slots.easy + slots.medium + slots.hard).toBe(35)
  })

  it('returns correct counts for 30 questions', () => {
    const slots = buildDifficultySlots(30)
    expect(slots.easy + slots.medium + slots.hard).toBe(30)
  })
})

describe('shuffleArray', () => {
  it('returns array of same length', () => {
    const arr = [1, 2, 3, 4, 5]
    expect(shuffleArray(arr)).toHaveLength(5)
  })

  it('contains same elements', () => {
    const arr = [1, 2, 3, 4, 5]
    expect(shuffleArray(arr).sort()).toEqual([1, 2, 3, 4, 5])
  })
})
