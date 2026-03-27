import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'student') redirect('/parent/dashboard')

  return <>{children}</>
}
