'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TestType, TestMode } from '@/lib/types'
import { TEST_CONFIG } from '@/lib/test/constants'

export default function TestSelectPage() {
  const router = useRouter()
  const [testType, setTestType] = useState<TestType>('gate')
  const [mode, setMode] = useState<TestMode>('full')
  const [sectionKey, setSectionKey] = useState('')
  const [loading, setLoading] = useState(false)

  const sections = TEST_CONFIG[testType]

  async function startTest() {
    setLoading(true)
    const res = await fetch('/api/test/assemble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testType, mode, sectionKey: mode === 'practice' ? sectionKey : undefined }),
    })
    const data = await res.json()
    if (data.session) {
      sessionStorage.setItem(`test-session-${data.session.id}`, JSON.stringify(data))
      router.push(`/student/test/${data.session.id}`)
    } else {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-lg mx-auto p-8 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Start a Test</h1>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Test type</p>
        <div className="flex gap-2">
          {(['gate', 'scholarship'] as TestType[]).map(t => (
            <button key={t} onClick={() => setTestType(t)}
              className={`flex-1 py-2 rounded-lg border font-medium uppercase text-sm ${testType === t ? 'bg-blue-600 text-white border-blue-600' : ''}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Mode</p>
        <div className="flex gap-2">
          <button onClick={() => setMode('full')} className={`flex-1 py-2 rounded-lg border font-medium text-sm ${mode === 'full' ? 'bg-blue-600 text-white border-blue-600' : ''}`}>Full Test</button>
          <button onClick={() => setMode('practice')} className={`flex-1 py-2 rounded-lg border font-medium text-sm ${mode === 'practice' ? 'bg-blue-600 text-white border-blue-600' : ''}`}>Practice (one section)</button>
        </div>
      </div>

      {mode === 'practice' && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Section</p>
          <select value={sectionKey} onChange={e => setSectionKey(e.target.value)} className="w-full border rounded-lg p-3">
            <option value="">Select section...</option>
            {sections.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      )}

      <button onClick={startTest} disabled={loading || (mode === 'practice' && !sectionKey)}
        className="py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50">
        {loading ? 'Preparing test...' : 'Start Test'}
      </button>
    </main>
  )
}
