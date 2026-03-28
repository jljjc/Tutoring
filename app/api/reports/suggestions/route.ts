import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSuggestions } from '@/lib/claude/suggestions'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('studentId')

  let childQuery = supabase
    .from('student_profiles')
    .select('id')
    .eq('parent_id', user.id)

  if (studentId) {
    childQuery = childQuery.eq('id', studentId)
  }

  const { data: child } = await childQuery.limit(1).maybeSingle()
  if (!child) return NextResponse.json({ suggestions: [] })

  // Get priority gaps: unmastered after 3+ attempts
  const { data: gaps } = await supabase
    .from('tutoring_sessions')
    .select('attempts, question_bank!inner(topic, section)')
    .eq('student_id', child.id)
    .eq('mastered', false)
    .gte('attempts', 3)

  type GapRow = { attempts: number; question_bank: { topic: string; section: string } }
  const gapSummary = (gaps as unknown as GapRow[]).map(g => ({
    topic: g.question_bank.topic,
    section: g.question_bank.section,
    attempts: g.attempts,
  }))

  try {
    const suggestions = await generateSuggestions(gapSummary)
    return NextResponse.json({ suggestions })
  } catch (err: unknown) {
    console.error('[reports/suggestions] error:', err)
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
  }
}
