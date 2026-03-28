import { createClient } from '@/lib/supabase/server'
import { getTSSBand } from '@/lib/test/scoring'
import { TEST_CONFIG } from '@/lib/test/constants'
import Link from 'next/link'

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('test_sessions').select('*').eq('id', id).single()

  const { data: wrongAnswers } = await supabase
    .from('test_answers')
    .select('id, question_bank!inner(topic, section)')
    .eq('session_id', id)
    .eq('is_correct', false)

  if (!session) return <div className="p-8">Session not found.</div>

  const scores = session.section_scores as Record<string, number> | null
  const tss = session.projected_tss
  const testType = session.test_type as keyof typeof TEST_CONFIG
  const sectionMaxMap = Object.fromEntries(
    (TEST_CONFIG[testType] ?? []).map(s => [s.key, s.questionCount])
  )
  const band = tss ? getTSSBand(tss) : null

  const bandColor = band === 'Selective Entry' || band === 'High Merit'
    ? 'text-success' : band === 'Merit' ? 'text-primary' : 'text-muted'

  const totalQ = scores ? Object.values(scores).reduce((a, b) => a + b, 0) : 0
  const wrongCount = (wrongAnswers ?? []).length

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-8">

        {/* Hero score card */}
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
            <span><span className="font-semibold text-text-primary">{totalQ - wrongCount}</span> correct</span>
            <span><span className="font-semibold text-danger">{wrongCount}</span> to review</span>
          </div>
        </div>

        {/* Section scores */}
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
                      <span className="font-bold text-text-primary">{score}</span>
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

        {/* Questions to review */}
        {wrongAnswers && wrongAnswers.length > 0 && (
          <div className="bg-surface rounded-2xl shadow-sm border border-border p-6">
            <h2 className="font-bold text-text-primary mb-1">Review with AI Tutor</h2>
            <p className="text-sm text-muted mb-4">{wrongAnswers.length} question{wrongAnswers.length !== 1 ? 's' : ''} to work through</p>
            <div className="flex flex-col gap-2">
              {(wrongAnswers as unknown as { id: string; question_bank: { topic: string; section: string } }[]).map((a, i) => (
                <Link key={a.id} href={`/student/tutor/${a.id}`}
                  className="flex items-center justify-between p-4 bg-accent/10 border border-accent/20 rounded-xl hover:bg-accent/20 transition-colors group">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{a.question_bank.topic}</p>
                      <p className="text-xs text-muted capitalize">{a.question_bank.section.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  <span className="text-accent text-sm font-medium group-hover:translate-x-0.5 transition-transform">Review →</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <Link href="/student/dashboard"
          className="text-center py-3.5 border border-border rounded-xl text-muted hover:bg-surface-raised font-medium transition-colors">
          Back to Dashboard
        </Link>
      </div>
    </main>
  )
}
