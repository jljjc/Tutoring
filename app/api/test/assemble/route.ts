export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildDifficultySlots, selectQuestions, shuffleArray } from '@/lib/test/assemble'
import { TEST_CONFIG } from '@/lib/test/constants'
import { generateQuestions } from '@/lib/claude/generate-questions'
import { generateWritingPrompt } from '@/lib/claude/generate-writing-prompt'
import type { TestType, TestMode, Question } from '@/lib/types'
import { randomUUID } from 'crypto'

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

  const { data: seenAnswers } = await supabase
    .from('test_answers')
    .select('question_id, test_sessions!inner(student_id)')
    .eq('test_sessions.student_id', user.id)
  const seenIds = new Set((seenAnswers ?? []).map(a => (a as { question_id: string }).question_id))

  const sections = mode === 'practice' && sectionKey
    ? TEST_CONFIG[testType].filter(s => s.key === sectionKey)
    : TEST_CONFIG[testType]

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
  // Cache generated questions in memory so we can return them even if DB insert fails
  const generatedQuestionCache = new Map<string, Question>()

  // Process sections sequentially to avoid a burst of expensive model calls that
  // can trigger rate limits or long tail latency in preview deployments.
  for (const section of sections) {
    try {
      if (section.type === 'writing') {
        writingPrompts[section.key] = await generateWritingPrompt(testType)
        continue
      }

      const slots = buildDifficultySlots(section.questionCount)

      const { data: bank } = await supabase
        .from('question_bank')
        .select('id, difficulty')
        .eq('test_type', testType)
        .eq('section', section.key)

      let selected = selectQuestions(bank ?? [], seenIds, slots)

      if (!selected) {
        const shortfallCounts = {
          easy: Math.max(0, slots.easy - (bank ?? []).filter(q => !seenIds.has(q.id) && q.difficulty <= 2).length),
          medium: Math.max(0, slots.medium - (bank ?? []).filter(q => !seenIds.has(q.id) && q.difficulty >= 3 && q.difficulty <= 4).length),
          hard: Math.max(0, slots.hard - (bank ?? []).filter(q => !seenIds.has(q.id) && q.difficulty === 5).length),
        }

        // Generate only what is missing, plus a tiny buffer, instead of always asking
        // for 30 questions per section. This keeps preview requests much lighter.
        const generatedWithIds: Array<{ id: string; difficulty: number }> = []

        const generationPlan = [
          { difficulty: 1, count: shortfallCounts.easy > 0 ? shortfallCounts.easy + 2 : 0 },
          { difficulty: 3, count: shortfallCounts.medium > 0 ? shortfallCounts.medium + 2 : 0 },
          { difficulty: 5, count: shortfallCounts.hard > 0 ? shortfallCounts.hard + 2 : 0 },
        ].filter(item => item.count > 0)

        const batches = []
        for (const item of generationPlan) {
          batches.push(await generateQuestions({
            testType,
            section: section.key,
            topic: section.key.replace(/_/g, ' '),
            difficulty: item.difficulty,
            count: item.count,
          }))
        }

        for (const questions of batches) {
          // Try to insert into DB for future reuse
          const { data: inserted } = await supabase
            .from('question_bank')
            .insert(questions)
            .select('*')

          if (inserted && inserted.length > 0) {
            // DB insert succeeded — use real IDs
            for (const q of inserted as Question[]) {
              generatedWithIds.push({ id: q.id, difficulty: q.difficulty })
              generatedQuestionCache.set(q.id, q)
            }
          } else {
            // DB insert failed (likely RLS) — assign temp UUIDs so test still works
            for (const q of questions) {
              const id = randomUUID()
              const full = { ...q, id, generated_at: new Date().toISOString() } as Question
              generatedWithIds.push({ id, difficulty: q.difficulty })
              generatedQuestionCache.set(id, full)
            }
          }
        }

        selected = selectQuestions(generatedWithIds, seenIds, slots)
          ?? generatedWithIds.slice(0, slots.easy + slots.medium + slots.hard)
      }

      assembledSections[section.key] = shuffleArray(selected)
    } catch (error) {
      console.error('[test/assemble] section generation failed:', {
        section: section.key,
        testType,
        mode,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Fetch DB questions, then merge with any in-memory generated ones
  const allIds = Object.values(assembledSections).flat().map(q => q.id)
  const { data: dbQuestions } = allIds.length > 0
    ? await supabase.from('question_bank').select('*').in('id', allIds)
    : { data: [] }

  const dbById = new Map((dbQuestions ?? []).map((q: Question) => [q.id, q]))
  const questions = allIds.map(id => dbById.get(id) ?? generatedQuestionCache.get(id)).filter(Boolean) as Question[]

  return NextResponse.json({
    session,
    sections,
    questions,
    writingPrompts,
  })
}
