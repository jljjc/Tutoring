'use client'
import { useEffect, useState } from 'react'
import { McqExplanation } from '@/components/tutor/McqExplanation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface TutorData {
  answer: {
    question_id: string
    selected_answer: string
    question_bank: { section: string; question_text: string }
    test_sessions: { id: string }
  }
  explanation: string
  followupQuestion: {
    question_text: string
    options: { A: string; B: string; C: string; D: string }
    correct_answer: string
    topic: string
    section: string
    test_type: string
    difficulty: number
    explanation: string
  }
  tutoringSessionId: string
  attempts: number
}

export default function TutorPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<TutorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [mastered, setMastered] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: answer } = await supabase
        .from('test_answers')
        .select('*, question_bank!inner(*), test_sessions!inner(id)')
        .eq('id', params.id)
        .single()

      if (!answer) { setLoading(false); return }

      const res = await fetch('/api/tutor/mcq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: (answer as any).test_sessions.id,
          questionId: answer.question_id,
          wrongAnswer: answer.selected_answer,
        }),
      })
      const tutorData = await res.json()
      setData({ answer: answer as any, ...tutorData })
      setLoading(false)
    }
    load()
  }, [params.id])

  if (loading) return <div className="p-8 text-center">Loading tutoring...</div>
  if (!data) return <div className="p-8">Not found.</div>

  return (
    <main className="max-w-2xl mx-auto p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Let&apos;s review this question</h1>
        <Link href="/student/dashboard" className="text-sm text-gray-500">Skip</Link>
      </div>

      <div className="p-4 bg-gray-50 rounded-xl">
        <p className="text-sm text-gray-500 mb-1">{data.answer.question_bank.section.replace(/_/g, ' ')}</p>
        <p>{data.answer.question_bank.question_text}</p>
      </div>

      {mastered
        ? <div className="p-6 bg-green-50 border border-green-300 rounded-xl text-center text-green-800 font-semibold">
            Topic mastered! <Link href="/student/dashboard" className="underline ml-2">Back to dashboard</Link>
          </div>
        : <McqExplanation
            explanation={data.explanation}
            followupQuestion={data.followupQuestion as any}
            tutoringSessionId={data.tutoringSessionId}
            attempts={data.attempts}
            onMastered={() => setMastered(true)}
            onGap={() => {}}
          />
      }
    </main>
  )
}
