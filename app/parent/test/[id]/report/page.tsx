import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TEST_CONFIG } from '@/lib/test/constants'
import { getTSSBand } from '@/lib/test/scoring'

type WrongAnswerRow = {
  question_bank: {
    topic: string
    section: string
  }
}

type ChildDetail = {
  id: string
  parent_id: string
  users: { full_name: string } | Array<{ full_name: string }>
}

function getChildName(child: ChildDetail): string {
  return Array.isArray(child.users) ? (child.users[0]?.full_name ?? 'Student') : child.users.full_name
}

export default async function ParentTestReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: session } = await supabase
    .from('test_sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (!session) {
    return <div className="p-8">Session not found.</div>
  }

  const { data: child } = await supabase
    .from('student_profiles')
    .select('id, parent_id, users!inner(full_name)')
    .eq('id', session.student_id)
    .eq('parent_id', user.id)
    .maybeSingle()

  if (!child) redirect('/parent/history')

  const { data: wrongAnswers } = await supabase
    .from('test_answers')
    .select('question_bank!inner(topic, section)')
    .eq('session_id', id)
    .eq('is_correct', false)

  const scores = session.section_scores as Record<string, number> | null
  const tss = session.projected_tss
  const testType = session.test_type as keyof typeof TEST_CONFIG
  const sectionMaxMap = Object.fromEntries(
    (TEST_CONFIG[testType] ?? []).map(section => [
      section.key,
      section.type === 'writing' ? 25 : section.questionCount,
    ])
  )
  const band = tss ? getTSSBand(tss) : null
  const bandColor = band && band !== 'Below Top 35%' ? 'text-primary' : 'text-muted'

  const wrongCount = (wrongAnswers ?? []).length
  const totalQ = scores ? Object.values(scores).reduce((sum, score) => sum + score, 0) : 0
  const correctCount = session.total_score ?? Math.max(totalQ - wrongCount, 0)

  const topicsBySection = new Map<string, string[]>()
  for (const answer of (wrongAnswers ?? []) as unknown as WrongAnswerRow[]) {
    const section = answer.question_bank.section
    const topic = answer.question_bank.topic
    const topics = topicsBySection.get(section) ?? []
    if (!topics.includes(topic)) topics.push(topic)
    topicsBySection.set(section, topics)
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted uppercase tracking-widest mb-2">Parent Report</p>
            <h1 className="text-2xl font-bold text-text-primary">
              {getChildName(child as unknown as ChildDetail)}
            </h1>
          </div>
          <Link href="/parent/history" className="text-primary text-sm font-medium hover:underline">
            Back to History
          </Link>
        </div>

        <div className="bg-surface rounded-3xl shadow-sm border border-border p-8 text-center">
          <p className="text-sm font-medium text-muted uppercase tracking-widest mb-2">Test Complete</p>
          {tss ? (
            <>
              <div className="text-7xl font-black text-accent tabular-nums">{Math.round(tss)}</div>
              <div className="text-muted text-sm mt-1">Projected TSS / 400</div>
              <div className={`text-xl font-bold mt-3 ${bandColor}`}>{band}</div>
            </>
          ) : (
            <div className="text-2xl font-bold text-text-primary">Results ready</div>
          )}
          <div className="mt-4 flex justify-center gap-6 text-sm text-muted">
            <span><span className="font-semibold text-text-primary">{correctCount}</span> correct</span>
            <span><span className="font-semibold text-danger">{wrongCount}</span> to review</span>
          </div>
        </div>

        {scores && (
          <div className="bg-surface rounded-2xl shadow-sm border border-border p-6">
            <h2 className="font-bold text-text-primary mb-4">Section Breakdown</h2>
            <div className="flex flex-col gap-3">
              {Object.entries(scores).map(([section, score]) => {
                const maxScore = sectionMaxMap[section] ?? 35
                const pct = Math.min((score / maxScore) * 100, 100)

                return (
                  <div key={section}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted capitalize">{section.replace(/_/g, ' ')}</span>
                      <span className="font-bold text-text-primary">
                        {score} / {maxScore}
                      </span>
                    </div>
                    <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-primary rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="bg-surface rounded-2xl shadow-sm border border-border p-6">
          <h2 className="font-bold text-text-primary mb-4">Topics to Practice</h2>
          {topicsBySection.size === 0 ? (
            <p className="text-sm text-muted">No missed MCQ topics from this test.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {Array.from(topicsBySection.entries()).map(([section, topics]) => (
                <div key={section}>
                  <div className="mb-2">
                    <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-semibold rounded-full capitalize">
                      {section.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {topics.map(topic => (
                      <li key={topic} className="text-sm text-text-primary">
                        {topic}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
