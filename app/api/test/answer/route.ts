import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, questionId, selectedAnswer, isCorrect, timeTakenSecs } = await request.json()
  if (!sessionId || !questionId) {
    return NextResponse.json({ error: 'sessionId and questionId are required' }, { status: 400 })
  }

  const { error } = await supabase.from('test_answers').upsert({
    session_id: sessionId,
    question_id: questionId,
    selected_answer: selectedAnswer,
    is_correct: isCorrect,
    time_taken_secs: timeTakenSecs,
  }, { onConflict: 'session_id,question_id' })

  if (error) {
    console.error('[test/answer] upsert failed:', error.message)
    return NextResponse.json({ error: 'Failed to save answer' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
