'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { McqQuestion } from '@/components/test/McqQuestion'
import { SectionTimer } from '@/components/test/SectionTimer'
import { WritingPrompt } from '@/components/test/WritingPrompt'
import type { Question } from '@/lib/types'

interface SessionData {
  session: { id: string; test_type: string }
  sections: Array<{ key: string; label: string; type: string; questionCount: number; timeLimitSecs: number }>
  questions: Question[]
  writingPrompts: Record<string, string>
}

export default function LiveTestPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0)
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [scoredWriting, setScoredWriting] = useState<{
    prompt: string; responseText: string; scores: Record<string, number>;
    aiFeedback: string; followUpPrompt: string
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem(`test-session-${id}`)
    if (stored) setSessionData(JSON.parse(stored))
  }, [id])

  const saveAnswer = useCallback(async (questionId: string, answer: string, isCorrect: boolean) => {
    await fetch('/api/test/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id, questionId, selectedAnswer: answer, isCorrect }),
    })
  }, [id])

  const handleMcqSelect = async (questionId: string, correctAnswer: string, selected: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: selected }))
    await saveAnswer(questionId, selected, selected === correctAnswer)
  }

  const completeTest = useCallback(async () => {
    if (!sessionData || submitting) return
    setSubmitting(true)
    await fetch('/api/test/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id, writingResponse: scoredWriting ?? undefined }),
    })
    router.push(`/student/test/${id}/result`)
  }, [sessionData, submitting, id, scoredWriting, router])

  const advanceSection = useCallback(() => {
    if (!sessionData) return
    if (currentSectionIdx < sessionData.sections.length - 1) {
      setCurrentSectionIdx(i => i + 1)
      setCurrentQuestionIdx(0)
    } else {
      completeTest()
    }
  }, [sessionData, currentSectionIdx, completeTest])

  if (!sessionData) return <div className="p-8 text-center">Loading test...</div>

  const currentSection = sessionData.sections[currentSectionIdx]
  const sectionQuestions = sessionData.questions.filter(q => q.section === currentSection.key)
  const currentQuestion = sectionQuestions[currentQuestionIdx]

  return (
    <main className="max-w-2xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-bold text-lg">{currentSection.label}</h2>
          <p className="text-sm text-gray-500">Section {currentSectionIdx + 1} of {sessionData.sections.length}</p>
        </div>
        <SectionTimer timeLimitSecs={currentSection.timeLimitSecs} onExpire={advanceSection} />
      </div>

      {currentSection.type === 'mcq' && currentQuestion && (
        <div className="flex flex-col gap-6">
          <McqQuestion
            question={currentQuestion}
            selectedAnswer={answers[currentQuestion.id] ?? null}
            onSelect={sel => handleMcqSelect(currentQuestion.id, currentQuestion.correct_answer, sel)}
            questionNumber={currentQuestionIdx + 1}
            total={sectionQuestions.length}
          />
          <div className="flex justify-between">
            <button onClick={() => setCurrentQuestionIdx(i => Math.max(0, i - 1))} disabled={currentQuestionIdx === 0}
              className="px-4 py-2 border rounded-lg disabled:opacity-40">Back</button>
            {currentQuestionIdx < sectionQuestions.length - 1
              ? <button onClick={() => setCurrentQuestionIdx(i => i + 1)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Next</button>
              : <button onClick={advanceSection} className="px-4 py-2 bg-green-600 text-white rounded-lg">
                  {currentSectionIdx < sessionData.sections.length - 1 ? 'Next Section →' : 'Finish Test'}
                </button>
            }
          </div>
        </div>
      )}

      {currentSection.type === 'writing' && (
        <WritingPrompt
          prompt={sessionData.writingPrompts[currentSection.key] ?? ''}
          onSubmit={async (text) => {
            const scoreRes = await fetch('/api/writing/score', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: sessionData.writingPrompts[currentSection.key],
                responseText: text,
                testType: sessionData.session.test_type,
              }),
            })
            const scored = await scoreRes.json()
            setScoredWriting({
              prompt: sessionData.writingPrompts[currentSection.key],
              responseText: text,
              scores: scored.scores,
              aiFeedback: scored.feedback,
              followUpPrompt: scored.followUpPrompt,
            })
            advanceSection()
          }}
          timeLimitSecs={currentSection.timeLimitSecs}
        />
      )}
    </main>
  )
}
