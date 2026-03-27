'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
    <main className="min-h-screen flex items-center justify-center p-8">
      <form onSubmit={handleLogin} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Log In</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          className="border rounded-lg p-3" required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
          className="border rounded-lg p-3" required />
        <button type="submit" disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50">
          {loading ? 'Logging in...' : 'Log In'}
        </button>
        <a href="/auth/signup" className="text-sm text-center text-blue-600">No account? Sign up</a>
      </form>
    </main>
  )
}
