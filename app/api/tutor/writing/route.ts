import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tutorWriting } from '@/lib/claude/tutor-writing'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, writingResponseId, criterion } = await request.json()
  if (!sessionId || !writingResponseId || !criterion) {
    return NextResponse.json({ error: 'sessionId, writingResponseId, and criterion are required' }, { status: 400 })
  }

  const { data: wr } = await supabase
    .from('writing_responses').select('*').eq('id', writingResponseId).single()
  if (!wr) return NextResponse.json({ error: 'Writing response not found' }, { status: 404 })

  let feedback: string
  let followUpPrompt: string
  try {
    const result = await tutorWriting({
      criterion,
      originalPrompt: wr.prompt,
      originalResponse: wr.response_text,
      originalScores: wr.scores,
    })
    feedback = result.feedback
    followUpPrompt = result.followUpPrompt
  } catch (err: unknown) {
    console.error('[tutor/writing] AI error:', err)
    return NextResponse.json({ error: 'Failed to generate writing feedback' }, { status: 500 })
  }

  const { data: wts, error: insertError } = await supabase.from('writing_tutoring_sessions').insert({
    session_id: sessionId,
    writing_response_id: writingResponseId,
    student_id: user.id,
    criterion,
    follow_up_prompt: followUpPrompt,
  }).select('id').single()

  if (insertError || !wts) {
    console.error('[tutor/writing] insert failed:', insertError?.message)
    return NextResponse.json({ error: 'Failed to save writing tutoring session' }, { status: 500 })
  }

  return NextResponse.json({ feedback, followUpPrompt, writingTutoringSessionId: wts.id })
}
