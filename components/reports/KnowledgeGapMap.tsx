interface GapEntry {
  topic: string
  section: string
  occurrenceCount: number
}

interface Props {
  gaps: GapEntry[]
}

export function KnowledgeGapMap({ gaps }: Props) {
  const getStatus = (g: GapEntry) => {
    if (g.occurrenceCount >= 3) return 'red'
    if (g.occurrenceCount >= 2) return 'amber'
    return 'green'
  }

  const colors = {
    red: 'bg-red-100 border-red-400 text-red-800',
    amber: 'bg-amber-100 border-amber-400 text-amber-800',
    green: 'bg-green-100 border-green-400 text-green-800',
  }

  const labels = { red: 'Priority', amber: 'Repeated', green: 'Watch' }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3 text-xs mb-2">
        {(['red', 'amber', 'green'] as const).map(c => (
          <span key={c} className={`px-2 py-1 rounded border ${colors[c]}`}>{labels[c]}</span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {gaps.map((g, i) => {
          const status = getStatus(g)
          return (
            <span key={i} className={`px-3 py-1 rounded-full border text-sm ${colors[status]}`}>
              {g.topic} <span className="opacity-70">({g.occurrenceCount})</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
