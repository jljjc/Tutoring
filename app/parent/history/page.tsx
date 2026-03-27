import { createClient } from '@/lib/supabase/server'

export default async function ParentHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: child } = await supabase
    .from('student_profiles').select('id').eq('parent_id', user!.id).single()

  if (!child) return <div className="p-8">No student linked.</div>

  const { data: sessions } = await supabase
    .from('test_sessions')
    .select('*')
    .eq('student_id', child.id)
    .order('started_at', { ascending: false })

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Test History</h1>
      {sessions?.map(s => (
        <div key={s.id} className="flex justify-between items-center p-4 border rounded-xl mb-3">
          <div>
            <div className="font-medium uppercase">{s.test_type} · {s.mode}</div>
            <div className="text-sm text-gray-500">{new Date(s.started_at).toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="font-bold">{s.total_score ?? '—'} correct</div>
            {s.projected_tss && <div className="text-sm text-blue-600">TSS ~{Math.round(s.projected_tss)}</div>}
          </div>
        </div>
      ))}
    </main>
  )
}
