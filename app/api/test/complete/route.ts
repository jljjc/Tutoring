import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeSectionScores, computeTSS, computeWritingTotal } from '@/lib/test/scoring'
import type { WritingScores } from '@/lib/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, writingResponse } = await request.json() as {
    sessionId: string
    writingResponse?: {
      prompt: string
      responseText: string
      scores: WritingScores
      aiFeedback: string
      followUpPrompt: string
    }
  }

  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })

  // Get session
  const { data: session } = await supabase
    .from('test_sessions').select('*').eq('id', sessionId).single()
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // Get all answers for this session with section info
  const { data: answers } = await supabase
    .from('test_answers')
    .select('is_correct, question_bank!inner(section)')
    .eq('session_id', sessionId)

  type AnswerRow = { is_correct: boolean; question_bank: { section: string } }
  const answersWithSection = (answers as unknown as AnswerRow[]).map(a => ({
    section: a.question_bank.section,
    is_correct: a.is_correct,
  }))

  const sectionScores = computeSectionScores(answersWithSection)
  // total_score = MCQ correct count only (writing stored separately in section_scores.writing_total)
  const totalScore = Object.values(sectionScores).reduce((sum, v) => sum + v, 0)

  // Save writing response if present
  if (writingResponse) {
    await supabase.from('writing_responses').insert({
      session_id: sessionId,
      prompt: writingResponse.prompt,
      response_text: writingResponse.responseText,
      scores: writingResponse.scores,
      ai_feedback: writingResponse.aiFeedback,
      follow_up_prompt: writingResponse.followUpPrompt,
    })
    sectionScores['writing_total'] = computeWritingTotal(writingResponse.scores)
  }

  // Compute TSS for full mode only
  const projectedTss = session.mode === 'full'
    ? computeTSS(sectionScores, session.test_type)
    : null

  const { error: updateError } = await supabase.from('test_sessions').update({
    completed_at: new Date().toISOString(),
    total_score: totalScore,
    section_scores: sectionScores,
    projected_tss: projectedTss,
  }).eq('id', sessionId)

  if (updateError) {
    console.error('[test/complete] session update failed:', updateError.message)
    return NextResponse.json({ error: 'Failed to complete session' }, { status: 500 })
  }

  return NextResponse.json({ sectionScores, totalScore, projectedTss })
}
