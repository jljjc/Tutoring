'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { McqExplanation } from '@/components/tutor/McqExplanation'
import { createClient } from '@/lib/supabase/client'
import type { ConceptCheck, GapQuestion } from '@/lib/claude/tutor-mcq'
import Link from 'next/link'

interface AnswerRow {
  question_id: string
  selected_answer: string
  question_bank: { section: string; question_text: string }
  test_sessions: { id: string }
}

interface TutorData {
  answer: AnswerRow
  explanation: string
  conceptChecks: ConceptCheck[]
  gapQuestion: GapQuestion
  tutoringSessionId: string
  attempts: number
}

export default function TutorPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<TutorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [mastered, setMastered] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: answer } = await supabase
        .from('test_answers')
        .select('*, question_bank!inner(*), test_sessions!inner(id)')
        .eq('id', id)
        .single()

      if (!answer) { setLoading(false); return }

      const res = await fetch('/api/tutor/mcq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: (answer as unknown as AnswerRow).test_sessions.id,
          questionId: answer.question_id,
          wrongAnswer: answer.selected_answer,
        }),
      })
      const tutorData = await res.json()
      setData({ answer: answer as unknown as AnswerRow, ...tutorData })
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-muted text-sm">Generating tutoring session...</p>
      </div>
    </div>
  )

  if (!data) return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <p className="text-muted">Session not found.</p>
    </div>
  )

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">Review this question</h1>
        <Link href="/student/dashboard" className="text-sm text-muted hover:text-text-primary">Skip</Link>
      </div>

      <div className="p-4 bg-surface border border-border rounded-2xl">
        <p className="text-xs text-muted mb-1 capitalize">{data.answer.question_bank.section.replace(/_/g, ' ')}</p>
        <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap font-mono">{data.answer.question_bank.question_text}</p>
      </div>

      {mastered
        ? <div className="p-6 bg-success/10 border border-success/30 rounded-2xl text-center text-success font-semibold">
            Topic mastered! <Link href="/student/dashboard" className="underline ml-2">Back to dashboard</Link>
          </div>
        : <McqExplanation
            explanation={data.explanation}
            conceptChecks={data.conceptChecks ?? []}
            gapQuestion={data.gapQuestion}
            tutoringSessionId={data.tutoringSessionId}
            attempts={data.attempts}
            onMastered={() => setMastered(true)}
            onGap={() => {}}
          />
      }
    </main>
  )
}
