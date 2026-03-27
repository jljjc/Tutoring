export type UserRole = 'student' | 'parent'
export type TestType = 'gate' | 'scholarship'
export type TestMode = 'full' | 'practice'

export interface User {
  id: string
  role: UserRole
  full_name: string
  created_at: string
}

export interface StudentProfile {
  id: string
  parent_id: string | null
  year_level: number
  school: string | null
  target_schools: string[] | null
}

export interface Question {
  id: string
  test_type: TestType
  section: string
  topic: string
  difficulty: number
  question_text: string
  options: { A: string; B: string; C: string; D: string }
  correct_answer: string
  explanation: string
  generated_at: string
}

export interface TestSession {
  id: string
  student_id: string
  test_type: TestType
  mode: TestMode
  started_at: string
  completed_at: string | null
  total_score: number | null
  section_scores: Record<string, number> | null
  projected_tss: number | null
}

export interface TestAnswer {
  id: string
  session_id: string
  question_id: string
  selected_answer: string | null
  is_correct: boolean | null
  time_taken_secs: number | null
}

export interface WritingResponse {
  id: string
  session_id: string
  prompt: string
  response_text: string
  scores: WritingScores | null
  ai_feedback: string | null
  follow_up_prompt: string | null
}

export interface WritingScores {
  ideas: number
  structure: number
  vocabulary: number
  grammar: number
  spelling: number
}

export interface TutoringSession {
  id: string
  session_id: string
  student_id: string
  question_id: string
  wrong_answer: string
  ai_explanation: string | null
  followup_question: Omit<Question, 'id' | 'generated_at'> | null
  mastered: boolean
  attempts: number
}

export interface WritingTutoringSession {
  id: string
  session_id: string
  writing_response_id: string
  student_id: string
  criterion: keyof WritingScores
  follow_up_prompt: string | null
  resubmission_text: string | null
  updated_scores: WritingScores | null
  improved: boolean | null
  created_at: string
}

export interface WritingCriterion {
  criterion: keyof WritingScores
  label: string
}

export const WRITING_CRITERIA: WritingCriterion[] = [
  { criterion: 'ideas', label: 'Ideas & Content' },
  { criterion: 'structure', label: 'Structure & Organisation' },
  { criterion: 'vocabulary', label: 'Vocabulary' },
  { criterion: 'grammar', label: 'Grammar & Punctuation' },
  { criterion: 'spelling', label: 'Spelling' },
]
