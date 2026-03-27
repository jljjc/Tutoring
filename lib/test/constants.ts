import type { TestType } from '@/lib/types'

export interface SectionConfig {
  key: string
  label: string
  type: 'mcq' | 'writing'
  questionCount: number
  timeLimitSecs: number
}

export const TEST_CONFIG: Record<TestType, SectionConfig[]> = {
  gate: [
    { key: 'reading_comprehension', label: 'Reading Comprehension', type: 'mcq', questionCount: 35, timeLimitSecs: 35 * 60 },
    { key: 'writing', label: 'Communicating Ideas in Writing', type: 'writing', questionCount: 1, timeLimitSecs: 25 * 60 },
    { key: 'quantitative_reasoning', label: 'Quantitative Reasoning', type: 'mcq', questionCount: 35, timeLimitSecs: 35 * 60 },
    { key: 'abstract_reasoning', label: 'Abstract Reasoning', type: 'mcq', questionCount: 35, timeLimitSecs: 20 * 60 },
  ],
  scholarship: [
    { key: 'english', label: 'English (Reading + Language)', type: 'mcq', questionCount: 30, timeLimitSecs: 30 * 60 },
    { key: 'writing', label: 'Written Expression', type: 'writing', questionCount: 1, timeLimitSecs: 20 * 60 },
    { key: 'mathematics', label: 'Mathematics', type: 'mcq', questionCount: 30, timeLimitSecs: 30 * 60 },
    { key: 'general_ability', label: 'General Ability / Reasoning', type: 'mcq', questionCount: 30, timeLimitSecs: 20 * 60 },
  ],
}

// Difficulty distribution per MCQ section
export const DIFFICULTY_DIST = { easy: 0.30, medium: 0.50, hard: 0.20 }

// Difficulty int mapping
export const DIFFICULTY_RANGE = {
  easy: [1, 2] as [number, number],
  medium: [3, 4] as [number, number],
  hard: [5, 5] as [number, number],
}

// Writing score range constants
export const WRITING_RAW_MAX = 25  // sum of 5 criteria × max 5 each
export const WRITING_NORM_MAX = 35 // normalised to same scale as MCQ sections

// Approximate TSS percentile bands (heuristic for PoC)
export const TSS_BANDS = [
  { minTss: 360, label: 'Top 5%' },
  { minTss: 340, label: 'Top 10%' },
  { minTss: 320, label: 'Top 15%' },
  { minTss: 300, label: 'Top 25%' },
  { minTss: 280, label: 'Top 35%' },
  { minTss: 0, label: 'Below Top 35%' },
]
