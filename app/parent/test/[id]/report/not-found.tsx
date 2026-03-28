import Link from 'next/link'

export default function ParentTestReportNotFound() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-6 py-20">
        <div className="rounded-3xl border border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium text-muted uppercase tracking-widest mb-2">Parent Report</p>
          <h1 className="text-2xl font-bold text-text-primary mb-3">Report not available</h1>
          <p className="text-sm text-muted mb-6">
            We could not find that completed test report, or this test is not linked to your family account.
          </p>
          <Link
            href="/parent/history"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 text-sm font-medium transition-colors"
          >
            Back to History
          </Link>
        </div>
      </div>
    </main>
  )
}
