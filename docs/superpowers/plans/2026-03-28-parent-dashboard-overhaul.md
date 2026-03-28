# Parent Dashboard Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the parent experience — unblock Vercel build, support multiple children, add auto-refresh on link, fix history links, and add a read-only parent test report page.

**Architecture:** All changes are confined to parent-facing pages and one API route fix. No new API routes are needed — all parent report data is fetched server-side using existing RLS policies. The new report page lives under `app/parent/` so the existing parent layout handles auth automatically.

**Tech Stack:** Next.js 14 App Router (server components), Supabase JS client, TypeScript, Tailwind CSS with design tokens.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `app/api/test/assemble/route.ts` | Modify line 103 | Fix TS build error (`slots.length` → sum) |
| `components/parent/LinkStudentForm.tsx` | Modify | Auto-refresh page on successful link |
| `app/parent/dashboard/page.tsx` | Modify | Multi-child query + child card list |
| `app/parent/history/page.tsx` | Modify | Multi-child sessions, child badge, correct View link |
| `app/parent/test/[id]/report/page.tsx` | Create | Read-only parent test report |

---

## Task 1: Fix Vercel build error

**Files:**
- Modify: `app/api/test/assemble/route.ts:103`

- [ ] **Step 1: Open the file and find line 103**

The broken line reads:
```ts
selected = selectQuestions(generatedWithIds, seenIds, slots) ?? generatedWithIds.slice(0, slots.length)
```
`slots` is typed as `DifficultySlots = { easy: number; medium: number; hard: number }` — it has no `.length`.

- [ ] **Step 2: Fix the line**

Replace that line with:
```ts
selected = selectQuestions(generatedWithIds, seenIds, slots) ?? generatedWithIds.slice(0, slots.easy + slots.medium + slots.hard)
```

- [ ] **Step 3: Verify no TS errors**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/test/assemble/route.ts
git commit -m "fix: correct DifficultySlots fallback slice — slots has no .length"
```

---

## Task 2: LinkStudentForm — auto-refresh on success

**Files:**
- Modify: `components/parent/LinkStudentForm.tsx`

- [ ] **Step 1: Replace the file contents**

The current success handler sets a static message and tells the user to reload manually. Replace the entire file with:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function LinkStudentForm({ hasChildren }: { hasChildren: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch('/api/link-child', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childEmail: email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setMessage(data.error ?? 'Failed to link student.')
      } else {
        // Refresh the server component so the new child card appears immediately
        router.refresh()
      }
    } catch {
      setStatus('error')
      setMessage('Network error. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {status === 'error' && (
        <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{message}</p>
      )}
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Child's email address"
          required
          className="flex-1 px-4 py-2.5 bg-surface-raised border border-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-primary placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
        >
          {status === 'loading' ? 'Linking...' : hasChildren ? 'Link Another' : 'Link Student'}
        </button>
      </div>
    </form>
  )
}
```

Key changes from original:
- Adds `useRouter` and calls `router.refresh()` on success (re-runs the server component, no manual reload)
- Removes `'success'` state entirely — the refresh replaces it
- Accepts `hasChildren: boolean` prop to change button label

- [ ] **Step 2: Commit**

```bash
git add components/parent/LinkStudentForm.tsx
git commit -m "fix: LinkStudentForm calls router.refresh() on success instead of static message"
```

---

## Task 3: Dashboard — multi-child support

**Files:**
- Modify: `app/parent/dashboard/page.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getTSSBand } from '@/lib/test/scoring'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LinkStudentForm } from '@/components/parent/LinkStudentForm'

type ChildRow = {
  id: string
  users: { full_name: string }
}

export default async function ParentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: children } = await supabase
    .from('student_profiles')
    .select('id, users!inner(full_name)')
    .eq('parent_id', user.id)

  const childList = (children ?? []) as unknown as ChildRow[]

  // Fetch latest full-test TSS for each child in one query
  const childIds = childList.map(c => c.id)
  const { data: sessions } = childIds.length > 0
    ? await supabase
        .from('test_sessions')
        .select('student_id, projected_tss')
        .in('student_id', childIds)
        .eq('mode', 'full')
        .not('projected_tss', 'is', null)
        .order('started_at', { ascending: false })
    : { data: [] }

  // Latest TSS per child
  const latestTss: Record<string, number> = {}
  for (const s of sessions ?? []) {
    if (!latestTss[s.student_id]) latestTss[s.student_id] = s.projected_tss
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text-primary">Parent Dashboard</h1>

      {childList.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4">
          <div>
            <p className="text-text-primary font-medium mb-1">No student linked yet</p>
            <p className="text-sm text-muted">Enter your child's email address to link their account.</p>
          </div>
          <LinkStudentForm hasChildren={false} />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {childList.map(child => {
              const tss = latestTss[child.id]
              const band = tss ? getTSSBand(tss) : null
              return (
                <div key={child.id} className="bg-surface border border-border rounded-2xl p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-text-primary">{child.users.full_name}</p>
                    {tss ? (
                      <p className="text-sm text-muted mt-0.5">
                        TSS <span className="text-accent font-bold tabular-nums">{Math.round(tss)}</span>
                        {band && <span className="ml-2 text-primary">{band}</span>}
                      </p>
                    ) : (
                      <p className="text-sm text-muted mt-0.5">No tests completed yet</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link
                      href={`/parent/history?child=${child.id}`}
                      className="px-3 py-1.5 bg-surface-raised border border-border rounded-lg text-xs font-medium text-text-primary hover:bg-surface transition-colors"
                    >
                      History
                    </Link>
                    <Link
                      href={`/parent/reports?child=${child.id}`}
                      className="px-3 py-1.5 bg-primary/20 text-primary rounded-lg text-xs font-medium hover:bg-primary/30 transition-colors"
                    >
                      Reports
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
            <p className="text-sm font-medium text-text-primary">Link another child</p>
            <LinkStudentForm hasChildren={true} />
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/parent/dashboard/page.tsx
git commit -m "feat: parent dashboard supports multiple children with child card list"
```

---

## Task 4: History page — multi-child + fix View link

**Files:**
- Modify: `app/parent/history/page.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const PAGE_SIZE = 10

export default async function ParentHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; child?: string }>
}) {
  const { page: pageParam, child: childParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch all linked children
  const { data: children } = await supabase
    .from('student_profiles')
    .select('id, users!inner(full_name)')
    .eq('parent_id', user.id)

  type ChildRow = { id: string; users: { full_name: string } }
  const childList = (children ?? []) as unknown as ChildRow[]

  if (childList.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-text-primary mb-4">Test History</h1>
        <div className="p-4 bg-surface border border-border rounded-xl text-muted">
          No student linked yet. Link a student from the dashboard.
        </div>
      </div>
    )
  }

  // Filter to a specific child if ?child= param provided, otherwise show all
  const targetIds = childParam
    ? childList.filter(c => c.id === childParam).map(c => c.id)
    : childList.map(c => c.id)

  const nameById: Record<string, string> = {}
  for (const c of childList) nameById[c.id] = c.users.full_name

  const { data: sessions, count } = await supabase
    .from('test_sessions')
    .select('*', { count: 'exact' })
    .in('student_id', targetIds)
    .not('completed_at', 'is', null)
    .order('started_at', { ascending: false })
    .range(from, to)

  const total = count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Test History</h1>
        <p className="text-sm text-muted">
          {total === 0 ? 'No tests yet' : `Showing ${from + 1}–${Math.min(to + 1, total)} of ${total}`}
        </p>
      </div>

      {(!sessions || sessions.length === 0) && (
        <div className="text-center py-16 text-muted">No completed tests found.</div>
      )}

      <div className="flex flex-col gap-3">
        {sessions?.map(s => {
          const testType = (s.test_type as string).toUpperCase()
          const mode = (s.mode as string).toUpperCase()
          const childName = nameById[s.student_id]
          return (
            <div key={s.id} className="bg-surface border border-border rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex gap-2 shrink-0 flex-wrap">
                  <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-semibold rounded-full">{testType}</span>
                  <span className="px-2 py-0.5 bg-surface-raised text-muted text-xs font-medium rounded-full">{mode}</span>
                  {childList.length > 1 && childName && (
                    <span className="px-2 py-0.5 bg-accent/10 text-accent text-xs font-medium rounded-full">{childName}</span>
                  )}
                </div>
                <p className="text-sm text-muted truncate">{new Date(s.started_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-5 shrink-0">
                <div className="text-right hidden sm:block">
                  {s.projected_tss && (
                    <p className="text-accent font-bold tabular-nums">TSS {Math.round(s.projected_tss)}</p>
                  )}
                  {s.total_score != null && (
                    <p className="text-xs text-muted">{s.total_score} correct</p>
                  )}
                </div>
                <Link
                  href={`/parent/test/${s.id}/report`}
                  className="px-4 py-2 bg-primary/20 text-primary hover:bg-primary/30 text-sm font-medium rounded-xl transition-colors"
                >
                  View →
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-8">
          <Link
            href={`?page=${page - 1}${childParam ? `&child=${childParam}` : ''}`}
            className={`px-4 py-2 border border-border rounded-xl text-sm font-medium transition-colors ${
              page <= 1 ? 'opacity-30 pointer-events-none text-muted' : 'text-text-primary hover:bg-surface-raised'
            }`}
          >
            ← Previous
          </Link>
          <span className="text-sm text-muted">Page {page} of {totalPages}</span>
          <Link
            href={`?page=${page + 1}${childParam ? `&child=${childParam}` : ''}`}
            className={`px-4 py-2 border border-border rounded-xl text-sm font-medium transition-colors ${
              page >= totalPages ? 'opacity-30 pointer-events-none text-muted' : 'text-text-primary hover:bg-surface-raised'
            }`}
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  )
}
```

Key changes:
- Queries all linked children (no `.single()`)
- Accepts `?child=` param to filter; omitting shows all children's sessions
- Shows child name badge per row when multiple children are linked
- "View →" now goes to `/parent/test/${s.id}/report` (not `/student/...`)
- Pagination preserves `?child=` param in Previous/Next links

- [ ] **Step 2: Commit**

```bash
git add app/parent/history/page.tsx
git commit -m "feat: history page supports multiple children and links to parent report"
```

---

## Task 5: New parent test report page

**Files:**
- Create: `app/parent/test/[id]/report/page.tsx`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p app/parent/test/\[id\]/report
```

- [ ] **Step 2: Write the file**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getTSSBand } from '@/lib/test/scoring'
import { TEST_CONFIG } from '@/lib/test/constants'
import Link from 'next/link'

export default async function ParentTestReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('test_sessions')
    .select('*')
    .eq('id', id)
    .single()

  if (!session) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <p className="text-muted">Test not found.</p>
        <Link href="/parent/history" className="text-primary text-sm mt-4 inline-block">← Back to History</Link>
      </div>
    )
  }

  const { data: wrongAnswers } = await supabase
    .from('test_answers')
    .select('question_bank!inner(topic, section)')
    .eq('session_id', id)
    .eq('is_correct', false)

  type WrongRow = { question_bank: { topic: string; section: string } }
  const wrong = (wrongAnswers ?? []) as unknown as WrongRow[]

  const scores = session.section_scores as Record<string, number> | null
  const tss = session.projected_tss as number | null
  const testType = session.test_type as keyof typeof TEST_CONFIG
  const sectionMaxMap = Object.fromEntries(
    (TEST_CONFIG[testType] ?? []).map(s => [s.key, s.questionCount])
  )
  const band = tss ? getTSSBand(tss) : null
  const bandColor = band === 'Top 5%' || band === 'Top 10%'
    ? 'text-success' : band === 'Top 15%' || band === 'Top 25%' ? 'text-primary' : 'text-muted'

  const totalCorrect = scores ? Object.values(scores).reduce((a, b) => a + b, 0) : 0
  const wrongCount = wrong.length

  // Group wrong topics by section
  const bySection: Record<string, string[]> = {}
  for (const w of wrong) {
    const sec = w.question_bank.section
    if (!bySection[sec]) bySection[sec] = []
    if (!bySection[sec].includes(w.question_bank.topic)) {
      bySection[sec].push(w.question_bank.topic)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-8">

        {/* Score card */}
        <div className="bg-surface rounded-3xl shadow-sm border border-border p-8 text-center">
          <p className="text-sm font-medium text-muted uppercase tracking-widest mb-2">Test Result</p>
          {tss ? (
            <>
              <div className="text-7xl font-black text-accent tabular-nums">{Math.round(tss)}</div>
              <div className="text-muted text-sm mt-1">Projected TSS / 400</div>
              <div className={`text-xl font-bold mt-3 ${bandColor}`}>{band}</div>
            </>
          ) : (
            <div className="text-2xl font-bold text-text-primary">Results ready</div>
          )}
          <div className="mt-4 flex justify-center gap-6 text-sm text-muted">
            <span><span className="font-semibold text-text-primary">{totalCorrect - wrongCount}</span> correct</span>
            <span><span className="font-semibold text-danger">{wrongCount}</span> to review</span>
          </div>
        </div>

        {/* Section breakdown */}
        {scores && (
          <div className="bg-surface rounded-2xl shadow-sm border border-border p-6">
            <h2 className="font-bold text-text-primary mb-4">Section Breakdown</h2>
            <div className="flex flex-col gap-3">
              {Object.entries(scores).map(([section, score]) => {
                const maxScore = sectionMaxMap[section] ?? 35
                const pct = Math.min((score / maxScore) * 100, 100)
                return (
                  <div key={section}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted capitalize">{section.replace(/_/g, ' ')}</span>
                      <span className="font-bold text-text-primary">{score} / {maxScore}</span>
                    </div>
                    <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-primary rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Topics to practise */}
        {Object.keys(bySection).length > 0 && (
          <div className="bg-surface rounded-2xl shadow-sm border border-border p-6">
            <h2 className="font-bold text-text-primary mb-1">Topics to Practise</h2>
            <p className="text-sm text-muted mb-4">{wrongCount} question{wrongCount !== 1 ? 's' : ''} answered incorrectly</p>
            <div className="flex flex-col gap-4">
              {Object.entries(bySection).map(([section, topics]) => (
                <div key={section}>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 capitalize">
                    {section.replace(/_/g, ' ')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {topics.map(topic => (
                      <span
                        key={topic}
                        className="px-3 py-1 bg-surface-raised border border-border rounded-full text-sm text-text-primary"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link
          href="/parent/history"
          className="text-center py-3.5 border border-border rounded-xl text-muted hover:bg-surface-raised font-medium transition-colors"
        >
          ← Back to History
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/parent/test/
git commit -m "feat: add read-only parent test report page at /parent/test/[id]/report"
```

---

## Task 6: Final push to Vercel

- [ ] **Step 1: Run full type check one more time**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 2: Push**

```bash
git push origin main
```

- [ ] **Step 3: Verify Vercel build passes**

Watch the Vercel dashboard or run:
```bash
npx vercel --token $VERCEL_TOKEN inspect --wait
```
Expected: deployment status = `Ready`.

---

## Self-Review

**Spec coverage:**
- Fix 1 (slots.length) → Task 1 ✓
- Fix 2 (LinkStudentForm refresh) → Task 2 ✓
- Fix 3 (dashboard multi-child) → Task 3 ✓
- Fix 4 (history multi-child + View link) → Task 4 ✓
- Fix 5 (parent report page) → Task 5 ✓

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:**
- `ChildRow` type defined inline in Tasks 3 and 4 (same shape: `{ id: string; users: { full_name: string } }`).
- `WrongRow` type defined in Task 5 matches the Supabase join shape.
- `LinkStudentForm` now accepts `hasChildren: boolean` — Task 2 adds the prop, Task 3 passes it correctly (`hasChildren={false}` and `hasChildren={true}`).
- `getTSSBand` imported from `@/lib/test/scoring` in Tasks 3 and 5 — already exported there.
- `TEST_CONFIG` imported from `@/lib/test/constants` in Task 5 — already exported there.
