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
  const normalizedEmail = String(childEmail ?? '').trim().toLowerCase()
  if (!normalizedEmail) return NextResponse.json({ error: 'childEmail required' }, { status: 400 })

  // Look up child's user ID via the SECURITY DEFINER DB function
  const { data: childUserId, error } = await supabase
    .rpc('get_user_id_by_email', { email: normalizedEmail })

  if (error || !childUserId) {
    return NextResponse.json({ error: 'No student account found with that email' }, { status: 404 })
  }

  if (childUserId === user.id) {
    return NextResponse.json({ error: 'You cannot link your own account as a child' }, { status: 400 })
  }

  // Prefer the explicit-parent RPC when available. If the DB migration has not been
  // applied yet, fall back to the older function and verify the link afterwards.
  let rpcError: { message: string } | null = null
  const v2 = await supabase.rpc('link_child_to_parent_v2', {
    child_id: childUserId,
    parent_user_id: user.id,
  })

  if (v2.error) {
    const missingV2 =
      v2.error.message.includes('Could not find the function public.link_child_to_parent_v2')
      || v2.error.message.includes('function public.link_child_to_parent_v2')

    if (missingV2) {
      const legacy = await supabase.rpc('link_child_to_parent', { child_id: childUserId })
      rpcError = legacy.error ? { message: legacy.error.message } : null
    } else {
      rpcError = { message: v2.error.message }
    }
  }

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

  const { data: linkedProfile } = await supabase
    .from('student_profiles')
    .select('id')
    .eq('id', childUserId)
    .eq('parent_id', user.id)
    .maybeSingle()

  if (!linkedProfile) {
    console.error('[link-child] verification failed:', {
      childUserId,
      parentUserId: user.id,
    })
    return NextResponse.json({
      error: 'Linking did not persist. The database linking function may be outdated and needs the latest Supabase migration.',
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
