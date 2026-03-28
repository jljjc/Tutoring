'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { McqQuestion } from '@/components/test/McqQuestion'
import { WritingPrompt } from '@/components/test/WritingPrompt'
import type { Question } from '@/lib/types'

interface SessionData {
  session: { id: string; test_type: string }
  sections: Array<{ key: string; label: string; type: string; questionCount: number; timeLimitSecs: number }>
  questions: Question[]
  writingPrompts: Record<string, string>
}

function CircularTimer({ timeLimitSecs, onExpire }: { timeLimitSecs: number; onExpire: () => void }) {
  const [secs, setSecs] = useState(timeLimitSecs)
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const progress = secs / timeLimitSecs
  const dashOffset = circumference * (1 - progress)
  const urgent = secs < 120
  const warning = secs < 300

  useEffect(() => {
    setSecs(timeLimitSecs)
  }, [timeLimitSecs])

  useEffect(() => {
    const t = setInterval(() => setSecs(s => {
      if (s <= 1) { clearInterval(t); onExpire(); return 0 }
      return s - 1
    }), 1000)
    return () => clearInterval(t)
  }, [timeLimitSecs, onExpire])

  const m = Math.floor(secs / 60)
  const s = secs % 60
  const color = urgent ? '#f59e0b' : warning ? '#f59e0b' : '#6366f1'

  return (
    <div className="flex flex-col items-center">
      <svg width="72" height="72" className="rotate-[-90deg]">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx="36" cy="36" r={radius} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
        />
      </svg>
      <span className={`text-sm font-mono font-bold tabular-nums -mt-[52px] mb-[20px] ${urgent ? 'text-accent' : warning ? 'text-accent' : 'text-muted'}`}>
        {m}:{String(s).padStart(2, '0')}
      </span>
    </div>
  )
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
  const submittingRef = useRef(false)

  useEffect(() => {
    const stored = sessionStorage.getItem(`test-session-${id}`)
    if (stored) setSessionData(JSON.parse(stored))
  }, [id])

  const saveAnswer = useCallback(async (questionId: string, answer: string, isCorrect: boolean) => {
    try {
      await fetch('/api/test/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id, questionId, selectedAnswer: answer, isCorrect }),
      })
    } catch { /* non-blocking */ }
  }, [id])

  const completeTest = useCallback(async () => {
    if (!sessionData || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    await fetch('/api/test/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id, writingResponse: scoredWriting ?? undefined }),
    })
    router.push(`/student/test/${id}/result`)
  }, [sessionData, id, scoredWriting, router])

  const advanceSection = useCallback(() => {
    if (!sessionData) return
    if (currentSectionIdx < sessionData.sections.length - 1) {
      setCurrentSectionIdx(i => i + 1)
      setCurrentQuestionIdx(0)
    } else {
      completeTest()
    }
  }, [sessionData, currentSectionIdx, completeTest])

  if (!sessionData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted font-medium">Loading test...</p>
        </div>
      </div>
    )
  }

  const currentSection = sessionData.sections[currentSectionIdx]
  const sectionQuestions = sessionData.questions.filter(q => q.section === currentSection.key)
  const currentQuestion = sectionQuestions[currentQuestionIdx]
  const answeredCount = sectionQuestions.filter(q => answers[q.id]).length
  const progress = sectionQuestions.length > 0 ? (answeredCount / sectionQuestions.length) * 100 : 0
  const isLastQuestion = currentQuestionIdx === sectionQuestions.length - 1
  const isLastSection = currentSectionIdx === sessionData.sections.length - 1

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-border sticky top-0 z-20 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* Section info */}
          <div>
            <h1 className="font-bold text-text-primary text-lg leading-tight">{currentSection.label}</h1>
            <p className="text-xs text-muted mt-0.5">
              Section {currentSectionIdx + 1} of {sessionData.sections.length}
              {currentSection.type === 'mcq' && (
                <span className="ml-2 text-primary font-medium">{answeredCount}/{sectionQuestions.length} answered</span>
              )}
            </p>
          </div>

          {/* Timer */}
          <div className="flex items-center gap-3">
            {submitting && (
              <span className="text-xs text-muted animate-pulse">Saving...</span>
            )}
            <CircularTimer
              key={currentSection.key}
              timeLimitSecs={currentSection.timeLimitSecs}
              onExpire={advanceSection}
            />
          </div>
        </div>

        {/* Progress bar */}
        {currentSection.type === 'mcq' && (
          <div className="h-1 bg-surface-raised">
            <div
              className="h-1 bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {currentSection.type === 'mcq' && currentQuestion && (
          <div className="flex flex-col gap-6">
            {/* Question card */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <McqQuestion
                question={currentQuestion}
                selectedAnswer={answers[currentQuestion.id] ?? null}
                onSelect={sel => {
                  setAnswers(prev => ({ ...prev, [currentQuestion.id]: sel }))
                  saveAnswer(currentQuestion.id, sel, sel === currentQuestion.correct_answer)
                }}
                questionNumber={currentQuestionIdx + 1}
                total={sectionQuestions.length}
              />
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentQuestionIdx(i => Math.max(0, i - 1))}
                disabled={currentQuestionIdx === 0}
                className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-muted hover:bg-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                ← Back
              </button>

              {/* Dot navigator */}
              <div className="flex gap-1.5 items-center">
                {sectionQuestions.slice(0, 12).map((q, i) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIdx(i)}
                    title={`Question ${i + 1}`}
                    className={`rounded-full transition-all duration-200 ${
                      i === currentQuestionIdx
                        ? 'w-3 h-3 bg-primary shadow-md shadow-primary/20'
                        : answers[q.id]
                        ? 'w-2.5 h-2.5 bg-primary/40'
                        : 'w-2.5 h-2.5 bg-border hover:bg-surface-raised'
                    }`}
                  />
                ))}
                {sectionQuestions.length > 12 && (
                  <span className="text-xs text-muted ml-1">+{sectionQuestions.length - 12}</span>
                )}
              </div>

              {!isLastQuestion ? (
                <button
                  onClick={() => setCurrentQuestionIdx(i => i + 1)}
                  className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover shadow-sm shadow-primary/20 transition-all"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={advanceSection}
                  disabled={submitting}
                  className="px-5 py-2.5 bg-success text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 shadow-sm shadow-success/20 transition-all disabled:opacity-50"
                >
                  {isLastSection ? 'Finish Test ✓' : 'Next Section →'}
                </button>
              )}
            </div>

            {/* Answered count reminder */}
            {answeredCount < sectionQuestions.length && isLastQuestion && (
              <p className="text-center text-xs text-accent bg-accent/10 rounded-lg py-2 px-4">
                {sectionQuestions.length - answeredCount} question{sectionQuestions.length - answeredCount !== 1 ? 's' : ''} still unanswered — you can go back to change your answers.
              </p>
            )}
          </div>
        )}

        {currentSection.type === 'mcq' && !currentQuestion && (
          <div className="text-center py-20">
            <p className="text-muted text-lg mb-4">No questions available for this section.</p>
            <button onClick={advanceSection} className="px-6 py-3 bg-primary text-white rounded-xl font-medium shadow-sm">
              {isLastSection ? 'Finish Test' : 'Next Section'}
            </button>
          </div>
        )}

        {currentSection.type === 'writing' && (
          <WritingPrompt
            prompt={sessionData.writingPrompts[currentSection.key] ?? ''}
            onSubmit={async (text) => {
              try {
                const scoreRes = await fetch('/api/writing/score', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    prompt: sessionData.writingPrompts[currentSection.key],
                    responseText: text,
                    testType: sessionData.session.test_type,
                  }),
                })
                if (scoreRes.ok) {
                  const scored = await scoreRes.json()
                  setScoredWriting({
                    prompt: sessionData.writingPrompts[currentSection.key],
                    responseText: text,
                    scores: scored.scores,
                    aiFeedback: scored.feedback,
                    followUpPrompt: scored.followUpPrompt,
                  })
                }
              } catch { /* non-blocking */ }
              advanceSection()
            }}
            timeLimitSecs={currentSection.timeLimitSecs}
          />
        )}
      </main>
    </div>
  )
}
