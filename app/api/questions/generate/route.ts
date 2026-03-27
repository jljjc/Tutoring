import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateQuestions } from '@/lib/claude/generate-questions'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { testType, section, topic, difficulty, count } = body
  if (!testType || !section || !topic || difficulty == null || !count) {
    return NextResponse.json({ error: 'Missing required fields: testType, section, topic, difficulty, count' }, { status: 400 })
  }

  try {
    const questions = await generateQuestions({ testType, section, topic, difficulty, count })
    const { data, error } = await supabase.from('question_bank').insert(questions).select()
    if (error) throw error
    return NextResponse.json({ questions: data })
  } catch (err: unknown) {
    console.error('[questions/generate] error:', err)
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
  }
}
