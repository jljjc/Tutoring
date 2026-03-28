'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }

    // Determine role and redirect
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
    router.push(profile?.role === 'parent' ? '/parent/dashboard' : '/student/dashboard')
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <form onSubmit={handleLogin} className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8 shadow-xl flex flex-col gap-4">
        <h1 className="text-xl font-bold text-text-primary mb-6">Log In</h1>
        {error && <p className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">{error}</p>}
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted">Email</label>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="px-4 py-2.5 bg-surface-raised border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-primary placeholder:text-muted" required />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted">Password</label>
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
            className="px-4 py-2.5 bg-surface-raised border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-primary placeholder:text-muted" required />
        </div>
        <button type="submit" disabled={loading}
          className="py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50">
          {loading ? 'Logging in...' : 'Log In'}
        </button>
        <Link href="/auth/signup" className="text-sm text-center text-primary hover:text-primary-hover">No account? Sign up</Link>
      </form>
    </main>
  )
}
