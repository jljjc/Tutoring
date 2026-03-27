import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: sessions } = await supabase
    .from('test_sessions')
    .select('*')
    .eq('student_id', user.id)
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
            <div className="font-bold text-lg">{s.total_score ?? '—'}</div>
            {s.projected_tss && <div className="text-sm text-blue-600">TSS ~{Math.round(s.projected_tss)}</div>}
          </div>
        </div>
      ))}
    </main>
  )
}
