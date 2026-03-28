'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function LinkStudentForm({ hasChildren }: { hasChildren: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch('/api/link-child', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childEmail: email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setMessage(data.error ?? 'Failed to link student.')
      } else {
        setEmail('')
        setStatus('idle')
        router.refresh()
      }
    } catch {
      setStatus('error')
      setMessage('Network error. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {status === 'error' && (
        <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{message}</p>
      )}
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Child's email address"
          required
          className="flex-1 px-4 py-2.5 bg-surface-raised border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-primary placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
        >
          {status === 'loading' ? 'Linking...' : hasChildren ? 'Link Another' : 'Link Student'}
        </button>
      </div>
    </form>
  )
}
