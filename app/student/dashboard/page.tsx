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
    .not('completed_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(5)

  const latestFull = recentSessions?.find(s => s.mode === 'full' && s.projected_tss)
  const tss = latestFull?.projected_tss
  const band = tss ? getTSSBand(tss) : null

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">
          Welcome, {profile?.full_name?.split(' ')[0]}
        </h1>
        <Link
          href="/student/test/select"
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-primary/20"
        >
          Start Test
        </Link>
      </div>

      {tss ? (
        <div className="bg-surface border border-border rounded-2xl p-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted mb-1">Projected GATE TSS</p>
            <p className="text-5xl font-black text-accent tabular-nums">
              {Math.round(tss)}
              <span className="text-xl text-muted font-normal"> / 400</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-primary">{band}</p>
            <p className="text-sm text-muted">estimated ranking</p>
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl p-6 text-center">
          <p className="text-muted text-sm">Complete your first full test to see your projected TSS.</p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-text-primary">Recent Tests</h2>
          <Link href="/student/history" className="text-sm text-primary hover:text-primary-hover">View all →</Link>
        </div>
        {(!recentSessions || recentSessions.length === 0) && (
          <p className="text-muted text-sm p-4 bg-surface border border-border rounded-xl">
            No tests yet. Start your first test above!
          </p>
        )}
        <div className="flex flex-col gap-2">
          {recentSessions?.map(s => (
            <div key={s.id} className="flex justify-between items-center px-4 py-3 bg-surface border border-border rounded-xl">
              <div>
                <p className="text-sm font-medium text-text-primary uppercase tracking-wide">
                  {s.test_type} — {s.mode}
                </p>
                <p className="text-xs text-muted">{new Date(s.started_at).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                {s.projected_tss && (
                  <p className="font-bold text-accent tabular-nums">TSS {Math.round(s.projected_tss)}</p>
                )}
                {s.total_score != null && (
                  <p className="text-xs text-muted">{s.total_score} correct</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
