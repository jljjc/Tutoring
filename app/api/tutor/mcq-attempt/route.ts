import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tutoringSessionId, selectedAnswer, correctAnswer, conceptChecksPassed } = await request.json()
  if (!tutoringSessionId || !selectedAnswer || !correctAnswer) {
    return NextResponse.json({ error: 'tutoringSessionId, selectedAnswer, and correctAnswer are required' }, { status: 400 })
  }

  const mastered = selectedAnswer === correctAnswer

  const { data: ts } = await supabase
    .from('tutoring_sessions').select('attempts').eq('id', tutoringSessionId).single()

  const priorityGap = !mastered && (ts?.attempts ?? 0) >= 3

  const updatePayload: Record<string, unknown> = { mastered }
  if (typeof conceptChecksPassed === 'number') {
    updatePayload.concept_checks_passed = conceptChecksPassed
  }

  const { error: updateError } = await supabase
    .from('tutoring_sessions').update(updatePayload).eq('id', tutoringSessionId)
  if (updateError) console.error('[tutor/mcq-attempt] update failed:', updateError.message)

  return NextResponse.json({ mastered, priorityGap })
}
