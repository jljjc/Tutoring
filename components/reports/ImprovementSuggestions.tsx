'use client'
import { useEffect, useState } from 'react'

export function ImprovementSuggestions({ studentId }: { studentId: string }) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports/suggestions?studentId=${encodeURIComponent(studentId)}`)
      .then(r => r.json())
      .then(d => { setSuggestions(d.suggestions ?? []); setLoading(false) })
      .catch(() => { setSuggestions([]); setLoading(false) })
  }, [studentId])

  if (loading) return <div className="text-sm text-gray-400">Generating suggestions...</div>

  return (
    <ul className="flex flex-col gap-2">
      {suggestions.map((s, i) => (
        <li key={i} className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-gray-700">
          {s}
        </li>
      ))}
    </ul>
  )
}
