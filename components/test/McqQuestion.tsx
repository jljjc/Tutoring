import type { Question } from '@/lib/types'

interface Props {
  question: Question
  selectedAnswer: string | null
  onSelect: (answer: string) => void
  questionNumber: number
  total: number
}

export function McqQuestion({ question, selectedAnswer, onSelect, questionNumber, total }: Props) {
  return (
    <div className="flex flex-col gap-5">
      {/* Question header */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 flex flex-col items-center gap-1">
          <span className="w-8 h-8 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center">
            {questionNumber}
          </span>
          <span className="text-[11px] text-muted font-medium">
            {questionNumber}/{total}
          </span>
        </div>
        <p className="text-text-primary text-base leading-relaxed font-medium pt-1 whitespace-pre-wrap font-mono">{question.question_text}</p>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2.5 pl-11">
        {(Object.entries(question.options) as [string, string][]).map(([key, value]) => {
          const selected = selectedAnswer === key
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`text-left px-4 py-3.5 rounded-xl border-2 transition-all duration-150 flex items-start gap-3 group ${
                selected
                  ? 'border-primary bg-primary/10 shadow-sm shadow-primary/10'
                  : 'border-border bg-surface-raised hover:border-primary/50 hover:bg-primary/5'
              }`}
            >
              <span className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold mt-0.5 transition-colors ${
                selected
                  ? 'border-primary bg-primary text-white'
                  : 'border-border text-muted group-hover:border-primary/60'
              }`}>
                {key}
              </span>
              <span className={`text-sm leading-relaxed ${selected ? 'text-text-primary font-medium' : 'text-muted'}`}>
                {value}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
