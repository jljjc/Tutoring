'use client'
import { useState } from 'react'
import { McqQuestion } from '@/components/test/McqQuestion'
import type { Question } from '@/lib/types'
import type { ConceptCheck, GapQuestion } from '@/lib/claude/tutor-mcq'

type Phase =
  | { name: 'explaining' }
  | { name: 'concept_check'; index: number }
  | { name: 'gap_question' }
  | { name: 'done'; mastered: boolean; priorityGap: boolean }

interface Props {
  explanation: string
  conceptChecks: ConceptCheck[]
  gapQuestion: GapQuestion
  tutoringSessionId: string
  attempts: number
  onMastered: () => void
  onGap: () => void
}

export function McqExplanation({
  explanation,
  conceptChecks,
  gapQuestion,
  tutoringSessionId,
  attempts,
  onMastered,
  onGap,
}: Props) {
  const [phase, setPhase] = useState<Phase>({ name: 'explaining' })
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({})
  const [checkResults, setCheckResults] = useState<Record<number, boolean>>({})
  const [gapSelected, setGapSelected] = useState<string | null>(null)
  const [gapResult, setGapResult] = useState<{ mastered: boolean; priorityGap: boolean } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [conceptChecksPassed, setConceptChecksPassed] = useState(0)

  const totalSteps = 1 + conceptChecks.length + 1

  function currentStep(): number {
    if (phase.name === 'explaining') return 1
    if (phase.name === 'concept_check') return 2 + phase.index
    if (phase.name === 'gap_question') return 1 + conceptChecks.length + 1
    return totalSteps
  }

  function handleConceptAnswer(index: number, answer: string) {
    const correct = answer === conceptChecks[index].correct_answer
    setSelectedAnswers(prev => ({ ...prev, [index]: answer }))
    setCheckResults(prev => ({ ...prev, [index]: correct }))
    if (correct) setConceptChecksPassed(p => p + 1)

    setTimeout(() => {
      if (index < conceptChecks.length - 1) {
        setPhase({ name: 'concept_check', index: index + 1 })
      } else {
        setPhase({ name: 'gap_question' })
      }
    }, 1200)
  }

  async function checkGapAnswer() {
    if (!gapSelected) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/tutor/mcq-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutoringSessionId,
          selectedAnswer: gapSelected,
          correctAnswer: gapQuestion.correct_answer,
          conceptChecksPassed,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setGapResult(data)
      if (data.mastered) { onMastered(); setPhase({ name: 'done', mastered: true, priorityGap: false }) }
      else if (data.priorityGap) { onGap(); setPhase({ name: 'done', mastered: false, priorityGap: true }) }
    } catch (err) {
      console.error('[McqExplanation] gap answer failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const gapQuestionAsQuestion: Question = {
    id: 'gap',
    test_type: gapQuestion.test_type as Question['test_type'],
    section: gapQuestion.section,
    topic: gapQuestion.topic,
    difficulty: gapQuestion.difficulty,
    question_text: gapQuestion.question_text,
    options: gapQuestion.options,
    correct_answer: gapQuestion.correct_answer,
    explanation: gapQuestion.explanation,
    generated_at: '',
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i < currentStep() - 1 ? 'bg-primary' :
              i === currentStep() - 1 ? 'bg-primary/60' : 'bg-border'
            }`}
          />
        ))}
        <span className="text-xs text-muted shrink-0 ml-1">
          {phase.name === 'explaining' ? 'Explanation' :
           phase.name === 'concept_check' ? `Concept Check ${phase.index + 1}/${conceptChecks.length}` :
           phase.name === 'gap_question' ? 'Challenge' : 'Done'}
        </span>
      </div>

      {/* Explanation phase */}
      {phase.name === 'explaining' && (
        <>
          <div className="p-5 bg-primary/10 border border-primary/20 rounded-2xl">
            <h3 className="font-semibold text-text-primary mb-2">Understanding the mistake</h3>
            <p className="text-muted leading-relaxed text-sm">{explanation}</p>
          </div>
          <button
            onClick={() => {
              if (conceptChecks.length > 0) {
                setPhase({ name: 'concept_check', index: 0 })
              } else {
                setPhase({ name: 'gap_question' })
              }
            }}
            className="py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-colors"
          >
            {conceptChecks.length > 0 ? `Start Concept Checks (${conceptChecks.length}) →` : 'Try Challenge Question →'}
          </button>
        </>
      )}

      {/* Concept check phase */}
      {phase.name === 'concept_check' && (() => {
        const idx = phase.index
        const check = conceptChecks[idx]
        const selected = selectedAnswers[idx] ?? null
        const result = checkResults[idx]

        const checkAsQuestion: Question = {
          id: `check-${idx}`,
          test_type: gapQuestion.test_type as Question['test_type'],
          section: gapQuestion.section,
          topic: gapQuestion.topic,
          difficulty: 2,
          question_text: check.question_text,
          options: check.options,
          correct_answer: check.correct_answer,
          explanation: check.explanation,
          generated_at: '',
        }

        return (
          <div className="flex flex-col gap-4">
            <div className="bg-surface border border-border rounded-2xl p-5">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">
                Concept Check {idx + 1} of {conceptChecks.length}
              </p>
              <McqQuestion
                question={checkAsQuestion}
                selectedAnswer={selected}
                onSelect={ans => { if (!selected) handleConceptAnswer(idx, ans) }}
                questionNumber={1}
                total={1}
              />
            </div>

            {selected !== null && (
              <div className={`p-4 rounded-xl border text-sm font-medium text-center ${
                result
                  ? 'bg-success/10 border-success/30 text-success'
                  : 'bg-danger/10 border-danger/30 text-danger'
              }`}>
                {result ? '✓ Correct! Moving on...' : `✗ The correct answer is ${check.correct_answer}. Moving on...`}
              </div>
            )}
          </div>
        )
      })()}

      {/* Gap question phase */}
      {phase.name === 'gap_question' && (
        <div className="flex flex-col gap-4">
          <div className="bg-surface border-l-4 border-accent rounded-2xl p-5">
            <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-4">
              Challenge Question — can you apply this now?
            </p>
            <McqQuestion
              question={gapQuestionAsQuestion}
              selectedAnswer={gapSelected}
              onSelect={setGapSelected}
              questionNumber={1}
              total={1}
            />
          </div>

          {!gapResult && (
            <button
              onClick={checkGapAnswer}
              disabled={!gapSelected || submitting}
              className="py-3 bg-accent hover:bg-amber-600 text-white rounded-xl font-medium transition-colors disabled:opacity-40"
            >
              {submitting ? 'Checking...' : 'Submit Answer'}
            </button>
          )}

          {gapResult && !gapResult.mastered && !gapResult.priorityGap && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-center">
              <p className="font-medium mb-3">Not quite — attempt {attempts} of 3.</p>
              <button
                onClick={() => { setGapSelected(null); setGapResult(null) }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* Done — mastered */}
      {phase.name === 'done' && phase.mastered && (
        <div className="p-6 bg-success/10 border border-success/30 rounded-2xl text-success text-center font-semibold">
          Excellent! Topic mastered.
        </div>
      )}

      {/* Done — priority gap */}
      {phase.name === 'done' && phase.priorityGap && (
        <div className="p-6 bg-danger/10 border border-danger/30 rounded-2xl text-danger text-center">
          <p className="font-semibold mb-1">Priority Gap Flagged</p>
          <p className="text-sm opacity-80">This topic has been flagged in your parent report for extra focus.</p>
        </div>
      )}
    </div>
  )
}
