import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'

const PARENT_NAV = [
  { href: '/parent/dashboard', label: 'Dashboard' },
  { href: '/parent/history', label: 'History' },
  { href: '/parent/reports', label: 'Reports' },
]

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users').select('role, full_name').eq('id', user.id).single()
  if (profile?.role !== 'parent') redirect('/student/dashboard')

  return (
    <AppShell
      user={{ full_name: profile.full_name ?? 'Parent', role: 'parent' }}
      navLinks={PARENT_NAV}
    >
      {children}
    </AppShell>
  )
}
