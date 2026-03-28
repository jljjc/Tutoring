import { createClient } from '@/lib/supabase/server'
import { KnowledgeGapMap } from '@/components/reports/KnowledgeGapMap'
import { ImprovementSuggestions } from '@/components/reports/ImprovementSuggestions'
import { redirect } from 'next/navigation'
import {
  formatSectionLabel,
  getRecentStudentReportAnalysis,
  type ReportSessionSummary,
} from '@/lib/report-analysis'

type ChildRow = {
  id: string
  full_name: string
}

function formatSectionScore(session: ReportSessionSummary, key: string, fallbackKey?: string): string {
  const scores = session.sectionScores
  if (!scores) return '—'

  const value = scores[key] ?? (fallbackKey ? scores[fallbackKey] : undefined)
  if (value == null) return '—'
  return key === 'writing_total' ? `${value}/25` : String(value)
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>
}) {
  const { child: childParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: childProfiles, error: childProfilesError } = await supabase
    .from('student_profiles')
    .select('id')
    .eq('parent_id', user.id)

  if (childProfilesError) {
    console.error('[parent/reports] child profile query failed:', childProfilesError.message)
  }

  const childIds = (childProfiles ?? []).map(child => child.id)
  const { data: childUsers, error: childUsersError } = childIds.length > 0
    ? await supabase
        .from('users')
        .select('id, full_name')
        .in('id', childIds)
    : { data: [], error: null }

  if (childUsersError) {
    console.error('[parent/reports] child user query failed:', childUsersError.message)
  }

  const nameById = new Map((childUsers ?? []).map(userRow => [userRow.id, userRow.full_name]))
  const childList: ChildRow[] = childIds.map(id => ({
    id,
    full_name: nameById.get(id) ?? 'Student',
  }))

  if (childList.length === 0) {
    return <div className="p-8">No student linked.</div>
  }

  const selectedChild = childList.find(child => child.id === childParam) ?? childList[0]
  const analysis = await getRecentStudentReportAnalysis(supabase, selectedChild.id, 10)

  const topSections = analysis.sectionCounts.slice(0, 3)
  const topTopics = analysis.topicCounts.slice(0, 6)
  const summary = analysis.totalWrongAnswers === 0
    ? `No incorrect answers were recorded across the last ${analysis.recentTests.length} completed test${analysis.recentTests.length === 1 ? '' : 's'}.`
    : `Across the last ${analysis.recentTests.length} completed test${analysis.recentTests.length === 1 ? '' : 's'}, ${selectedChild.full_name} missed ${analysis.totalWrongAnswers} question${analysis.totalWrongAnswers === 1 ? '' : 's'}. The heaviest sections were ${topSections.slice(0, 2).map(section => formatSectionLabel(section.section)).join(' and ') || 'mixed review areas'}.`

  return (
    <main className="max-w-2xl mx-auto p-8 flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Detailed Report for {selectedChild.full_name}</h1>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-semibold mb-3">Recent Test Pattern</h2>
        <p className="text-sm text-text-primary leading-relaxed">{summary}</p>
      </section>

      <section>
        <h2 className="font-semibold mb-3">Knowledge Gap Map</h2>
        {topTopics.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
            No recurring weak topics yet from recent completed tests.
          </div>
        ) : (
          <KnowledgeGapMap gaps={topTopics} />
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-semibold mb-3">Most Missed Areas</h2>
        {topSections.length === 0 ? (
          <p className="text-sm text-muted">No missed questions recorded in the recent test window.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {topSections.map(section => (
              <div key={section.section} className="flex items-center justify-between rounded-xl bg-surface-raised border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-text-primary capitalize">{formatSectionLabel(section.section)}</p>
                  <p className="text-xs text-muted">{section.wrongCount} incorrect question{section.wrongCount === 1 ? '' : 's'}</p>
                </div>
                <span className="px-2 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold">
                  Focus Area
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-3">Improvement Suggestions</h2>
        <ImprovementSuggestions studentId={selectedChild.id} />
      </section>

      <section>
        <h2 className="font-semibold mb-3">Section Progress (last 10 tests)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">Date</th>
                <th className="pb-2">Reading</th>
                <th className="pb-2">Writing</th>
                <th className="pb-2">Quantitative</th>
                <th className="pb-2">Abstract</th>
              </tr>
            </thead>
            <tbody>
              {analysis.recentTests.map(session => (
                <tr key={session.id} className="border-b">
                  <td className="py-2">{new Date(session.startedAt).toLocaleDateString()}</td>
                  <td>{formatSectionScore(session, 'reading_comprehension', 'english')}</td>
                  <td>{formatSectionScore(session, 'writing_total')}</td>
                  <td>{formatSectionScore(session, 'quantitative_reasoning', 'mathematics')}</td>
                  <td>{formatSectionScore(session, 'abstract_reasoning', 'general_ability')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
