import { createClient } from '@/lib/supabase/server'
import { ScoreSummary } from '@/components/reports/ScoreSummary'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ParentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: child } = await supabase
    .from('student_profiles')
    .select('id, users!inner(full_name)')
    .eq('parent_id', user.id)
    .single()

  const { data: sessions } = child
    ? await supabase
        .from('test_sessions')
        .select('*')
        .eq('student_id', child.id)
        .order('started_at', { ascending: false })
    : { data: null }

  const latestFull = sessions?.find(s => s.mode === 'full' && s.projected_tss)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const recentSessions = sessions?.filter(s => new Date(s.started_at) > thirtyDaysAgo) ?? []
  const firstRecent = recentSessions[recentSessions.length - 1]
  const progressPercent = latestFull && firstRecent?.projected_tss
    ? Math.round(((latestFull.projected_tss - firstRecent.projected_tss) / (firstRecent.projected_tss || 1)) * 100)
    : null

  return (
    <main className="max-w-2xl mx-auto p-8 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">
        {child ? `${(child as any).users.full_name}'s Progress` : 'Parent Dashboard'}
      </h1>

      {!child && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
          No student linked yet. Ask your child to sign up and then link accounts.
        </div>
      )}

      {child && (
        <ScoreSummary
          latestTss={latestFull?.projected_tss ?? null}
          totalTests={sessions?.length ?? 0}
          progressPercent={progressPercent}
        />
      )}

      <div className="flex gap-3">
        <Link href="/parent/reports" className="flex-1 py-3 text-center border rounded-xl hover:bg-gray-50">
          Full Report
        </Link>
        <Link href="/parent/history" className="flex-1 py-3 text-center border rounded-xl hover:bg-gray-50">
          Test History
        </Link>
      </div>
    </main>
  )
}
