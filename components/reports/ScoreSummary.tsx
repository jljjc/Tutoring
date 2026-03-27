import { getTSSBand } from '@/lib/test/scoring'

interface Props {
  latestTss: number | null
  totalTests: number
  progressPercent: number | null
}

export function ScoreSummary({ latestTss, totalTests, progressPercent }: Props) {
  const band = latestTss ? getTSSBand(latestTss) : null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard label="Projected TSS" value={latestTss ? String(Math.round(latestTss)) : '—'} sub="out of 400" color="blue" />
      <StatCard label="Ranking" value={band ?? '—'} sub="estimated" color="green" />
      <StatCard label="Tests Done" value={String(totalTests)} sub="sessions" color="purple" />
      <StatCard label="30-day Progress" value={progressPercent != null ? `${progressPercent >= 0 ? '+' : ''}${progressPercent}%` : '—'} sub="improvement" color="orange" />
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-400 bg-blue-50',
    green: 'border-green-400 bg-green-50',
    purple: 'border-purple-400 bg-purple-50',
    orange: 'border-orange-400 bg-orange-50',
  }
  return (
    <div className={`border-2 rounded-xl p-4 text-center ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{sub}</div>
      <div className="text-sm font-medium text-gray-700 mt-1">{label}</div>
    </div>
  )
}
