'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/types'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [role, setRole] = useState<UserRole>('student')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [childEmail, setChildEmail] = useState('') // parent only
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signupError } = await supabase.auth.signUp({ email, password })
    if (signupError || !data.user) { setError(signupError?.message ?? 'Signup failed'); setLoading(false); return }

    // Insert into public.users
    const { error: insertError } = await supabase.from('users').insert({
      id: data.user.id,
      role,
      full_name: fullName,
    })
    if (insertError) { setError(insertError.message); setLoading(false); return }

    if (role === 'student') {
      const { error: profileError } = await supabase.from('student_profiles').insert({ id: data.user.id })
      if (profileError) { setError(profileError.message); setLoading(false); return }
    }

    if (role === 'parent' && childEmail) {
      await fetch('/api/link-child', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childEmail }),
      })
      // Linking may fail if child hasn't signed up yet — parent can retry from dashboard
    }

    router.push(role === 'parent' ? '/parent/dashboard' : '/student/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <form onSubmit={handleSignup} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Create Account</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2">
          {(['student', 'parent'] as UserRole[]).map(r => (
            <button key={r} type="button" onClick={() => setRole(r)}
              className={`flex-1 py-2 rounded-lg border font-medium capitalize ${role === r ? 'bg-blue-600 text-white border-blue-600' : ''}`}>
              {r}
            </button>
          ))}
        </div>
        <input placeholder="Full name" value={fullName} onChange={e => setFullName(e.target.value)}
          className="border rounded-lg p-3" required />
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          className="border rounded-lg p-3" required />
        <input type="password" placeholder="Password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)}
          className="border rounded-lg p-3" required minLength={6} />
        {role === 'parent' && (
          <input placeholder="Child's email (to link accounts)" value={childEmail} onChange={e => setChildEmail(e.target.value)}
            className="border rounded-lg p-3" />
        )}
        <button type="submit" disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50">
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>
      </form>
    </main>
  )
}
