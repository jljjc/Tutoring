import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TEST_CONFIG } from '@/lib/test/constants'
import { getTSSBand } from '@/lib/test/scoring'
import { generateTestGapAnalysis } from '@/lib/claude/test-gap-analysis'
import { formatSectionLabel, type ReportWrongAnswer } from '@/lib/report-analysis'

type SessionRow = {
  id: string
  student_id: string
  test_type: string
  total_score: number | null
  section_scores: Record<string, number> | null
  projected_tss: number | null
}

function getChildName(fullName: string | null | undefined): string {
  return fullName?.trim() || 'Student'
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

  const { data: session, error: sessionError } = await supabase
    .from('test_sessions')
    .select('id, student_id, test_type, total_score, section_scores, projected_tss')
    .eq('id', id)
    .not('completed_at', 'is', null)
    .maybeSingle()

  if (sessionError) {
    console.error('[parent/test/report] session query failed:', sessionError.message)
  }
  if (!session) notFound()

  const typedSession = session as SessionRow

  const { data: childProfile, error: childProfileError } = await supabase
    .from('student_profiles')
    .select('id')
    .eq('id', typedSession.student_id)
    .eq('parent_id', user.id)
    .maybeSingle()

  if (childProfileError) {
    console.error('[parent/test/report] child profile query failed:', childProfileError.message)
  }
  if (!childProfile) notFound()

  const { data: childUser, error: childUserError } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', typedSession.student_id)
    .maybeSingle()

  if (childUserError) {
    console.error('[parent/test/report] child user query failed:', childUserError.message)
  }

  const { data: wrongAnswersData, error: wrongAnswersError } = await supabase
    .from('test_answers')
    .select('id, session_id, selected_answer, question_bank!inner(question_text, options, correct_answer, explanation, topic, section)')
    .eq('session_id', id)
    .eq('is_correct', false)

  if (wrongAnswersError) {
    console.error('[parent/test/report] wrong answer query failed:', wrongAnswersError.message)
  }

  const wrongAnswerList: ReportWrongAnswer[] = ((wrongAnswersData ?? []) as Array<{
    id: string
    session_id: string
    selected_answer: string | null
    question_bank: {
      question_text: string
      options: Record<string, string>
      correct_answer: string
      explanation: string
      topic: string
      section: string
    } | Array<{
      question_text: string
      options: Record<string, string>
      correct_answer: string
      explanation: string
      topic: string
      section: string
    }>
  }>).map(answer => {
    const questionBank = Array.isArray(answer.question_bank)
      ? answer.question_bank[0]
      : answer.question_bank

    return {
      id: answer.id,
      sessionId: answer.session_id,
      sessionStartedAt: '',
      selectedAnswer: answer.selected_answer,
      questionText: questionBank.question_text,
      options: questionBank.options,
      correctAnswer: questionBank.correct_answer,
      explanation: questionBank.explanation,
      topic: questionBank.topic,
      section: questionBank.section,
    }
  })

  const scores = typedSession.section_scores
  const tss = typedSession.projected_tss
  const testType = typedSession.test_type as keyof typeof TEST_CONFIG
  const sectionMaxMap = Object.fromEntries(
    (TEST_CONFIG[testType] ?? []).map(section => [
      section.key,
      section.type === 'writing' ? 25 : section.questionCount,
    ])
  )
  const band = tss ? getTSSBand(tss) : null
  const bandColor = band && band !== 'Below Top 35%' ? 'text-primary' : 'text-muted'

  const wrongCount = wrongAnswerList.length
  const totalQ = scores ? Object.values(scores).reduce((sum, score) => sum + score, 0) : 0
  const correctCount = typedSession.total_score ?? Math.max(totalQ - wrongCount, 0)

  const topicsBySection = new Map<string, string[]>()
  for (const answer of wrongAnswerList) {
    const topics = topicsBySection.get(answer.section) ?? []
    if (!topics.includes(answer.topic)) topics.push(answer.topic)
    topicsBySection.set(answer.section, topics)
  }

  const gapAnalysis = await generateTestGapAnalysis(
    wrongAnswerList.map(answer => ({
      topic: answer.topic,
      section: answer.section,
      selectedAnswer: answer.selectedAnswer,
      correctAnswer: answer.correctAnswer,
      questionText: answer.questionText,
      explanation: answer.explanation,
    }))
  )

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted uppercase tracking-widest mb-2">Parent Report</p>
            <h1 className="text-2xl font-bold text-text-primary">
              {getChildName(childUser?.full_name)}
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
                      <span className="text-muted capitalize">{formatSectionLabel(section)}</span>
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
                      {formatSectionLabel(section)}
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

        <div className="bg-surface rounded-2xl shadow-sm border border-border p-6">
          <h2 className="font-bold text-text-primary mb-4">AI Knowledge Gap Analysis</h2>
          {!gapAnalysis ? (
            <p className="text-sm text-muted">No incorrect questions were recorded for this test.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-text-primary leading-relaxed">{gapAnalysis.summary}</p>
              <div className="flex flex-col gap-3">
                {gapAnalysis.gaps.map((gap, index) => (
                  <div key={`${gap.section}-${gap.skill}-${index}`} className="rounded-xl border border-border bg-surface-raised p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-semibold rounded-full capitalize">
                        {formatSectionLabel(gap.section)}
                      </span>
                      <p className="text-sm font-semibold text-text-primary">{gap.skill}</p>
                    </div>
                    <p className="text-sm text-muted mb-2">{gap.whyItMatters}</p>
                    <p className="text-sm text-text-primary">
                      <span className="font-medium">Next step:</span> {gap.nextStep}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-surface rounded-2xl shadow-sm border border-border p-6">
          <h2 className="font-bold text-text-primary mb-4">Incorrect Questions Review</h2>
          {wrongAnswerList.length === 0 ? (
            <p className="text-sm text-muted">No incorrect multiple-choice questions in this test.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {wrongAnswerList.map((answer, index) => {
                const selectedKey = answer.selectedAnswer
                const correctKey = answer.correctAnswer
                const selectedText = selectedKey ? answer.options[selectedKey] : null
                const correctText = answer.options[correctKey]

                return (
                  <div key={answer.id} className="rounded-2xl border border-border bg-surface-raised p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-6 h-6 rounded-full bg-danger/15 text-danger text-xs font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-semibold rounded-full capitalize">
                        {formatSectionLabel(answer.section)}
                      </span>
                      <span className="text-xs text-muted">{answer.topic}</span>
                    </div>
                    <p className="text-sm text-text-primary leading-relaxed mb-4 whitespace-pre-wrap">
                      {answer.questionText}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-danger/20 bg-danger/10 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-danger mb-1">Student Answer</p>
                        <p className="text-sm text-text-primary">
                          {selectedKey ? `${selectedKey}. ${selectedText}` : 'No answer selected'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-success/20 bg-success/10 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-success mb-1">Correct Answer</p>
                        <p className="text-sm text-text-primary">{`${correctKey}. ${correctText}`}</p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-xl border border-border p-3 bg-surface">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Explanation</p>
                      <p className="text-sm text-text-primary">{answer.explanation}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
