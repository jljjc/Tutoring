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

  // Confirm child is a student role
  const { data: childProfile } = await supabase
    .from('users').select('role').eq('id', childUserId).single()
  if (childProfile?.role !== 'student') {
    return NextResponse.json({ error: 'That account is not a student' }, { status: 400 })
  }

  // Set parent_id on student_profiles
  const { error: updateError } = await supabase
    .from('student_profiles')
    .update({ parent_id: user.id })
    .eq('id', childUserId)

  if (updateError) {
    console.error('[link-child] update failed:', updateError.message)
    return NextResponse.json({ error: 'Failed to link child account' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
