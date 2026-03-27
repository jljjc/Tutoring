import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scoreWriting } from '@/lib/claude/score-writing'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prompt, responseText, testType } = await request.json()
  if (!prompt || !responseText || !testType) {
    return NextResponse.json({ error: 'prompt, responseText, and testType are required' }, { status: 400 })
  }

  try {
    const result = await scoreWriting({ prompt, responseText, testType })
    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('[writing/score] error:', err)
    return NextResponse.json({ error: 'Failed to score writing' }, { status: 500 })
  }
}
