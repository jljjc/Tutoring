import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSuggestions } from '@/lib/claude/suggestions'
import { getRecentStudentReportAnalysis } from '@/lib/report-analysis'

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

  const analysis = await getRecentStudentReportAnalysis(supabase, child.id, 10)

  try {
    const suggestions = await generateSuggestions({
      recentTestsAnalyzed: analysis.recentTests.length,
      totalWrongAnswers: analysis.totalWrongAnswers,
      sectionCounts: analysis.sectionCounts,
      topicCounts: analysis.topicCounts,
    })
    return NextResponse.json({ suggestions })
  } catch (err: unknown) {
    console.error('[reports/suggestions] error:', err)
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
  }
}
