import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tutorMcq, type ConceptCheck, type GapQuestion } from '@/lib/claude/tutor-mcq'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, questionId, wrongAnswer } = await request.json()
  if (!sessionId || !questionId || !wrongAnswer) {
    return NextResponse.json({ error: 'sessionId, questionId, and wrongAnswer are required' }, { status: 400 })
  }

  const { data: question } = await supabase
    .from('question_bank').select('*').eq('id', questionId).single()
  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

  const { data: existing } = await supabase
    .from('tutoring_sessions')
    .select('*').eq('session_id', sessionId).eq('question_id', questionId).single()

  const attempts = (existing?.attempts ?? 0) + 1

  let explanation: string
  let conceptChecks: ConceptCheck[]
  let gapQuestion: GapQuestion

  try {
    const result = await tutorMcq({ question, wrongAnswer, attemptNumber: attempts })
    explanation = result.explanation
    conceptChecks = result.conceptChecks
    gapQuestion = result.gapQuestion
  } catch (err: unknown) {
    console.error('[tutor/mcq] Claude error:', err)
    return NextResponse.json({ error: 'Failed to generate tutoring' }, { status: 500 })
  }

  let tutoringSessionId: string

  if (existing) {
    await supabase.from('tutoring_sessions').update({
      ai_explanation: explanation,
      followup_question: gapQuestion,
      attempts,
    }).eq('id', existing.id)
    tutoringSessionId = existing.id
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('tutoring_sessions').insert({
        session_id: sessionId,
        student_id: user.id,
        question_id: questionId,
        wrong_answer: wrongAnswer,
        ai_explanation: explanation,
        followup_question: gapQuestion,
        attempts,
        concept_checks_passed: 0,
      }).select('id').single()

    if (insertError || !inserted) {
      console.error('[tutor/mcq] insert failed:', insertError?.message)
      return NextResponse.json({ error: 'Failed to save tutoring session' }, { status: 500 })
    }
    tutoringSessionId = inserted.id
  }

  return NextResponse.json({
    explanation,
    conceptChecks,
    gapQuestion,
    attempts,
    tutoringSessionId,
  })
}
