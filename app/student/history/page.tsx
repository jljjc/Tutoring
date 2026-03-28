import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const PAGE_SIZE = 10

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: sessions, count } = await supabase
    .from('test_sessions')
    .select('*', { count: 'exact' })
    .eq('student_id', user.id)
    .not('completed_at', 'is', null)
    .order('started_at', { ascending: false })
    .range(from, to)

  const total = count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Test History</h1>
        <p className="text-sm text-muted">
          {total === 0 ? 'No tests yet' : `Showing ${from + 1}–${Math.min(to + 1, total)} of ${total}`}
        </p>
      </div>

      {(!sessions || sessions.length === 0) && (
        <div className="text-center py-16 text-muted">No completed tests found.</div>
      )}

      <div className="flex flex-col gap-3">
        {sessions?.map(s => {
          const testType = (s.test_type as string).toUpperCase()
          const mode = (s.mode as string).toUpperCase()
          return (
            <div key={s.id} className="bg-surface border border-border rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex gap-2 shrink-0">
                  <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-semibold rounded-full">{testType}</span>
                  <span className="px-2 py-0.5 bg-surface-raised text-muted text-xs font-medium rounded-full">{mode}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted truncate">{new Date(s.started_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-5 shrink-0">
                <div className="text-right hidden sm:block">
                  {s.projected_tss && (
                    <p className="text-accent font-bold tabular-nums">TSS {Math.round(s.projected_tss)}</p>
                  )}
                  {s.total_score != null && (
                    <p className="text-xs text-muted">{s.total_score} correct</p>
                  )}
                </div>
                <Link
                  href={`/student/test/${s.id}/result`}
                  className="px-4 py-2 bg-primary/20 text-primary hover:bg-primary/30 text-sm font-medium rounded-xl transition-colors"
                >
                  View →
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8">
          <Link
            href={`?page=${page - 1}`}
            className={`px-4 py-2 border border-border rounded-xl text-sm font-medium transition-colors ${
              page <= 1 ? 'opacity-30 pointer-events-none text-muted' : 'text-text-primary hover:bg-surface-raised'
            }`}
          >
            ← Previous
          </Link>
          <span className="text-sm text-muted">Page {page} of {totalPages}</span>
          <Link
            href={`?page=${page + 1}`}
            className={`px-4 py-2 border border-border rounded-xl text-sm font-medium transition-colors ${
              page >= totalPages ? 'opacity-30 pointer-events-none text-muted' : 'text-text-primary hover:bg-surface-raised'
            }`}
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  )
}
