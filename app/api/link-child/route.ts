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

  // Use a SECURITY DEFINER RPC to update student_profiles.
  // A direct UPDATE is blocked by RLS (only the student can update their own row),
  // so we delegate to a trusted DB function that bypasses RLS safely.
  const { error: rpcError } = await supabase
    .rpc('link_child_to_parent', { child_id: childUserId })

  if (rpcError) {
    if (rpcError.message.includes('not_a_student')) {
      return NextResponse.json({ error: 'That account is not a student' }, { status: 400 })
    }
    if (rpcError.message.includes('already_linked')) {
      return NextResponse.json({ error: 'That student is already linked to another parent' }, { status: 400 })
    }
    console.error('[link-child] rpc failed:', rpcError.message)
    return NextResponse.json({ error: 'Failed to link child account' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
