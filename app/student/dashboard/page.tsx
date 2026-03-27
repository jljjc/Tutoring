import { createClient } from '@/lib/supabase/server'
import { getTSSBand } from '@/lib/test/scoring'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function StudentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users').select('full_name').eq('id', user.id).single()

  const { data: recentSessions } = await supabase
    .from('test_sessions')
    .select('*')
    .eq('student_id', user.id)
    .order('started_at', { ascending: false })
    .limit(5)

  const latestFull = recentSessions?.find(s => s.mode === 'full' && s.projected_tss)
  const tss = latestFull?.projected_tss
  const band = tss ? getTSSBand(tss) : null

  return (
    <main className="max-w-2xl mx-auto p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Welcome, {profile?.full_name?.split(' ')[0]}</h1>
        <Link href="/student/test/select" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
          Start Test
        </Link>
      </div>

      {tss && (
        <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">Projected GATE TSS</div>
            <div className="text-3xl font-bold text-blue-700">{Math.round(tss)} / 400</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-blue-600">{band}</div>
            <div className="text-sm text-gray-500">estimated ranking</div>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent Tests</h2>
          <Link href="/student/history" className="text-sm text-blue-600">View all</Link>
        </div>
        {recentSessions?.length === 0 && <p className="text-gray-500 text-sm">No tests yet. Start your first test!</p>}
        {recentSessions?.map(s => (
          <div key={s.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg mb-2">
            <div>
              <div className="font-medium uppercase text-sm">{s.test_type} — {s.mode}</div>
              <div className="text-xs text-gray-500">{new Date(s.started_at).toLocaleDateString()}</div>
            </div>
            <div className="text-right">
              <div className="font-bold">{s.total_score ?? '—'}</div>
              {s.projected_tss && <div className="text-xs text-blue-600">TSS ~{Math.round(s.projected_tss)}</div>}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
