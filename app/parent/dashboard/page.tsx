import { createClient } from '@/lib/supabase/server'
import { getTSSBand } from '@/lib/test/scoring'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LinkStudentForm } from '@/components/parent/LinkStudentForm'

type ChildRow = {
  id: string
  users: { full_name: string } | Array<{ full_name: string }>
}

function getChildName(child: ChildRow): string {
  return Array.isArray(child.users) ? (child.users[0]?.full_name ?? 'Student') : child.users.full_name
}

export default async function ParentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: children } = await supabase
    .from('student_profiles')
    .select('id, users!inner(full_name)')
    .eq('parent_id', user.id)

  const childList = (children ?? []) as unknown as ChildRow[]
  const childIds = childList.map(child => child.id)

  const { data: sessions } = childIds.length > 0
    ? await supabase
        .from('test_sessions')
        .select('student_id, projected_tss, started_at, completed_at')
        .in('student_id', childIds)
        .not('completed_at', 'is', null)
        .order('started_at', { ascending: false })
    : { data: null }

  const latestTssByChild = new Map<string, number>()
  for (const session of sessions ?? []) {
    if (!session.projected_tss || latestTssByChild.has(session.student_id)) continue
    latestTssByChild.set(session.student_id, session.projected_tss)
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text-primary">Parent Dashboard</h1>

      {childList.length === 0 && (
        <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4">
          <div>
            <p className="text-text-primary font-medium mb-1">No student linked yet</p>
            <p className="text-sm text-muted">Enter your child&apos;s email address to link their account.</p>
          </div>
          <LinkStudentForm hasChildren={false} />
        </div>
      )}

      {childList.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {childList.map(child => {
              const tss = latestTssByChild.get(child.id)
              const band = tss ? getTSSBand(tss) : null

              return (
                <div
                  key={child.id}
                    className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-text-primary">{getChildName(child)}</p>
                    {tss ? (
                      <p className="text-sm text-muted mt-1">
                        TSS <span className="text-accent font-bold tabular-nums">{Math.round(tss)}</span>
                        {band && <span className="ml-2 text-primary">{band}</span>}
                      </p>
                    ) : (
                      <p className="text-sm text-muted mt-1">No full test completed yet.</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link
                      href={`/parent/history?child=${child.id}`}
                      className="px-3 py-2 bg-surface-raised border border-border rounded-lg text-xs font-medium text-text-primary hover:bg-surface transition-colors"
                    >
                      View History
                    </Link>
                    <Link
                      href={`/parent/reports?child=${child.id}`}
                      className="px-3 py-2 bg-primary/20 text-primary rounded-lg text-xs font-medium hover:bg-primary/30 transition-colors"
                    >
                      View Reports
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
            <p className="text-sm font-medium text-text-primary">Link another child</p>
            <LinkStudentForm hasChildren={true} />
          </div>
        </>
      )}
    </div>
  )
}
