import { createClient } from '@/lib/supabase/server'
import { getTSSBand } from '@/lib/test/scoring'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LinkStudentForm } from '@/components/parent/LinkStudentForm'

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
        .not('completed_at', 'is', null)
        .order('started_at', { ascending: false })
    : { data: null }

  const latestFull = sessions?.find(s => s.mode === 'full' && s.projected_tss)
  const tss = latestFull?.projected_tss
  const band = tss ? getTSSBand(tss) : null

  const childName = child
    ? (child as unknown as { users: { full_name: string } }).users.full_name
    : null

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text-primary">
        {childName ? `${childName.split(' ')[0]}'s Progress` : 'Parent Dashboard'}
      </h1>

      {!child && (
        <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4">
          <div>
            <p className="text-text-primary font-medium mb-1">No student linked yet</p>
            <p className="text-sm text-muted">Enter your child's email address to link their account.</p>
          </div>
          <LinkStudentForm />
        </div>
      )}

      {child && tss && (
        <div className="bg-surface border border-border rounded-2xl p-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted mb-1">Projected GATE TSS</p>
            <p className="text-4xl font-black text-accent tabular-nums">{Math.round(tss)}<span className="text-lg text-muted font-normal"> / 400</span></p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-primary">{band}</p>
            <p className="text-sm text-muted">{sessions?.length ?? 0} tests taken</p>
          </div>
        </div>
      )}

      {child && (
        <div className="flex gap-3">
          <Link href="/parent/reports" className="flex-1 py-3 text-center bg-surface border border-border rounded-xl text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors">
            Full Report
          </Link>
          <Link href="/parent/history" className="flex-1 py-3 text-center bg-surface border border-border rounded-xl text-sm font-medium text-text-primary hover:bg-surface-raised transition-colors">
            Test History
          </Link>
        </div>
      )}
    </div>
  )
}
