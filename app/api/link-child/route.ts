import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Confirm caller is a parent
  const { data: callerProfile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  if (callerProfile?.role !== 'parent') {
    return NextResponse.json({ error: 'Only parents can link children' }, { status: 403 })
  }

  const { childEmail } = await request.json()
  if (!childEmail) return NextResponse.json({ error: 'childEmail required' }, { status: 400 })

  // Look up child's user ID via the SECURITY DEFINER DB function
  const { data: childUserId, error } = await supabase
    .rpc('get_user_id_by_email', { email: childEmail })

  if (error || !childUserId) {
    return NextResponse.json({ error: 'No student account found with that email' }, { status: 404 })
  }

  // Set parent_id on student_profiles — only students have a row here.
  // Reading the child's role from `users` would be blocked by RLS (parents can
  // only see their own row), so we infer student status from the update result.
  const { data: updated, error: updateError } = await supabase
    .from('student_profiles')
    .update({ parent_id: user.id })
    .eq('id', childUserId)
    .select('id')

  if (updateError) {
    console.error('[link-child] update failed:', updateError.message)
    return NextResponse.json({ error: 'Failed to link child account' }, { status: 500 })
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'That account is not a student' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
