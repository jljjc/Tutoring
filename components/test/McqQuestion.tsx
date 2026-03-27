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
    <div className="flex flex-col gap-4">
      <div className="text-sm text-gray-500">Question {questionNumber} of {total}</div>
      <p className="text-lg font-medium">{question.question_text}</p>
      <div className="flex flex-col gap-2">
        {(Object.entries(question.options) as [string, string][]).map(([key, value]) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`text-left p-4 rounded-lg border-2 transition-colors ${
              selectedAnswer === key
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-400'
            }`}
          >
            <span className="font-bold mr-2">{key}.</span>{value}
          </button>
        ))}
      </div>
    </div>
  )
}
