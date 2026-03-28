# Parent Dashboard Overhaul — Design Spec
**Date:** 2026-03-28
**Status:** Approved

---

## Problem Summary

Five distinct bugs in the parent experience:

1. **Vercel build broken** — `slots.length` TS error in `app/api/test/assemble/route.ts` (DifficultySlots is an object, not an array).
2. **Dashboard shows "no child linked"** even after successful link — `LinkStudentForm` shows a static success message and asks the parent to manually reload.
3. **Only 1 child supported** — all queries use `.single()` which silently returns null with 0 or >1 rows.
4. **History "View" link sends parent to `/student/test/[id]/result`** — student layout redirects non-students back to `/parent/dashboard`, so parents never see any test detail.
5. **No parent-specific test report page** — no read-only view of a child's completed test exists.

---

## Changes

### Fix 1 — Vercel build (1 line)

**File:** `app/api/test/assemble/route.ts`

Replace `generatedWithIds.slice(0, slots.length)` with `generatedWithIds.slice(0, slots.easy + slots.medium + slots.hard)`.

`DifficultySlots` is `{ easy: number; medium: number; hard: number }` — it has no `.length` property.

---

### Fix 2 — Dashboard multi-child support

**File:** `app/parent/dashboard/page.tsx`

- Change query from `.single()` to plain array query (no `.single()`).
- Render a list of child cards. Each card shows:
  - Child's full name
  - Latest projected TSS + band (if any full test completed)
  - "View History" → `/parent/history?child={id}` and "View Reports" → `/parent/reports?child={id}`
- `LinkStudentForm` sits below the list, always visible, labelled "Link another child" when at least one child is already linked.
- If no children linked yet, show the existing "No student linked yet" state.

---

### Fix 3 — LinkStudentForm auto-refresh

**File:** `components/parent/LinkStudentForm.tsx`

On successful link response, call `router.refresh()` (Next.js App Router) instead of displaying a static "Reload the page" message. This re-runs the server component, picks up the newly linked child, and shows the child card immediately.

---

### Fix 4 — History page: multi-child + correct link

**File:** `app/parent/history/page.tsx`

- Accept optional `?child={id}` query param. If omitted, query sessions for ALL linked children.
- Each session row gains a child name badge so the parent can tell whose test it is when multiple children are linked.
- Change the "View →" link from `/student/test/${s.id}/result` to `/parent/test/${s.id}/report`.

---

### Fix 5 — New parent test report page

**New file:** `app/parent/test/[id]/report/page.tsx`

This page sits under the `/parent` layout (parent nav, parent auth guard). It shows a read-only summary of one completed test.

**Sections (top to bottom):**

1. **Score card** — TSS, band label, correct count, wrong count. Identical styling to the student result hero card.
2. **Section breakdown** — progress bar per section with score / max. Identical styling to the student result section breakdown.
3. **Topics to practise** — grouped by section. Each entry shows topic name + section badge. No links, no tutoring entry points. Only shown if there are wrong answers.
4. **Back to History** — link to `/parent/history`.

**Data fetching:**
- Load `test_sessions` by session ID — RLS parent-read policy already permits this.
- Load `test_answers` joined with `question_bank` for wrong answers — RLS parent-read policy already permits this.
- No writes. No tutoring API calls.

**Auth:** The page is under `app/parent/` so the parent layout enforces `role === 'parent'`. No student-layout redirect issue.

---

## Files Changed / Created

| File | Change |
|------|--------|
| `app/api/test/assemble/route.ts` | Fix `slots.length` TS error |
| `app/parent/dashboard/page.tsx` | Multi-child query + child card list |
| `components/parent/LinkStudentForm.tsx` | `router.refresh()` on success |
| `app/parent/history/page.tsx` | Multi-child sessions + fixed "View" link |
| `app/parent/test/[id]/report/page.tsx` | New — read-only parent test report |

---

## Out of Scope

- Writing response display in parent report (deferred — parent sees topic-level gaps only).
- Parent-facing tutor or re-attempt flows.
- Child selector UI beyond `?child=` query param (tabs/dropdown can be added later if needed).
