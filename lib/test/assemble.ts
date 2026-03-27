import { DIFFICULTY_DIST } from './constants'

export interface DifficultySlots {
  easy: number
  medium: number
  hard: number
}

export function buildDifficultySlots(total: number): DifficultySlots {
  const easy = Math.floor(total * DIFFICULTY_DIST.easy)
  const hard = Math.floor(total * DIFFICULTY_DIST.hard)
  const medium = total - easy - hard
  return { easy, medium, hard }
}

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Given the full question bank and a set of already-seen question IDs,
 * returns a selection of unseen questions matching the required difficulty distribution.
 * Returns null if the bank doesn't have enough unseen questions (caller should generate more).
 */
export function selectQuestions(
  bank: Array<{ id: string; difficulty: number }>,
  seenIds: Set<string>,
  slots: DifficultySlots
): Array<{ id: string; difficulty: number }> | null {
  const unseen = bank.filter(q => !seenIds.has(q.id))

  const easyPool = unseen.filter(q => q.difficulty <= 2)
  const mediumPool = unseen.filter(q => q.difficulty >= 3 && q.difficulty <= 4)
  const hardPool = unseen.filter(q => q.difficulty === 5)

  if (easyPool.length < slots.easy || mediumPool.length < slots.medium || hardPool.length < slots.hard) {
    return null // insufficient — caller must generate more
  }

  return [
    ...shuffleArray(easyPool).slice(0, slots.easy),
    ...shuffleArray(mediumPool).slice(0, slots.medium),
    ...shuffleArray(hardPool).slice(0, slots.hard),
  ]
}
