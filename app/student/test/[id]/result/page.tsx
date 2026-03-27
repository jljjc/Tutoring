import { createClient } from '@/lib/supabase/server'
import { getTSSBand } from '@/lib/test/scoring'
import Link from 'next/link'

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('test_sessions').select('*').eq('id', id).single()

  const { data: wrongAnswers } = await supabase
    .from('test_answers')
    .select('id, question_bank!inner(topic, section)')
    .eq('session_id', id)
    .eq('is_correct', false)

  if (!session) return <div className="p-8">Session not found.</div>

  const scores = session.section_scores as Record<string, number> | null
  const tss = session.projected_tss
  const band = tss ? getTSSBand(tss) : null

  return (
    <main className="max-w-2xl mx-auto p-8 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Test Complete!</h1>

      {tss && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
          <div className="text-4xl font-bold text-blue-700">{Math.round(tss)}</div>
          <div className="text-sm text-gray-500">Projected TSS / 400</div>
          <div className="text-lg font-medium text-blue-600 mt-1">{band}</div>
        </div>
      )}

      {scores && (
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold">Section Scores</h2>
          {Object.entries(scores).map(([section, score]) => (
            <div key={section} className="flex justify-between p-3 bg-gray-50 rounded-lg">
              <span className="capitalize">{section.replace(/_/g, ' ')}</span>
              <span className="font-bold">{score}</span>
            </div>
          ))}
        </div>
      )}

      {wrongAnswers && wrongAnswers.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold">Questions to Review ({wrongAnswers.length})</h2>
          {(wrongAnswers as unknown as { id: string; question_bank: { topic: string; section: string } }[]).map((a) => (
            <Link key={a.id} href={`/student/tutor/${a.id}`}
              className="flex justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100">
              <span>{a.question_bank.topic}</span>
              <span className="text-sm text-amber-700">Review →</span>
            </Link>
          ))}
        </div>
      )}

      <Link href="/student/dashboard" className="text-center py-3 border rounded-lg">Back to Dashboard</Link>
    </main>
  )
}
