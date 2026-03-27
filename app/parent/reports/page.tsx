import { createClient } from '@/lib/supabase/server'
import { KnowledgeGapMap } from '@/components/reports/KnowledgeGapMap'
import { ImprovementSuggestions } from '@/components/reports/ImprovementSuggestions'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: child } = await supabase
    .from('student_profiles').select('id').eq('parent_id', user!.id).single()

  if (!child) return <div className="p-8">No student linked.</div>

  const { data: tutoringSessions } = await supabase
    .from('tutoring_sessions')
    .select('mastered, attempts, question_bank!inner(topic, section)')
    .eq('student_id', child.id)

  const gaps = (tutoringSessions ?? []).map((ts: any) => ({
    topic: ts.question_bank.topic,
    section: ts.question_bank.section,
    mastered: ts.mastered,
    attempts: ts.attempts,
  }))

  const { data: sessions } = await supabase
    .from('test_sessions')
    .select('section_scores, started_at')
    .eq('student_id', child.id)
    .eq('mode', 'full')
    .not('section_scores', 'is', null)
    .order('started_at', { ascending: false })
    .limit(10)

  return (
    <main className="max-w-2xl mx-auto p-8 flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Detailed Report</h1>

      <section>
        <h2 className="font-semibold mb-3">Knowledge Gap Map</h2>
        <KnowledgeGapMap gaps={gaps} />
      </section>

      <section>
        <h2 className="font-semibold mb-3">Improvement Suggestions</h2>
        <ImprovementSuggestions studentId={child.id} />
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
              {sessions?.map((s, i) => {
                const sc = s.section_scores as Record<string, number>
                return (
                  <tr key={i} className="border-b">
                    <td className="py-2">{new Date(s.started_at).toLocaleDateString()}</td>
                    <td>{sc?.reading_comprehension ?? sc?.english ?? '—'}</td>
                    <td>{sc?.writing_total ?? '—'}/25</td>
                    <td>{sc?.quantitative_reasoning ?? sc?.mathematics ?? '—'}</td>
                    <td>{sc?.abstract_reasoning ?? sc?.general_ability ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
