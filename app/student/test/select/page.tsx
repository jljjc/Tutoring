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
  const [error, setError] = useState('')

  const sections = TEST_CONFIG[testType]

  async function startTest() {
    setLoading(true)
    try {
      const res = await fetch('/api/test/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType, mode, sectionKey: mode === 'practice' ? sectionKey : undefined }),
      })
      if (!res.ok) throw new Error('Failed to assemble test')
      const data = await res.json()
      sessionStorage.setItem(`test-session-${data.session.id}`, JSON.stringify(data))
      router.push(`/student/test/${data.session.id}`)
    } catch (err) {
      console.error('[TestSelect] startTest failed:', err)
      setError('Failed to start test. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="max-w-lg mx-auto p-8 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text-primary">Start a Test</h1>
      {error && <p className="text-danger text-sm p-3 bg-danger/10 border border-danger/30 rounded-lg">{error}</p>}
      {loading && <p className="text-sm text-muted">Generating questions with AI — this takes up to 30 seconds on first run...</p>}

      <div>
        <p className="text-sm font-medium text-text-primary mb-2">Test type</p>
        <div className="flex gap-2">
          {(['gate', 'scholarship'] as TestType[]).map(t => (
            <button key={t} onClick={() => setTestType(t)}
              className={`flex-1 py-2 rounded-lg border font-medium uppercase text-sm ${testType === t ? 'bg-primary text-white border-primary' : 'bg-surface-raised text-muted border-border'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-text-primary mb-2">Mode</p>
        <div className="flex gap-2">
          <button onClick={() => setMode('full')} className={`flex-1 py-2 rounded-lg border font-medium text-sm ${mode === 'full' ? 'bg-primary text-white border-primary' : 'bg-surface-raised text-muted border-border'}`}>Full Test</button>
          <button onClick={() => setMode('practice')} className={`flex-1 py-2 rounded-lg border font-medium text-sm ${mode === 'practice' ? 'bg-primary text-white border-primary' : 'bg-surface-raised text-muted border-border'}`}>Practice (one section)</button>
        </div>
      </div>

      {mode === 'practice' && (
        <div>
          <p className="text-sm font-medium text-text-primary mb-2">Section</p>
          <select value={sectionKey} onChange={e => setSectionKey(e.target.value)} className="w-full border border-border rounded-lg p-3 bg-surface-raised text-text-primary">
            <option value="">Select section...</option>
            {sections.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      )}

      <button onClick={startTest} disabled={loading || (mode === 'practice' && !sectionKey)}
        className="py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium disabled:opacity-50">
        {loading ? 'Preparing test...' : 'Start Test'}
      </button>
    </main>
  )
}
