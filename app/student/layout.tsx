import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'

const STUDENT_NAV = [
  { href: '/student/dashboard', label: 'Dashboard' },
  { href: '/student/test/select', label: 'Start Test' },
  { href: '/student/history', label: 'History' },
]

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users').select('role, full_name').eq('id', user.id).single()
  if (profile?.role !== 'student') redirect('/parent/dashboard')

  return (
    <AppShell
      user={{ full_name: profile.full_name ?? 'Student', role: 'student' }}
      navLinks={STUDENT_NAV}
    >
      {children}
    </AppShell>
  )
}
