'use client'
import { useEffect, useState } from 'react'

interface Props {
  timeLimitSecs: number
  onExpire: () => void
}

export function SectionTimer({ timeLimitSecs, onExpire }: Props) {
  const [remaining, setRemaining] = useState(timeLimitSecs)

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining, onExpire])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const isLow = remaining < 120

  return (
    <div className={`font-mono text-lg font-bold ${isLow ? 'text-red-600' : 'text-gray-700'}`}>
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  )
}
