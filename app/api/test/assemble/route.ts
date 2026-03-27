import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildDifficultySlots, selectQuestions, shuffleArray } from '@/lib/test/assemble'
import { TEST_CONFIG } from '@/lib/test/constants'
import { generateQuestions } from '@/lib/claude/generate-questions'
import { generateWritingPrompt } from '@/lib/claude/generate-writing-prompt'
import type { TestType, TestMode } from '@/lib/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { testType, mode, sectionKey } = await request.json() as {
    testType: TestType; mode: TestMode; sectionKey?: string
  }

  if (!testType || !mode) {
    return NextResponse.json({ error: 'testType and mode are required' }, { status: 400 })
  }

  // Get all question IDs this student has already seen
  const { data: seenAnswers } = await supabase
    .from('test_answers')
    .select('question_id, test_sessions!inner(student_id)')
    .eq('test_sessions.student_id', user.id)
  const seenIds = new Set((seenAnswers ?? []).map(a => (a as { question_id: string }).question_id))

  const sections = mode === 'practice' && sectionKey
    ? TEST_CONFIG[testType].filter(s => s.key === sectionKey)
    : TEST_CONFIG[testType]

  // Create session
  const { data: session, error: sessionError } = await supabase
    .from('test_sessions')
    .insert({ student_id: user.id, test_type: testType, mode })
    .select()
    .single()
  if (sessionError) {
    console.error('[test/assemble] session create failed:', sessionError.message)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  const assembledSections: Record<string, Array<{ id: string; difficulty: number }>> = {}
  const writingPrompts: Record<string, string> = {}

  for (const section of sections) {
    if (section.type === 'writing') {
      writingPrompts[section.key] = await generateWritingPrompt(testType)
      continue
    }

    const slots = buildDifficultySlots(section.questionCount)

    // Fetch bank for this section
    const { data: bank } = await supabase
      .from('question_bank')
      .select('id, difficulty')
      .eq('test_type', testType)
      .eq('section', section.key)

    let selected = selectQuestions(bank ?? [], seenIds, slots)

    if (!selected) {
      // Generate 10 questions per difficulty band to refill the bank
      for (const difficulty of [1, 3, 5]) {
        await generateQuestions({
          testType, section: section.key,
          topic: section.key.replace(/_/g, ' '),
          difficulty, count: 10,
        })
      }
      const { data: refreshedBank } = await supabase
        .from('question_bank').select('id, difficulty')
        .eq('test_type', testType).eq('section', section.key)
      selected = selectQuestions(refreshedBank ?? [], seenIds, slots) ?? []
    }

    assembledSections[section.key] = shuffleArray(selected)
  }

  // Fetch full question data for all assembled IDs
  const allIds = Object.values(assembledSections).flat().map(q => q.id)
  const { data: questions } = allIds.length > 0
    ? await supabase.from('question_bank').select('*').in('id', allIds)
    : { data: [] }

  return NextResponse.json({
    session,
    sections,
    questions: questions ?? [],
    writingPrompts,
  })
}
