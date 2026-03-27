import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scoreWriting } from '@/lib/claude/score-writing'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { writingTutoringSessionId, resubmissionText, testType } = await request.json()
  if (!writingTutoringSessionId || !resubmissionText || !testType) {
    return NextResponse.json({ error: 'writingTutoringSessionId, resubmissionText, and testType are required' }, { status: 400 })
  }

  const { data: wts } = await supabase
    .from('writing_tutoring_sessions')
    .select('*, writing_responses!inner(prompt)')
    .eq('id', writingTutoringSessionId)
    .single()
  if (!wts) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  type WtsRow = { criterion: string; writing_responses: { prompt: string } }
  const wtsRow = wts as unknown as WtsRow

  let result: Awaited<ReturnType<typeof scoreWriting>>
  try {
    result = await scoreWriting({
      prompt: wtsRow.writing_responses.prompt,
      responseText: resubmissionText,
      testType,
    })
  } catch (err: unknown) {
    console.error('[tutor/writing-attempt] Claude error:', err)
    return NextResponse.json({ error: 'Failed to score resubmission' }, { status: 500 })
  }

  const improved = result.scores[wtsRow.criterion as keyof typeof result.scores] >= 3

  const { error: updateError } = await supabase.from('writing_tutoring_sessions').update({
    resubmission_text: resubmissionText,
    updated_scores: result.scores,
    improved,
  }).eq('id', writingTutoringSessionId)

  if (updateError) {
    console.error('[tutor/writing-attempt] update failed:', updateError.message)
    return NextResponse.json({ error: 'Failed to save resubmission' }, { status: 500 })
  }

  return NextResponse.json({ scores: result.scores, feedback: result.feedback, improved })
}
