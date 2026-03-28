import { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

type ReportSessionRow = {
  id: string
  started_at: string
  section_scores: Record<string, number> | null
  projected_tss: number | null
  total_score: number | null
  test_type: string
  mode: string
}

type WrongAnswerQueryRow = {
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
}

function getJoinedQuestionBank(
  questionBank: WrongAnswerQueryRow['question_bank']
): {
  question_text: string
  options: Record<string, string>
  correct_answer: string
  explanation: string
  topic: string
  section: string
} {
  return Array.isArray(questionBank) ? questionBank[0] : questionBank
}

export interface ReportSessionSummary {
  id: string
  startedAt: string
  sectionScores: Record<string, number> | null
  projectedTss: number | null
  totalScore: number | null
  testType: string
  mode: string
}

export interface ReportWrongAnswer {
  id: string
  sessionId: string
  sessionStartedAt: string
  selectedAnswer: string | null
  questionText: string
  options: Record<string, string>
  correctAnswer: string
  explanation: string
  topic: string
  section: string
}

export interface TopicGapSummary {
  topic: string
  section: string
  occurrenceCount: number
}

export interface SectionGapSummary {
  section: string
  wrongCount: number
}

export interface StudentReportAnalysis {
  recentTests: ReportSessionSummary[]
  wrongAnswers: ReportWrongAnswer[]
  totalWrongAnswers: number
  sectionCounts: SectionGapSummary[]
  topicCounts: TopicGapSummary[]
  recurringTopicCounts: TopicGapSummary[]
}

export function formatSectionLabel(section: string): string {
  return section.replace(/_/g, ' ')
}

export function buildStudentReportAnalysis(
  recentTests: ReportSessionSummary[],
  wrongAnswers: ReportWrongAnswer[]
): StudentReportAnalysis {
  const sectionMap = new Map<string, number>()
  const topicMap = new Map<string, TopicGapSummary>()

  for (const answer of wrongAnswers) {
    sectionMap.set(answer.section, (sectionMap.get(answer.section) ?? 0) + 1)

    const topicKey = `${answer.section}::${answer.topic}`
    const currentTopic = topicMap.get(topicKey)
    if (currentTopic) {
      currentTopic.occurrenceCount += 1
    } else {
      topicMap.set(topicKey, {
        section: answer.section,
        topic: answer.topic,
        occurrenceCount: 1,
      })
    }
  }

  const sortTopics = (entries: TopicGapSummary[]) =>
    entries.sort((a, b) => {
      if (b.occurrenceCount !== a.occurrenceCount) return b.occurrenceCount - a.occurrenceCount
      return a.topic.localeCompare(b.topic)
    })

  const sectionCounts = Array.from(sectionMap.entries())
    .map(([section, wrongCount]) => ({ section, wrongCount }))
    .sort((a, b) => {
      if (b.wrongCount !== a.wrongCount) return b.wrongCount - a.wrongCount
      return a.section.localeCompare(b.section)
    })

  const topicCounts = sortTopics(Array.from(topicMap.values()))
  const recurringTopicCounts = topicCounts.filter(item => item.occurrenceCount >= 2)

  return {
    recentTests,
    wrongAnswers,
    totalWrongAnswers: wrongAnswers.length,
    sectionCounts,
    topicCounts,
    recurringTopicCounts,
  }
}

export async function getRecentStudentReportAnalysis(
  supabase: SupabaseServerClient,
  studentId: string,
  limit = 10
): Promise<StudentReportAnalysis> {
  const { data: sessionRows, error: sessionsError } = await supabase
    .from('test_sessions')
    .select('id, started_at, section_scores, projected_tss, total_score, test_type, mode')
    .eq('student_id', studentId)
    .not('completed_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (sessionsError) {
    console.error('[report-analysis] recent session query failed:', sessionsError.message)
  }

  const recentTests: ReportSessionSummary[] = ((sessionRows ?? []) as ReportSessionRow[]).map(session => ({
    id: session.id,
    startedAt: session.started_at,
    sectionScores: session.section_scores,
    projectedTss: session.projected_tss,
    totalScore: session.total_score,
    testType: session.test_type,
    mode: session.mode,
  }))

  const sessionStartedAtById = new Map(recentTests.map(session => [session.id, session.startedAt]))
  const sessionIds = recentTests.map(session => session.id)

  let wrongAnswers: ReportWrongAnswer[] = []
  if (sessionIds.length > 0) {
    const { data: wrongAnswerRows, error: wrongAnswersError } = await supabase
      .from('test_answers')
      .select('id, session_id, selected_answer, question_bank!inner(question_text, options, correct_answer, explanation, topic, section)')
      .in('session_id', sessionIds)
      .eq('is_correct', false)

    if (wrongAnswersError) {
      console.error('[report-analysis] wrong answer query failed:', wrongAnswersError.message)
    } else {
      wrongAnswers = ((wrongAnswerRows ?? []) as unknown as WrongAnswerQueryRow[]).map(answer => {
        const questionBank = getJoinedQuestionBank(answer.question_bank)
        return {
          id: answer.id,
          sessionId: answer.session_id,
          sessionStartedAt: sessionStartedAtById.get(answer.session_id) ?? '',
          selectedAnswer: answer.selected_answer,
          questionText: questionBank.question_text,
          options: questionBank.options,
          correctAnswer: questionBank.correct_answer,
          explanation: questionBank.explanation,
          topic: questionBank.topic,
          section: questionBank.section,
        }
      })
    }
  }

  return buildStudentReportAnalysis(recentTests, wrongAnswers)
}
