'use client'
import { useState } from 'react'
import { McqQuestion } from '@/components/test/McqQuestion'
import type { Question } from '@/lib/types'

interface Props {
  explanation: string
  followupQuestion: Omit<Question, 'id' | 'generated_at'>
  tutoringSessionId: string
  attempts: number
  onMastered: () => void
  onGap: () => void
}

export function McqExplanation({ explanation, followupQuestion, tutoringSessionId, attempts, onMastered, onGap }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [result, setResult] = useState<{ mastered: boolean; priorityGap: boolean } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function checkAnswer() {
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/tutor/mcq-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutoringSessionId,
          selectedAnswer: selected,
          correctAnswer: followupQuestion.correct_answer,
        }),
      })
      if (!res.ok) throw new Error('Failed to check answer')
      const data = await res.json()
      setResult(data)
      if (data.mastered) onMastered()
      else if (data.priorityGap) onGap()
    } catch (err) {
      console.error('[McqExplanation] checkAnswer failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <h3 className="font-semibold mb-2">Understanding the mistake</h3>
        <p className="text-gray-700 leading-relaxed">{explanation}</p>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Try a similar question</h3>
        <McqQuestion
          question={{ ...followupQuestion, id: 'followup', generated_at: '' } as Question}
          selectedAnswer={selected}
          onSelect={setSelected}
          questionNumber={1}
          total={1}
        />
      </div>

      {!result && (
        <button onClick={checkAnswer} disabled={!selected || submitting}
          className="py-3 bg-blue-600 text-white rounded-lg disabled:opacity-40">
          Check Answer
        </button>
      )}

      {result?.mastered && (
        <div className="p-4 bg-green-50 border border-green-300 rounded-xl text-green-800 font-medium text-center">
          Correct! You have got it.
        </div>
      )}

      {result && !result.mastered && !result.priorityGap && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-center">
          Not quite — keep trying. Attempt {attempts} of 3.
        </div>
      )}

      {result?.priorityGap && (
        <div className="p-4 bg-red-50 border border-red-300 rounded-xl text-red-800 text-center">
          This topic has been flagged as a priority gap for your parent report.
        </div>
      )}
    </div>
  )
}
