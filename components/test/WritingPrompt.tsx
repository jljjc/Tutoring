'use client'
import { useState } from 'react'

interface Props {
  prompt: string
  onSubmit: (text: string) => void
  timeLimitSecs: number
}

export function WritingPrompt({ prompt, onSubmit }: Props) {
  const [text, setText] = useState('')
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="font-medium">{prompt}</p>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        className="border rounded-lg p-3 min-h-48 resize-y"
        placeholder="Write your response here..."
      />
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{wordCount} words</span>
        <button
          onClick={() => onSubmit(text)}
          disabled={wordCount < 10}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-40"
        >
          Submit Writing
        </button>
      </div>
    </div>
  )
}
