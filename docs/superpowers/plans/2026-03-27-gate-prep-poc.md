# WA GATE & Scholarship Prep PoC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack Next.js web app where WA Year 6 students take randomised mock GATE/scholarship tests, receive personalised AI tutoring on wrong answers, and parents view progress reports with projected scores.

**Architecture:** Single Next.js 14 (App Router) codebase with API routes for all server-side logic. Supabase handles auth and Postgres with RLS. Claude API (claude-sonnet-4-6) powers question generation, writing scoring, and personalised tutoring. Deployed to Vercel.

**Tech Stack:** Next.js 14, TypeScript, Supabase (auth + Postgres), Anthropic SDK, Tailwind CSS, Vitest (unit tests)

---

## File Structure

```
app/
  layout.tsx                     # Root layout with Supabase session provider
  page.tsx                       # Landing — login selector (student / parent)
  auth/login/page.tsx            # Shared login form
  auth/signup/page.tsx           # Signup — role select + parent links child by email
  student/
    layout.tsx                   # Auth guard — redirect if not student
    dashboard/page.tsx           # Recent tests, progress summary
    test/select/page.tsx         # Choose test type + mode
    test/[id]/page.tsx           # Live test session (MCQ + writing, section timer)
    test/[id]/result/page.tsx    # Score breakdown, trigger tutoring
    tutor/[id]/page.tsx          # MCQ tutoring for one wrong answer
    history/page.tsx             # All past sessions
    progress/page.tsx            # Charts + knowledge gap map
  parent/
    layout.tsx                   # Auth guard — redirect if not parent
    dashboard/page.tsx           # Child overview, projected TSS
    reports/page.tsx             # Knowledge gaps, improvement suggestions
    history/page.tsx             # Child's test history
  api/
    test/assemble/route.ts       # POST — build question set for a new session
    test/answer/route.ts         # POST — save a single answer in real-time
    test/complete/route.ts       # POST — finalise session, compute scores + TSS
    questions/generate/route.ts  # POST — generate + cache MCQ questions via Claude
    writing/score/route.ts       # POST — score a writing response via Claude
    tutor/mcq/route.ts           # POST — get personalised MCQ explanation + follow-up
    tutor/mcq-attempt/route.ts   # POST — evaluate follow-up attempt, update mastery
    tutor/writing/route.ts       # POST — get writing criterion feedback + follow-up prompt
    tutor/writing-attempt/route.ts # POST — re-score writing re-submission
    reports/suggestions/route.ts # POST — generate improvement suggestions via Claude

lib/
  supabase/
    client.ts                    # createBrowserClient
    server.ts                    # createServerClient (for API routes + server components)
  claude/
    client.ts                    # Anthropic singleton
    generate-questions.ts        # MCQ generation prompt + parser
    generate-writing-prompt.ts   # Writing prompt generation
    score-writing.ts             # Writing scoring prompt + parser
    tutor-mcq.ts                 # MCQ tutoring prompt + parser
    tutor-writing.ts             # Writing tutoring prompt + parser
    suggestions.ts               # Improvement suggestions prompt
  test/
    constants.ts                 # TEST_CONFIG — sections, counts, timings, difficulty bands
    assemble.ts                  # Question assembly + anti-repeat logic
    scoring.ts                   # Score calculation + TSS heuristic
  types.ts                       # Shared TypeScript types (mirrors DB schema)

components/
  test/
    McqQuestion.tsx              # Single MCQ card with A/B/C/D options
    WritingPrompt.tsx            # Writing textarea + word count
    SectionTimer.tsx             # Countdown timer per section
  tutor/
    McqExplanation.tsx           # Explanation + follow-up question UI
    WritingFeedback.tsx          # Writing criterion feedback + re-submission
  reports/
    ScoreSummary.tsx             # Headline stats (score, percentile, progress)
    SectionBreakdown.tsx         # Progress bars per section
    KnowledgeGapMap.tsx          # Colour-coded topic grid
    ImprovementSuggestions.tsx   # AI-generated suggestions list

supabase/
  migrations/001_initial_schema.sql
middleware.ts                    # Protect /student and /parent routes
```

---

## Task 1: Project Scaffold + Dependencies

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `.env.local.example`
- Create: `middleware.ts`

- [ ] **Step 1: Scaffold Next.js project**

```bash
npx create-next-app@14 . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Create `.env.local.example`**

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

Copy to `.env.local` and fill in real values.

- [ ] **Step 4: Add vitest config — create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 5: Create `vitest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Add test script to `package.json`**

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Supabase + Anthropic deps"
```

---

## Task 2: Supabase Schema Migration

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create Supabase project**

Go to supabase.com → new project. Copy URL and anon key into `.env.local`.

- [ ] **Step 2: Write migration — create `supabase/migrations/001_initial_schema.sql`**

```sql
-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Users (extends auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'parent')),
  full_name text not null,
  created_at timestamptz default now()
);
alter table public.users enable row level security;
create policy "users: own row" on public.users
  for all using (auth.uid() = id);

-- Student profiles
create table public.student_profiles (
  id uuid primary key references public.users(id) on delete cascade,
  parent_id uuid references public.users(id),
  year_level int default 6,
  school text,
  target_schools text[]
);
alter table public.student_profiles enable row level security;
create policy "student_profiles: student own" on public.student_profiles
  for all using (auth.uid() = id);
create policy "student_profiles: parent read" on public.student_profiles
  for select using (
    auth.uid() = parent_id
  );

-- Question bank
create table public.question_bank (
  id uuid primary key default gen_random_uuid(),
  test_type text not null check (test_type in ('gate', 'scholarship')),
  section text not null,
  topic text not null,
  difficulty int not null check (difficulty between 1 and 5),
  question_text text not null,
  options jsonb not null,
  correct_answer text not null,
  explanation text not null,
  generated_at timestamptz default now()
);
alter table public.question_bank enable row level security;
create policy "question_bank: authenticated read" on public.question_bank
  for select using (auth.role() = 'authenticated');

-- Test sessions
create table public.test_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id),
  test_type text not null check (test_type in ('gate', 'scholarship')),
  mode text not null check (mode in ('full', 'practice')),
  started_at timestamptz default now(),
  completed_at timestamptz,
  total_score int,
  section_scores jsonb,
  projected_tss float
);
alter table public.test_sessions enable row level security;
create policy "test_sessions: student own" on public.test_sessions
  for all using (auth.uid() = student_id);
create policy "test_sessions: parent read" on public.test_sessions
  for select using (
    exists (
      select 1 from public.student_profiles sp
      where sp.id = student_id and sp.parent_id = auth.uid()
    )
  );

-- Test answers
create table public.test_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.test_sessions(id) on delete cascade,
  question_id uuid not null references public.question_bank(id),
  selected_answer text,
  is_correct bool,
  time_taken_secs int
);
alter table public.test_answers enable row level security;
create policy "test_answers: student via session" on public.test_answers
  for all using (
    exists (
      select 1 from public.test_sessions ts
      where ts.id = session_id and ts.student_id = auth.uid()
    )
  );
create policy "test_answers: parent read" on public.test_answers
  for select using (
    exists (
      select 1 from public.test_sessions ts
      join public.student_profiles sp on sp.id = ts.student_id
      where ts.id = session_id and sp.parent_id = auth.uid()
    )
  );

-- Writing responses
create table public.writing_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.test_sessions(id) on delete cascade,
  prompt text not null,
  response_text text not null,
  scores jsonb,
  ai_feedback text,
  follow_up_prompt text
);
alter table public.writing_responses enable row level security;
create policy "writing_responses: student via session" on public.writing_responses
  for all using (
    exists (
      select 1 from public.test_sessions ts
      where ts.id = session_id and ts.student_id = auth.uid()
    )
  );
create policy "writing_responses: parent read" on public.writing_responses
  for select using (
    exists (
      select 1 from public.test_sessions ts
      join public.student_profiles sp on sp.id = ts.student_id
      where ts.id = session_id and sp.parent_id = auth.uid()
    )
  );

-- Writing tutoring sessions
create table public.writing_tutoring_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.test_sessions(id),
  writing_response_id uuid not null references public.writing_responses(id),
  student_id uuid not null references public.users(id),
  criterion text not null,
  follow_up_prompt text,
  resubmission_text text,
  updated_scores jsonb,
  improved bool,
  created_at timestamptz default now()
);
alter table public.writing_tutoring_sessions enable row level security;
create policy "writing_tutoring: student own" on public.writing_tutoring_sessions
  for all using (auth.uid() = student_id);
create policy "writing_tutoring: parent read" on public.writing_tutoring_sessions
  for select using (
    exists (
      select 1 from public.student_profiles sp
      where sp.id = student_id and sp.parent_id = auth.uid()
    )
  );

-- Unique constraint required for upsert in /api/test/answer
create unique index on public.test_answers(session_id, question_id);

-- Tutoring sessions (MCQ)
create table public.tutoring_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.test_sessions(id),
  student_id uuid not null references public.users(id),
  question_id uuid not null references public.question_bank(id),
  wrong_answer text not null,
  ai_explanation text,
  followup_question jsonb,
  mastered bool default false,
  attempts int default 0
);
alter table public.tutoring_sessions enable row level security;
create policy "tutoring_sessions: student own" on public.tutoring_sessions
  for all using (auth.uid() = student_id);
create policy "tutoring_sessions: parent read" on public.tutoring_sessions
  for select using (
    exists (
      select 1 from public.student_profiles sp
      where sp.id = student_id and sp.parent_id = auth.uid()
    )
  );
```

- [ ] **Step 3: Apply migration via Supabase dashboard**

Go to Supabase Dashboard → SQL Editor → paste migration → Run.

- [ ] **Step 4: Verify tables exist**

In Supabase Dashboard → Table Editor, confirm all 7 tables are present.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add initial database schema migration"
```

---

## Task 3: Supabase Clients + Shared Types

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/types.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Create `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create `lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create `lib/types.ts`**

```typescript
export type UserRole = 'student' | 'parent'
export type TestType = 'gate' | 'scholarship'
export type TestMode = 'full' | 'practice'

export interface User {
  id: string
  role: UserRole
  full_name: string
  created_at: string
}

export interface StudentProfile {
  id: string
  parent_id: string | null
  year_level: number
  school: string | null
  target_schools: string[] | null
}

export interface Question {
  id: string
  test_type: TestType
  section: string
  topic: string
  difficulty: number
  question_text: string
  options: { A: string; B: string; C: string; D: string }
  correct_answer: string
  explanation: string
}

export interface TestSession {
  id: string
  student_id: string
  test_type: TestType
  mode: TestMode
  started_at: string
  completed_at: string | null
  total_score: number | null
  section_scores: Record<string, number> | null
  projected_tss: number | null
}

export interface TestAnswer {
  id: string
  session_id: string
  question_id: string
  selected_answer: string | null
  is_correct: boolean | null
  time_taken_secs: number | null
}

export interface WritingResponse {
  id: string
  session_id: string
  prompt: string
  response_text: string
  scores: WritingScores | null
  ai_feedback: string | null
  follow_up_prompt: string | null
}

export interface WritingScores {
  ideas: number
  structure: number
  vocabulary: number
  grammar: number
  spelling: number
}

export interface TutoringSession {
  id: string
  session_id: string
  student_id: string
  question_id: string
  wrong_answer: string
  ai_explanation: string | null
  followup_question: Omit<Question, 'id' | 'generated_at'> | null
  mastered: boolean
  attempts: number
}

export interface WritingCriterion {
  criterion: keyof WritingScores
  label: string
}

export const WRITING_CRITERIA: WritingCriterion[] = [
  { criterion: 'ideas', label: 'Ideas & Content' },
  { criterion: 'structure', label: 'Structure & Organisation' },
  { criterion: 'vocabulary', label: 'Vocabulary' },
  { criterion: 'grammar', label: 'Grammar & Punctuation' },
  { criterion: 'spelling', label: 'Spelling' },
]
```

- [ ] **Step 4: Create `middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  if (!user && (path.startsWith('/student') || path.startsWith('/parent'))) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/student/:path*', '/parent/:path*'],
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/ middleware.ts
git commit -m "feat: add Supabase clients, shared types, and auth middleware"
```

---

## Task 4: Auth Pages (Login + Signup)

**Files:**
- Create: `app/auth/login/page.tsx`
- Create: `app/auth/signup/page.tsx`
- Create: `app/page.tsx`

- [ ] **Step 1: Create landing page `app/page.tsx`**

```tsx
import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">WA GATE & Scholarship Prep</h1>
      <p className="text-gray-600 text-center max-w-md">
        Personalised mock tests and AI tutoring for WA Year 6 students.
      </p>
      <div className="flex gap-4">
        <Link href="/auth/login" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
          Log In
        </Link>
        <Link href="/auth/signup" className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50">
          Sign Up
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Create `app/auth/login/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }

    // Determine role and redirect
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
    router.push(profile?.role === 'parent' ? '/parent/dashboard' : '/student/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <form onSubmit={handleLogin} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Log In</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          className="border rounded-lg p-3" required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
          className="border rounded-lg p-3" required />
        <button type="submit" disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50">
          {loading ? 'Logging in...' : 'Log In'}
        </button>
        <a href="/auth/signup" className="text-sm text-center text-blue-600">No account? Sign up</a>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Create `app/auth/signup/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/types'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [role, setRole] = useState<UserRole>('student')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [childEmail, setChildEmail] = useState('') // parent only
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signupError } = await supabase.auth.signUp({ email, password })
    if (signupError || !data.user) { setError(signupError?.message ?? 'Signup failed'); setLoading(false); return }

    // Insert into public.users
    const { error: insertError } = await supabase.from('users').insert({
      id: data.user.id,
      role,
      full_name: fullName,
    })
    if (insertError) { setError(insertError.message); setLoading(false); return }

    if (role === 'student') {
      await supabase.from('student_profiles').insert({ id: data.user.id })
    }

    if (role === 'parent' && childEmail) {
      // Find child by email via auth (look up in users table via a helper)
      // For PoC: link child after they sign up — store child email for later linking
      // Redirect to dashboard, parent can link child from there
    }

    router.push(role === 'parent' ? '/parent/dashboard' : '/student/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <form onSubmit={handleSignup} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Create Account</h1>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2">
          {(['student', 'parent'] as UserRole[]).map(r => (
            <button key={r} type="button" onClick={() => setRole(r)}
              className={`flex-1 py-2 rounded-lg border font-medium capitalize ${role === r ? 'bg-blue-600 text-white border-blue-600' : ''}`}>
              {r}
            </button>
          ))}
        </div>
        <input placeholder="Full name" value={fullName} onChange={e => setFullName(e.target.value)}
          className="border rounded-lg p-3" required />
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          className="border rounded-lg p-3" required />
        <input type="password" placeholder="Password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)}
          className="border rounded-lg p-3" required minLength={6} />
        {role === 'parent' && (
          <input placeholder="Child's email (to link accounts)" value={childEmail} onChange={e => setChildEmail(e.target.value)}
            className="border rounded-lg p-3" />
        )}
        <button type="submit" disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50">
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/
git commit -m "feat: add landing, login, and signup pages"
```

---

## Task 5: Parent-Child Linking API

**Files:**
- Create: `app/api/link-child/route.ts`
- Modify: `app/auth/signup/page.tsx` (wire up child email after signup)

- [ ] **Step 1: Create `app/api/link-child/route.ts`**

```typescript
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

  // Find child's auth user by email via Supabase admin (service role)
  // For PoC: use a public lookup via users table joined with auth —
  // instead, look up by matching auth.users email exposed through a DB function.
  // Simplest PoC approach: student sets their own parent_id via a claim code.
  // Here we use a direct email lookup via the users table (email stored in auth.users,
  // accessible via a Postgres function with SECURITY DEFINER).

  // Call an RPC function that looks up user ID by email safely:
  const { data: childUser, error } = await supabase
    .rpc('get_user_id_by_email', { email: childEmail })

  if (error || !childUser) {
    return NextResponse.json({ error: 'No student account found with that email' }, { status: 404 })
  }

  // Confirm child is a student role
  const { data: childProfile } = await supabase
    .from('users').select('role').eq('id', childUser).single()
  if (childProfile?.role !== 'student') {
    return NextResponse.json({ error: 'That account is not a student' }, { status: 400 })
  }

  // Set parent_id on student_profiles
  const { error: updateError } = await supabase
    .from('student_profiles')
    .update({ parent_id: user.id })
    .eq('id', childUser)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Add the `get_user_id_by_email` Postgres function in Supabase**

In Supabase Dashboard → SQL Editor, run:

```sql
create or replace function public.get_user_id_by_email(email text)
returns uuid
language sql
security definer
as $$
  select id from auth.users where auth.users.email = $1 limit 1;
$$;
```

This uses `SECURITY DEFINER` so it can read `auth.users` without exposing the full table.

- [ ] **Step 3: Wire child email in signup page**

In `app/auth/signup/page.tsx`, replace the `// For PoC: link child after...` comment block with:

```typescript
if (role === 'parent' && childEmail) {
  await fetch('/api/link-child', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ childEmail }),
  })
  // Linking may fail if child hasn't signed up yet — parent can retry from dashboard
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/link-child/ app/auth/signup/page.tsx
git commit -m "feat: add parent-child account linking API"
```

---

## Task 6: Test Constants + Scoring Logic

**Files:**
- Create: `lib/test/constants.ts`
- Create: `lib/test/scoring.ts`
- Create: `lib/test/scoring.test.ts`

- [ ] **Step 1: Create `lib/test/constants.ts`**

```typescript
import type { TestType } from '@/lib/types'

export interface SectionConfig {
  key: string
  label: string
  type: 'mcq' | 'writing'
  questionCount: number
  timeLimitSecs: number
}

export const TEST_CONFIG: Record<TestType, SectionConfig[]> = {
  gate: [
    { key: 'reading_comprehension', label: 'Reading Comprehension', type: 'mcq', questionCount: 35, timeLimitSecs: 35 * 60 },
    { key: 'writing', label: 'Communicating Ideas in Writing', type: 'writing', questionCount: 1, timeLimitSecs: 25 * 60 },
    { key: 'quantitative_reasoning', label: 'Quantitative Reasoning', type: 'mcq', questionCount: 35, timeLimitSecs: 35 * 60 },
    { key: 'abstract_reasoning', label: 'Abstract Reasoning', type: 'mcq', questionCount: 35, timeLimitSecs: 20 * 60 },
  ],
  scholarship: [
    { key: 'english', label: 'English (Reading + Language)', type: 'mcq', questionCount: 30, timeLimitSecs: 30 * 60 },
    { key: 'writing', label: 'Written Expression', type: 'writing', questionCount: 1, timeLimitSecs: 20 * 60 },
    { key: 'mathematics', label: 'Mathematics', type: 'mcq', questionCount: 30, timeLimitSecs: 30 * 60 },
    { key: 'general_ability', label: 'General Ability / Reasoning', type: 'mcq', questionCount: 30, timeLimitSecs: 20 * 60 },
  ],
}

// Difficulty distribution per MCQ section
export const DIFFICULTY_DIST = { easy: 0.30, medium: 0.50, hard: 0.20 }

// Difficulty int mapping
export const DIFFICULTY_RANGE = {
  easy: [1, 2] as [number, number],
  medium: [3, 4] as [number, number],
  hard: [5, 5] as [number, number],
}

// Approximate TSS percentile bands (heuristic for PoC)
export const TSS_BANDS = [
  { minTss: 360, label: 'Top 5%' },
  { minTss: 340, label: 'Top 10%' },
  { minTss: 320, label: 'Top 15%' },
  { minTss: 300, label: 'Top 25%' },
  { minTss: 280, label: 'Top 35%' },
  { minTss: 0, label: 'Below Top 35%' },
]
```

- [ ] **Step 2: Write failing tests for scoring — create `lib/test/scoring.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { computeSectionScores, computeTSS, getTSSBand } from './scoring'

describe('computeSectionScores', () => {
  it('counts correct answers per section', () => {
    const answers = [
      { section: 'reading_comprehension', is_correct: true },
      { section: 'reading_comprehension', is_correct: false },
      { section: 'quantitative_reasoning', is_correct: true },
    ]
    const result = computeSectionScores(answers as any)
    expect(result.reading_comprehension).toBe(1)
    expect(result.quantitative_reasoning).toBe(1)
  })
})

describe('computeTSS', () => {
  it('returns 400 for perfect scores', () => {
    const sectionScores = {
      reading_comprehension: 35,
      quantitative_reasoning: 35,
      abstract_reasoning: 35,
      writing_total: 25,
    }
    expect(computeTSS(sectionScores, 'gate')).toBe(400)
  })

  it('normalises writing_total from 0-25 to 0-35 range', () => {
    const sectionScores = {
      reading_comprehension: 0,
      quantitative_reasoning: 0,
      abstract_reasoning: 0,
      writing_total: 25, // perfect writing
    }
    // writing normalised = 25/25 * 35 = 35, other sections 0 → TSS = (35/35) * 100 = 25% → 100
    const tss = computeTSS(sectionScores, 'gate')
    expect(tss).toBe(100)
  })
})

describe('getTSSBand', () => {
  it('returns correct band for TSS score', () => {
    expect(getTSSBand(350)).toBe('Top 10%')
    expect(getTSSBand(295)).toBe('Top 35%')
    expect(getTSSBand(270)).toBe('Below Top 35%')
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npm test
```
Expected: FAIL — `computeSectionScores`, `computeTSS`, `getTSSBand` not defined.

- [ ] **Step 4: Implement `lib/test/scoring.ts`**

```typescript
import type { TestType } from '@/lib/types'
import type { WritingScores } from '@/lib/types'
import { TEST_CONFIG, TSS_BANDS } from './constants'

interface AnswerWithSection {
  section: string
  is_correct: boolean
}

export function computeSectionScores(
  answers: AnswerWithSection[]
): Record<string, number> {
  return answers.reduce((acc, a) => {
    if (a.is_correct) acc[a.section] = (acc[a.section] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
}

export function computeTSS(
  sectionScores: Record<string, number>,
  testType: TestType
): number {
  const sections = TEST_CONFIG[testType].filter(s => s.type === 'mcq')
  const maxMcq = 35 // each MCQ section max

  // Normalise writing (0–25) → (0–35)
  const writingRaw = sectionScores['writing_total'] ?? 0
  const writingNorm = (writingRaw / 25) * 35

  const allNorm = [
    ...sections.map(s => ({
      score: sectionScores[s.key] ?? 0,
      max: s.questionCount,
    })),
    { score: writingNorm, max: 35 },
  ]

  const totalPercent = allNorm.reduce((sum, s) => sum + s.score / s.max, 0) / allNorm.length
  return Math.round(totalPercent * 400)
}

export function getTSSBand(tss: number): string {
  return TSS_BANDS.find(b => tss >= b.minTss)?.label ?? 'Below Top 35%'
}

export function computeWritingTotal(scores: WritingScores): number {
  return Object.values(scores).reduce((sum, v) => sum + v, 0)
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test
```
Expected: PASS — all 4 tests green.

- [ ] **Step 6: Commit**

```bash
git add lib/test/
git commit -m "feat: add test constants, scoring logic, and TSS calculation"
```

---

## Task 7: Question Assembly Logic

**Files:**
- Create: `lib/test/assemble.ts`
- Create: `lib/test/assemble.test.ts`

- [ ] **Step 1: Write failing tests — create `lib/test/assemble.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { buildDifficultySlots, shuffleArray } from './assemble'

describe('buildDifficultySlots', () => {
  it('returns correct easy/medium/hard counts for 35 questions', () => {
    const slots = buildDifficultySlots(35)
    expect(slots.easy).toBe(10)   // floor(35 * 0.30) = 10
    expect(slots.medium).toBe(18) // remainder: 35 - 10 - 7 = 18
    expect(slots.hard).toBe(7)    // floor(35 * 0.20) = 7
    expect(slots.easy + slots.medium + slots.hard).toBe(35)
  })

  it('returns correct counts for 30 questions', () => {
    const slots = buildDifficultySlots(30)
    expect(slots.easy + slots.medium + slots.hard).toBe(30)
  })
})

describe('shuffleArray', () => {
  it('returns array of same length', () => {
    const arr = [1, 2, 3, 4, 5]
    expect(shuffleArray(arr)).toHaveLength(5)
  })

  it('contains same elements', () => {
    const arr = [1, 2, 3, 4, 5]
    expect(shuffleArray(arr).sort()).toEqual([1, 2, 3, 4, 5])
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test
```

- [ ] **Step 3: Implement `lib/test/assemble.ts`**

```typescript
import { DIFFICULTY_DIST } from './constants'

export interface DifficultySlots {
  easy: number
  medium: number
  hard: number
}

export function buildDifficultySlots(total: number): DifficultySlots {
  const easy = Math.floor(total * DIFFICULTY_DIST.easy)
  const hard = Math.floor(total * DIFFICULTY_DIST.hard)
  const medium = total - easy - hard
  return { easy, medium, hard }
}

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Given the full question bank and a set of already-seen question IDs,
 * returns a selection of unseen questions matching the required difficulty distribution.
 * Returns null if the bank doesn't have enough unseen questions (caller should generate more).
 */
export function selectQuestions(
  bank: Array<{ id: string; difficulty: number }>,
  seenIds: Set<string>,
  slots: DifficultySlots
): Array<{ id: string; difficulty: number }> | null {
  const unseen = bank.filter(q => !seenIds.has(q.id))

  const easyPool = unseen.filter(q => q.difficulty <= 2)
  const mediumPool = unseen.filter(q => q.difficulty >= 3 && q.difficulty <= 4)
  const hardPool = unseen.filter(q => q.difficulty === 5)

  if (easyPool.length < slots.easy || mediumPool.length < slots.medium || hardPool.length < slots.hard) {
    return null // insufficient — caller must generate more
  }

  return [
    ...shuffleArray(easyPool).slice(0, slots.easy),
    ...shuffleArray(mediumPool).slice(0, slots.medium),
    ...shuffleArray(hardPool).slice(0, slots.hard),
  ]
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add lib/test/assemble.ts lib/test/assemble.test.ts
git commit -m "feat: add question assembly and difficulty slot logic"
```

---

## Task 8: Claude Client + Question Generation

**Files:**
- Create: `lib/claude/client.ts`
- Create: `lib/claude/generate-questions.ts`
- Create: `lib/claude/generate-writing-prompt.ts`
- Create: `app/api/questions/generate/route.ts`

- [ ] **Step 1: Create `lib/claude/client.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

export function getClaudeClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return client
}
```

- [ ] **Step 2: Create `lib/claude/generate-questions.ts`**

```typescript
import { getClaudeClient } from './client'
import type { Question, TestType } from '@/lib/types'

interface GenerateQuestionsParams {
  testType: TestType
  section: string
  topic: string
  difficulty: number
  count: number
}

export async function generateQuestions(params: GenerateQuestionsParams): Promise<Omit<Question, 'id' | 'generated_at'>[]> {
  const { testType, section, topic, difficulty, count } = params
  const client = getClaudeClient()

  const diffLabel = difficulty <= 2 ? 'easy' : difficulty <= 4 ? 'medium' : 'hard'

  const prompt = `You are creating multiple-choice questions for Western Australia Year 6 students preparing for the ${testType === 'gate' ? 'GATE/ASET test' : 'Academic Scholarship test'}.

Generate exactly ${count} multiple-choice questions for the "${section}" section on the topic "${topic}" at ${diffLabel} difficulty (level ${difficulty}/5).

Requirements:
- Appropriate for Year 6 students (age 11-12)
- Clear, unambiguous wording
- Four options (A, B, C, D) with exactly one correct answer
- Brief explanation of why the correct answer is right

Return ONLY a valid JSON array, no other text:
[
  {
    "question_text": "...",
    "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
    "correct_answer": "A",
    "explanation": "..."
  }
]`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const parsed = JSON.parse(text)

  return parsed.map((q: any) => ({
    test_type: testType,
    section,
    topic,
    difficulty,
    question_text: q.question_text,
    options: q.options,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
  }))
}
```

- [ ] **Step 3: Create `lib/claude/generate-writing-prompt.ts`**

```typescript
import { getClaudeClient } from './client'
import type { TestType } from '@/lib/types'

export async function generateWritingPrompt(testType: TestType): Promise<string> {
  const client = getClaudeClient()
  const style = testType === 'gate' ? 'narrative or imaginative' : 'persuasive or expository'

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Create one ${style} writing prompt for a Western Australian Year 6 student preparing for the ${testType === 'gate' ? 'GATE/ASET' : 'scholarship'} test. The prompt should be engaging and age-appropriate. Return only the prompt text, nothing else.`,
    }],
  })

  return response.content[0].type === 'text' ? response.content[0].text.trim() : ''
}
```

- [ ] **Step 4: Create `app/api/questions/generate/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateQuestions } from '@/lib/claude/generate-questions'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { testType, section, topic, difficulty, count } = await request.json()

  try {
    const questions = await generateQuestions({ testType, section, topic, difficulty, count })
    const { data, error } = await supabase.from('question_bank').insert(questions).select()
    if (error) throw error
    return NextResponse.json({ questions: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/claude/ app/api/questions/
git commit -m "feat: add Claude client and question generation API"
```

---

## Task 9: Test Assembly + Session API

**Files:**
- Create: `app/api/test/assemble/route.ts`
- Create: `app/api/test/answer/route.ts`
- Create: `app/api/test/complete/route.ts`

- [ ] **Step 1: Create `app/api/test/assemble/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildDifficultySlots, selectQuestions, shuffleArray } from '@/lib/test/assemble'
import { TEST_CONFIG } from '@/lib/test/constants'
import { generateQuestions } from '@/lib/claude/generate-questions'
import { generateWritingPrompt } from '@/lib/claude/generate-writing-prompt'
import type { TestType, TestMode } from '@/lib/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { testType, mode, sectionKey } = await request.json() as {
    testType: TestType; mode: TestMode; sectionKey?: string
  }

  // Get all question IDs this student has already seen
  const { data: seenAnswers } = await supabase
    .from('test_answers')
    .select('question_id, test_sessions!inner(student_id)')
    .eq('test_sessions.student_id', user.id)
  const seenIds = new Set((seenAnswers ?? []).map((a: any) => a.question_id))

  const sections = mode === 'practice' && sectionKey
    ? TEST_CONFIG[testType].filter(s => s.key === sectionKey)
    : TEST_CONFIG[testType]

  // Create session
  const { data: session, error: sessionError } = await supabase
    .from('test_sessions')
    .insert({ student_id: user.id, test_type: testType, mode })
    .select()
    .single()
  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 })

  const assembledSections: Record<string, any[]> = {}
  const writingPrompts: Record<string, string> = {}

  for (const section of sections) {
    if (section.type === 'writing') {
      writingPrompts[section.key] = await generateWritingPrompt(testType)
      continue
    }

    const slots = buildDifficultySlots(section.questionCount)

    // Fetch bank for this section
    const { data: bank } = await supabase
      .from('question_bank')
      .select('id, difficulty')
      .eq('test_type', testType)
      .eq('section', section.key)

    let selected = selectQuestions(bank ?? [], seenIds, slots)

    if (!selected) {
      // Generate missing questions (batch of 10 per difficulty band for caching)
      for (const [band, [min, max]] of Object.entries({ easy: [1, 2], medium: [3, 4], hard: [5, 5] }) as any) {
        await generateQuestions({
          testType, section: section.key,
          topic: section.key.replace(/_/g, ' '),
          difficulty: min, count: 10,
        })
      }
      const { data: refreshedBank } = await supabase
        .from('question_bank').select('id, difficulty')
        .eq('test_type', testType).eq('section', section.key)
      selected = selectQuestions(refreshedBank ?? [], seenIds, slots) ?? []
    }

    assembledSections[section.key] = shuffleArray(selected)
  }

  // Fetch full question data for assembled sections
  const allIds = Object.values(assembledSections).flat().map((q: any) => q.id)
  const { data: questions } = await supabase
    .from('question_bank').select('*').in('id', allIds)

  return NextResponse.json({
    session,
    sections,
    questions: questions ?? [],
    writingPrompts,
  })
}
```

- [ ] **Step 2: Create `app/api/test/answer/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, questionId, selectedAnswer, isCorrect, timeTakenSecs } = await request.json()

  const { error } = await supabase.from('test_answers').upsert({
    session_id: sessionId,
    question_id: questionId,
    selected_answer: selectedAnswer,
    is_correct: isCorrect,
    time_taken_secs: timeTakenSecs,
  }, { onConflict: 'session_id,question_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create `app/api/test/complete/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeSectionScores, computeTSS, computeWritingTotal } from '@/lib/test/scoring'
import type { WritingScores } from '@/lib/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, writingResponse } = await request.json() as {
    sessionId: string
    writingResponse?: { prompt: string; responseText: string; scores: WritingScores; aiFeedback: string; followUpPrompt: string }
  }

  // Get session
  const { data: session } = await supabase
    .from('test_sessions').select('*').eq('id', sessionId).single()
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // Get all answers for this session with section info
  const { data: answers } = await supabase
    .from('test_answers')
    .select('*, question_bank!inner(section)')
    .eq('session_id', sessionId)

  const answersWithSection = (answers ?? []).map((a: any) => ({
    section: a.question_bank.section,
    is_correct: a.is_correct,
  }))

  const sectionScores = computeSectionScores(answersWithSection)
  const totalScore = Object.values(sectionScores).reduce((sum, v) => sum + v, 0)

  // Save writing response if present
  if (writingResponse) {
    await supabase.from('writing_responses').insert({
      session_id: sessionId,
      prompt: writingResponse.prompt,
      response_text: writingResponse.responseText,
      scores: writingResponse.scores,
      ai_feedback: writingResponse.aiFeedback,
      follow_up_prompt: writingResponse.followUpPrompt,
    })
    sectionScores['writing_total'] = computeWritingTotal(writingResponse.scores)
  }

  // Compute TSS for full mode only
  const projectedTss = session.mode === 'full'
    ? computeTSS(sectionScores, session.test_type)
    : null

  await supabase.from('test_sessions').update({
    completed_at: new Date().toISOString(),
    total_score: totalScore,
    section_scores: sectionScores,
    projected_tss: projectedTss,
  }).eq('id', sessionId)

  return NextResponse.json({ sectionScores, totalScore, projectedTss })
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/test/
git commit -m "feat: add test assembly, answer saving, and session completion APIs"
```

---

## Task 10: Writing Scoring API

**Files:**
- Create: `lib/claude/score-writing.ts`
- Create: `app/api/writing/score/route.ts`

- [ ] **Step 1: Create `lib/claude/score-writing.ts`**

```typescript
import { getClaudeClient } from './client'
import type { WritingScores, TestType } from '@/lib/types'

interface ScoreWritingResult {
  scores: WritingScores
  feedback: string
  followUpPrompt: string
  weakestCriterion: keyof WritingScores
}

export async function scoreWriting(params: {
  prompt: string
  responseText: string
  testType: TestType
}): Promise<ScoreWritingResult> {
  const client = getClaudeClient()

  const systemPrompt = `You are an experienced Australian primary school writing assessor marking Year 6 students preparing for the ${params.testType === 'gate' ? 'GATE/ASET' : 'scholarship'} test.`

  const userPrompt = `Writing prompt given to student:
"${params.prompt}"

Student's response:
"${params.responseText}"

Score this response on 5 criteria, each from 1 (very weak) to 5 (excellent):
1. Ideas & Content (relevance, depth, originality)
2. Structure & Organisation (intro, paragraphing, conclusion)
3. Vocabulary (word choice, variety, precision)
4. Grammar & Punctuation (sentence construction, punctuation)
5. Spelling (accuracy)

Then provide:
- Specific feedback (2-3 sentences) referencing the student's actual text
- A follow-up writing prompt targeting their weakest criterion

Return ONLY valid JSON, no other text:
{
  "scores": {
    "ideas": 1-5,
    "structure": 1-5,
    "vocabulary": 1-5,
    "grammar": 1-5,
    "spelling": 1-5
  },
  "feedback": "...",
  "follow_up_prompt": "..."
}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const parsed = JSON.parse(text)

  const scores: WritingScores = parsed.scores
  const weakestCriterion = (Object.entries(scores) as [keyof WritingScores, number][])
    .sort(([, a], [, b]) => a - b)[0][0]

  return {
    scores,
    feedback: parsed.feedback,
    followUpPrompt: parsed.follow_up_prompt,
    weakestCriterion,
  }
}
```

- [ ] **Step 2: Create `app/api/writing/score/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scoreWriting } from '@/lib/claude/score-writing'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prompt, responseText, testType } = await request.json()

  try {
    const result = await scoreWriting({ prompt, responseText, testType })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/claude/score-writing.ts app/api/writing/
git commit -m "feat: add writing scoring via Claude API"
```

---

## Task 11: MCQ Tutoring API

**Files:**
- Create: `lib/claude/tutor-mcq.ts`
- Create: `app/api/tutor/mcq/route.ts`
- Create: `app/api/tutor/mcq-attempt/route.ts`

- [ ] **Step 1: Create `lib/claude/tutor-mcq.ts`**

```typescript
import { getClaudeClient } from './client'
import type { Question } from '@/lib/types'

interface TutorMcqResult {
  explanation: string
  followupQuestion: Omit<Question, 'id' | 'generated_at'>
}

export async function tutorMcq(params: {
  question: Question
  wrongAnswer: string
  attemptNumber: number
}): Promise<TutorMcqResult> {
  const client = getClaudeClient()
  const { question, wrongAnswer, attemptNumber } = params

  const optionsList = Object.entries(question.options)
    .map(([k, v]) => `${k}: ${v}`).join('\n')

  const prompt = `You are a patient tutor helping a Year 6 student who got a ${question.section.replace(/_/g, ' ')} question wrong.

Question: "${question.question_text}"
Options:
${optionsList}
Correct answer: ${question.correct_answer}
Student chose: ${wrongAnswer}
This is attempt ${attemptNumber} (max 3).

${attemptNumber > 1 ? 'The student got the follow-up question wrong too. Try a different explanation approach.' : ''}

Provide:
1. A clear explanation of WHY "${wrongAnswer}" is wrong (reference what that option actually means)
2. WHY "${question.correct_answer}" is correct
3. A memory tip or strategy to avoid this mistake
4. A new follow-up question testing the same concept (different wording)

Return ONLY valid JSON:
{
  "explanation": "...",
  "followup_question": {
    "question_text": "...",
    "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
    "correct_answer": "A",
    "topic": "${question.topic}",
    "section": "${question.section}",
    "test_type": "${question.test_type}",
    "difficulty": ${question.difficulty},
    "explanation": "..."
  }
}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const parsed = JSON.parse(text)

  return {
    explanation: parsed.explanation,
    followupQuestion: parsed.followup_question,
  }
}
```

- [ ] **Step 2: Create `app/api/tutor/mcq/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tutorMcq } from '@/lib/claude/tutor-mcq'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, questionId, wrongAnswer } = await request.json()

  // Fetch question
  const { data: question } = await supabase
    .from('question_bank').select('*').eq('id', questionId).single()
  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

  // Create or get existing tutoring session
  const { data: existing } = await supabase
    .from('tutoring_sessions')
    .select('*').eq('session_id', sessionId).eq('question_id', questionId).single()

  const attempts = (existing?.attempts ?? 0) + 1

  const { explanation, followupQuestion } = await tutorMcq({ question, wrongAnswer, attemptNumber: attempts })

  let tutoringSessionId: string

  if (existing) {
    await supabase.from('tutoring_sessions').update({
      ai_explanation: explanation,
      followup_question: followupQuestion,
      attempts,
    }).eq('id', existing.id)
    tutoringSessionId = existing.id
  } else {
    const { data: inserted } = await supabase.from('tutoring_sessions').insert({
      session_id: sessionId,
      student_id: user.id,
      question_id: questionId,
      wrong_answer: wrongAnswer,
      ai_explanation: explanation,
      followup_question: followupQuestion,
      attempts,
    }).select('id').single()
    tutoringSessionId = inserted!.id
  }

  return NextResponse.json({ explanation, followupQuestion, attempts, tutoringSessionId })
}
```

- [ ] **Step 3: Create `app/api/tutor/mcq-attempt/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tutoringSessionId, selectedAnswer, correctAnswer } = await request.json()
  const mastered = selectedAnswer === correctAnswer

  const { data: ts } = await supabase
    .from('tutoring_sessions').select('attempts').eq('id', tutoringSessionId).single()

  const priorityGap = !mastered && (ts?.attempts ?? 0) >= 3

  await supabase.from('tutoring_sessions').update({ mastered }).eq('id', tutoringSessionId)

  return NextResponse.json({ mastered, priorityGap })
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/claude/tutor-mcq.ts app/api/tutor/
git commit -m "feat: add MCQ tutoring API with mastery tracking"
```

---

## Task 12: Writing Tutoring API

**Files:**
- Create: `lib/claude/tutor-writing.ts`
- Create: `app/api/tutor/writing/route.ts`
- Create: `app/api/tutor/writing-attempt/route.ts`

- [ ] **Step 1: Create `lib/claude/tutor-writing.ts`**

```typescript
import { getClaudeClient } from './client'
import type { WritingScores } from '@/lib/types'

export async function tutorWriting(params: {
  criterion: keyof WritingScores
  originalPrompt: string
  originalResponse: string
  originalScores: WritingScores
}): Promise<{ feedback: string; followUpPrompt: string }> {
  const client = getClaudeClient()
  const criterionLabels: Record<keyof WritingScores, string> = {
    ideas: 'Ideas & Content',
    structure: 'Structure & Organisation',
    vocabulary: 'Vocabulary',
    grammar: 'Grammar & Punctuation',
    spelling: 'Spelling',
  }

  const prompt = `You are a writing tutor helping a Year 6 student improve their "${criterionLabels[params.criterion]}" in writing.

Original prompt: "${params.originalPrompt}"
Student's response: "${params.originalResponse}"
Score for ${criterionLabels[params.criterion]}: ${params.originalScores[params.criterion]}/5

Give:
1. Specific feedback referencing the student's actual text — what they did and exactly how to improve it
2. A new short writing prompt that specifically exercises "${criterionLabels[params.criterion]}"

Return ONLY valid JSON:
{
  "feedback": "...",
  "follow_up_prompt": "..."
}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const parsed = JSON.parse(text)
  return { feedback: parsed.feedback, followUpPrompt: parsed.follow_up_prompt }
}
```

- [ ] **Step 2: Create `app/api/tutor/writing/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tutorWriting } from '@/lib/claude/tutor-writing'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, writingResponseId, criterion } = await request.json()

  const { data: wr } = await supabase
    .from('writing_responses').select('*').eq('id', writingResponseId).single()
  if (!wr) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { feedback, followUpPrompt } = await tutorWriting({
    criterion,
    originalPrompt: wr.prompt,
    originalResponse: wr.response_text,
    originalScores: wr.scores,
  })

  await supabase.from('writing_tutoring_sessions').insert({
    session_id: sessionId,
    writing_response_id: writingResponseId,
    student_id: user.id,
    criterion,
    follow_up_prompt: followUpPrompt,
  })

  return NextResponse.json({ feedback, followUpPrompt })
}
```

- [ ] **Step 3: Create `app/api/tutor/writing-attempt/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scoreWriting } from '@/lib/claude/score-writing'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { writingTutoringSessionId, resubmissionText, testType } = await request.json()

  const { data: wts } = await supabase
    .from('writing_tutoring_sessions')
    .select('*, writing_responses!inner(prompt)')
    .eq('id', writingTutoringSessionId)
    .single()
  if (!wts) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const result = await scoreWriting({
    prompt: wts.writing_responses.prompt,
    responseText: resubmissionText,
    testType,
  })

  const improved = result.scores[wts.criterion as keyof typeof result.scores] >= 3

  await supabase.from('writing_tutoring_sessions').update({
    resubmission_text: resubmissionText,
    updated_scores: result.scores,
    improved,
  }).eq('id', writingTutoringSessionId)

  return NextResponse.json({ scores: result.scores, feedback: result.feedback, improved })
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/claude/tutor-writing.ts app/api/tutor/writing*.ts
git commit -m "feat: add writing tutoring API with re-submission scoring"
```

---

## Task 13: Improvement Suggestions API

**Files:**
- Create: `lib/claude/suggestions.ts`
- Create: `app/api/reports/suggestions/route.ts`

- [ ] **Step 1: Create `lib/claude/suggestions.ts`**

```typescript
import { getClaudeClient } from './client'

interface GapSummary {
  topic: string
  section: string
  attempts: number
}

export async function generateSuggestions(gaps: GapSummary[]): Promise<string[]> {
  if (gaps.length === 0) return ['Keep practising — no major gaps identified yet.']

  const client = getClaudeClient()
  const gapList = gaps.map(g => `- ${g.section}: ${g.topic} (${g.attempts} failed attempts)`).join('\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `A Year 6 student preparing for the WA GATE test has the following knowledge gaps:\n${gapList}\n\nWrite 3-5 specific, actionable improvement suggestions for their parent. Each suggestion should name the topic, recommend a concrete practice activity, and suggest a frequency (e.g. 10 min daily). Return a JSON array of strings, no other text.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  return JSON.parse(text)
}
```

- [ ] **Step 2: Create `app/api/reports/suggestions/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSuggestions } from '@/lib/claude/suggestions'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get the linked student (parent role)
  const { data: child } = await supabase
    .from('student_profiles').select('id').eq('parent_id', user.id).single()
  if (!child) return NextResponse.json({ suggestions: [] })

  // Get priority gaps (unmastered after 3 attempts)
  const { data: gaps } = await supabase
    .from('tutoring_sessions')
    .select('*, question_bank!inner(topic, section)')
    .eq('student_id', child.id)
    .eq('mastered', false)
    .gte('attempts', 3)

  const gapSummary = (gaps ?? []).map((g: any) => ({
    topic: g.question_bank.topic,
    section: g.question_bank.section,
    attempts: g.attempts,
  }))

  const suggestions = await generateSuggestions(gapSummary)
  return NextResponse.json({ suggestions })
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/claude/suggestions.ts app/api/reports/
git commit -m "feat: add improvement suggestions API for parent reports"
```

---

## Task 14: UI Components

**Files:**
- Create: `components/test/McqQuestion.tsx`
- Create: `components/test/WritingPrompt.tsx`
- Create: `components/test/SectionTimer.tsx`
- Create: `components/tutor/McqExplanation.tsx`
- Create: `components/reports/ScoreSummary.tsx`
- Create: `components/reports/KnowledgeGapMap.tsx`

- [ ] **Step 1: Create `components/test/McqQuestion.tsx`**

```tsx
import type { Question } from '@/lib/types'

interface Props {
  question: Question
  selectedAnswer: string | null
  onSelect: (answer: string) => void
  questionNumber: number
  total: number
}

export function McqQuestion({ question, selectedAnswer, onSelect, questionNumber, total }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-gray-500">Question {questionNumber} of {total}</div>
      <p className="text-lg font-medium">{question.question_text}</p>
      <div className="flex flex-col gap-2">
        {(Object.entries(question.options) as [string, string][]).map(([key, value]) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`text-left p-4 rounded-lg border-2 transition-colors ${
              selectedAnswer === key
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-400'
            }`}
          >
            <span className="font-bold mr-2">{key}.</span>{value}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/test/SectionTimer.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'

interface Props {
  timeLimitSecs: number
  onExpire: () => void
}

export function SectionTimer({ timeLimitSecs, onExpire }: Props) {
  const [remaining, setRemaining] = useState(timeLimitSecs)

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining, onExpire])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const isLow = remaining < 120

  return (
    <div className={`font-mono text-lg font-bold ${isLow ? 'text-red-600' : 'text-gray-700'}`}>
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  )
}
```

- [ ] **Step 3: Create `components/test/WritingPrompt.tsx`**

```tsx
'use client'
import { useState } from 'react'

interface Props {
  prompt: string
  onSubmit: (text: string) => void
  timeLimitSecs: number
}

export function WritingPrompt({ prompt, onSubmit, timeLimitSecs }: Props) {
  const [text, setText] = useState('')
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length

  return (
    <div className="flex flex-col gap-4">
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="font-medium">{prompt}</p>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        className="border rounded-lg p-3 min-h-48 resize-y"
        placeholder="Write your response here..."
      />
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{wordCount} words</span>
        <button
          onClick={() => onSubmit(text)}
          disabled={wordCount < 10}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-40"
        >
          Submit Writing
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `components/reports/ScoreSummary.tsx`**

```tsx
import { getTSSBand } from '@/lib/test/scoring'

interface Props {
  latestTss: number | null
  totalTests: number
  progressPercent: number | null // improvement over last 30 days
}

export function ScoreSummary({ latestTss, totalTests, progressPercent }: Props) {
  const band = latestTss ? getTSSBand(latestTss) : null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard label="Projected TSS" value={latestTss ? String(Math.round(latestTss)) : '—'} sub="out of 400" color="blue" />
      <StatCard label="Ranking" value={band ?? '—'} sub="estimated" color="green" />
      <StatCard label="Tests Done" value={String(totalTests)} sub="sessions" color="purple" />
      <StatCard label="30-day Progress" value={progressPercent != null ? `+${progressPercent}%` : '—'} sub="improvement" color="orange" />
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
```

- [ ] **Step 5: Create `components/reports/KnowledgeGapMap.tsx`**

```tsx
interface GapEntry {
  topic: string
  section: string
  mastered: boolean
  attempts: number
}

interface Props {
  gaps: GapEntry[]
}

export function KnowledgeGapMap({ gaps }: Props) {
  const getStatus = (g: GapEntry) => {
    if (g.mastered) return 'green'
    if (g.attempts >= 3) return 'red'
    return 'amber'
  }

  const colors = {
    red: 'bg-red-100 border-red-400 text-red-800',
    amber: 'bg-amber-100 border-amber-400 text-amber-800',
    green: 'bg-green-100 border-green-400 text-green-800',
  }

  const labels = { red: 'Priority', amber: 'Developing', green: 'Strong' }

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
              {g.topic}
            </span>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add components/
git commit -m "feat: add test, tutoring, and report UI components"
```

---

## Task 15: Live Test Page

**Files:**
- Create: `app/student/test/select/page.tsx`
- Create: `app/student/test/[id]/page.tsx`
- Create: `app/student/test/[id]/result/page.tsx`
- Create: `app/student/layout.tsx`

- [ ] **Step 1: Create `app/student/layout.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'student') redirect('/parent/dashboard')

  return <>{children}</>
}
```

- [ ] **Step 2: Create `app/student/test/select/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TestType, TestMode } from '@/lib/types'
import { TEST_CONFIG } from '@/lib/test/constants'

export default function TestSelectPage() {
  const router = useRouter()
  const [testType, setTestType] = useState<TestType>('gate')
  const [mode, setMode] = useState<TestMode>('full')
  const [sectionKey, setSectionKey] = useState('')
  const [loading, setLoading] = useState(false)

  const sections = TEST_CONFIG[testType]

  async function startTest() {
    setLoading(true)
    const res = await fetch('/api/test/assemble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testType, mode, sectionKey: mode === 'practice' ? sectionKey : undefined }),
    })
    const data = await res.json()
    if (data.session) router.push(`/student/test/${data.session.id}`)
    else setLoading(false)
  }

  return (
    <main className="max-w-lg mx-auto p-8 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Start a Test</h1>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Test type</p>
        <div className="flex gap-2">
          {(['gate', 'scholarship'] as TestType[]).map(t => (
            <button key={t} onClick={() => setTestType(t)}
              className={`flex-1 py-2 rounded-lg border font-medium uppercase text-sm ${testType === t ? 'bg-blue-600 text-white border-blue-600' : ''}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Mode</p>
        <div className="flex gap-2">
          <button onClick={() => setMode('full')} className={`flex-1 py-2 rounded-lg border font-medium text-sm ${mode === 'full' ? 'bg-blue-600 text-white border-blue-600' : ''}`}>Full Test</button>
          <button onClick={() => setMode('practice')} className={`flex-1 py-2 rounded-lg border font-medium text-sm ${mode === 'practice' ? 'bg-blue-600 text-white border-blue-600' : ''}`}>Practice (one section)</button>
        </div>
      </div>

      {mode === 'practice' && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Section</p>
          <select value={sectionKey} onChange={e => setSectionKey(e.target.value)} className="w-full border rounded-lg p-3">
            <option value="">Select section...</option>
            {sections.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      )}

      <button onClick={startTest} disabled={loading || (mode === 'practice' && !sectionKey)}
        className="py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50">
        {loading ? 'Preparing test...' : 'Start Test'}
      </button>
    </main>
  )
}
```

- [ ] **Step 3: Create `app/student/test/[id]/page.tsx`**

This is the live test session. It uses the session data from the assemble API (stored in sessionStorage after redirect).

```tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { McqQuestion } from '@/components/test/McqQuestion'
import { SectionTimer } from '@/components/test/SectionTimer'
import { WritingPrompt } from '@/components/test/WritingPrompt'
import type { Question, WritingScores } from '@/lib/types'

// Session data is stored in sessionStorage by the select page after assembly
interface SessionData {
  session: { id: string; test_type: string }
  sections: Array<{ key: string; label: string; type: string; questionCount: number; timeLimitSecs: number }>
  questions: Question[]
  writingPrompts: Record<string, string>
}

export default function LiveTestPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0)
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [writingText, setWritingText] = useState('')
  const [writingPromptForSection, setWritingPromptForSection] = useState('')
  const [scoredWriting, setScoredWriting] = useState<any>(null) // stores scoreWriting result
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem(`test-session-${id}`)
    if (stored) setSessionData(JSON.parse(stored))
  }, [id])

  const saveAnswer = useCallback(async (questionId: string, answer: string, isCorrect: boolean) => {
    await fetch('/api/test/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id, questionId, selectedAnswer: answer, isCorrect }),
    })
  }, [id])

  const handleMcqSelect = async (questionId: string, correctAnswer: string, selected: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: selected }))
    await saveAnswer(questionId, selected, selected === correctAnswer)
  }

  const advanceSection = () => {
    if (!sessionData) return
    if (currentSectionIdx < sessionData.sections.length - 1) {
      setCurrentSectionIdx(i => i + 1)
      setCurrentQuestionIdx(0)
    } else {
      completeTest()
    }
  }

  const completeTest = async () => {
    if (!sessionData || submitting) return
    setSubmitting(true)
    await fetch('/api/test/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: id,
        writingResponse: scoredWriting ?? undefined,
      }),
    })
    router.push(`/student/test/${id}/result`)
  }

  if (!sessionData) return <div className="p-8 text-center">Loading test...</div>

  const currentSection = sessionData.sections[currentSectionIdx]
  const sectionQuestions = sessionData.questions.filter(q => q.section === currentSection.key)
  const currentQuestion = sectionQuestions[currentQuestionIdx]

  return (
    <main className="max-w-2xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-bold text-lg">{currentSection.label}</h2>
          <p className="text-sm text-gray-500">Section {currentSectionIdx + 1} of {sessionData.sections.length}</p>
        </div>
        <SectionTimer timeLimitSecs={currentSection.timeLimitSecs} onExpire={advanceSection} />
      </div>

      {currentSection.type === 'mcq' && currentQuestion && (
        <div className="flex flex-col gap-6">
          <McqQuestion
            question={currentQuestion}
            selectedAnswer={answers[currentQuestion.id] ?? null}
            onSelect={sel => handleMcqSelect(currentQuestion.id, currentQuestion.correct_answer, sel)}
            questionNumber={currentQuestionIdx + 1}
            total={sectionQuestions.length}
          />
          <div className="flex justify-between">
            <button onClick={() => setCurrentQuestionIdx(i => Math.max(0, i - 1))} disabled={currentQuestionIdx === 0}
              className="px-4 py-2 border rounded-lg disabled:opacity-40">Back</button>
            {currentQuestionIdx < sectionQuestions.length - 1
              ? <button onClick={() => setCurrentQuestionIdx(i => i + 1)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Next</button>
              : <button onClick={advanceSection} className="px-4 py-2 bg-green-600 text-white rounded-lg">
                  {currentSectionIdx < sessionData.sections.length - 1 ? 'Next Section →' : 'Finish Test'}
                </button>
            }
          </div>
        </div>
      )}

      {currentSection.type === 'writing' && (
        <WritingPrompt
          prompt={sessionData.writingPrompts[currentSection.key] ?? ''}
          onSubmit={async (text) => {
            setWritingText(text)
            // Score writing via Claude before advancing
            const scoreRes = await fetch('/api/writing/score', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: sessionData.writingPrompts[currentSection.key],
                responseText: text,
                testType: sessionData.session.test_type,
              }),
            })
            const scored = await scoreRes.json()
            // Store for use in completeTest
            setScoredWriting({
              prompt: sessionData.writingPrompts[currentSection.key],
              responseText: text,
              scores: scored.scores,
              aiFeedback: scored.feedback,
              followUpPrompt: scored.followUpPrompt,
            })
            advanceSection()
          }}
          timeLimitSecs={currentSection.timeLimitSecs}
        />
      )}
    </main>
  )
}
```

**Note:** Update `app/student/test/select/page.tsx` `startTest` function to store session data before redirecting:

```typescript
// After receiving data from /api/test/assemble:
sessionStorage.setItem(`test-session-${data.session.id}`, JSON.stringify(data))
router.push(`/student/test/${data.session.id}`)
```

- [ ] **Step 4: Create `app/student/test/[id]/result/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getTSSBand } from '@/lib/test/scoring'
import Link from 'next/link'

export default async function ResultPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('test_sessions').select('*').eq('id', params.id).single()

  const { data: wrongAnswers } = await supabase
    .from('test_answers')
    .select('*, question_bank!inner(topic, section)')
    .eq('session_id', params.id)
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
          {wrongAnswers.map((a: any) => (
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
```

- [ ] **Step 5: Commit**

```bash
git add app/student/
git commit -m "feat: add test selection, live test, and results pages"
```

---

## Task 16: Tutoring Page

**Files:**
- Create: `app/student/tutor/[id]/page.tsx`
- Create: `components/tutor/McqExplanation.tsx`

- [ ] **Step 1: Create `components/tutor/McqExplanation.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { McqQuestion } from '@/components/test/McqQuestion'
import type { Question } from '@/lib/types'

interface Props {
  explanation: string
  followupQuestion: Omit<Question, 'id' | 'generated_at'>
  tutoringSessionId: string
  attempts: number
  onMastered: () => void
  onGap: () => void
}

export function McqExplanation({ explanation, followupQuestion, tutoringSessionId, attempts, onMastered, onGap }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [result, setResult] = useState<{ mastered: boolean; priorityGap: boolean } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function checkAnswer() {
    if (!selected) return
    setSubmitting(true)
    const res = await fetch('/api/tutor/mcq-attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tutoringSessionId,
        selectedAnswer: selected,
        correctAnswer: (followupQuestion as any).correct_answer,
      }),
    })
    const data = await res.json()
    setResult(data)
    setSubmitting(false)
    if (data.mastered) onMastered()
    else if (data.priorityGap) onGap()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <h3 className="font-semibold mb-2">Understanding the mistake</h3>
        <p className="text-gray-700 leading-relaxed">{explanation}</p>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Try a similar question</h3>
        <McqQuestion
          question={{ ...followupQuestion, id: 'followup', generated_at: '' } as Question}
          selectedAnswer={selected}
          onSelect={setSelected}
          questionNumber={1}
          total={1}
        />
      </div>

      {!result && (
        <button onClick={checkAnswer} disabled={!selected || submitting}
          className="py-3 bg-blue-600 text-white rounded-lg disabled:opacity-40">
          Check Answer
        </button>
      )}

      {result?.mastered && (
        <div className="p-4 bg-green-50 border border-green-300 rounded-xl text-green-800 font-medium text-center">
          ✓ Correct! You've got it.
        </div>
      )}

      {result && !result.mastered && !result.priorityGap && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-center">
          Not quite — keep trying. Attempt {attempts} of 3.
        </div>
      )}

      {result?.priorityGap && (
        <div className="p-4 bg-red-50 border border-red-300 rounded-xl text-red-800 text-center">
          This topic has been flagged as a priority gap for your parent's report.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/student/tutor/[id]/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { McqExplanation } from '@/components/tutor/McqExplanation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function TutorPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mastered, setMastered] = useState(false)

  useEffect(() => {
    async function load() {
      // params.id is a test_answers id
      const supabase = createClient()
      const { data: answer } = await supabase
        .from('test_answers')
        .select('*, question_bank!inner(*), test_sessions!inner(id)')
        .eq('id', params.id)
        .single()

      if (!answer) { setLoading(false); return }

      const res = await fetch('/api/tutor/mcq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: answer.test_sessions.id,
          questionId: answer.question_id,
          wrongAnswer: answer.selected_answer,
        }),
      })
      const tutorData = await res.json()
      setData({ answer, ...tutorData })
      setLoading(false)
    }
    load()
  }, [params.id])

  if (loading) return <div className="p-8 text-center">Loading tutoring...</div>
  if (!data) return <div className="p-8">Not found.</div>

  return (
    <main className="max-w-2xl mx-auto p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Let's review this question</h1>
        <Link href="/student/dashboard" className="text-sm text-gray-500">Skip</Link>
      </div>

      <div className="p-4 bg-gray-50 rounded-xl">
        <p className="text-sm text-gray-500 mb-1">{data.answer.question_bank.section.replace(/_/g, ' ')}</p>
        <p>{data.answer.question_bank.question_text}</p>
      </div>

      {mastered
        ? <div className="p-6 bg-green-50 border border-green-300 rounded-xl text-center text-green-800 font-semibold">
            Topic mastered! 🎉 <Link href="/student/dashboard" className="underline ml-2">Back to dashboard</Link>
          </div>
        : <McqExplanation
            explanation={data.explanation}
            followupQuestion={data.followupQuestion}
            tutoringSessionId={data.tutoringSessionId}
            attempts={data.attempts}
            onMastered={() => setMastered(true)}
            onGap={() => {}}
          />
      }
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/tutor/ app/student/tutor/
git commit -m "feat: add MCQ tutoring page with explanation and follow-up"
```

---

## Task 17: Student Dashboard + History

**Files:**
- Create: `app/student/dashboard/page.tsx`
- Create: `app/student/history/page.tsx`

- [ ] **Step 1: Create `app/student/dashboard/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { getTSSBand } from '@/lib/test/scoring'
import Link from 'next/link'

export default async function StudentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users').select('full_name').eq('id', user!.id).single()

  const { data: recentSessions } = await supabase
    .from('test_sessions')
    .select('*')
    .eq('student_id', user!.id)
    .order('started_at', { ascending: false })
    .limit(5)

  const latestFull = recentSessions?.find(s => s.mode === 'full' && s.projected_tss)
  const tss = latestFull?.projected_tss
  const band = tss ? getTSSBand(tss) : null

  return (
    <main className="max-w-2xl mx-auto p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Welcome, {profile?.full_name?.split(' ')[0]}</h1>
        <Link href="/student/test/select" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
          Start Test
        </Link>
      </div>

      {tss && (
        <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">Projected GATE TSS</div>
            <div className="text-3xl font-bold text-blue-700">{Math.round(tss)} / 400</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-blue-600">{band}</div>
            <div className="text-sm text-gray-500">estimated ranking</div>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent Tests</h2>
          <Link href="/student/history" className="text-sm text-blue-600">View all</Link>
        </div>
        {recentSessions?.length === 0 && <p className="text-gray-500 text-sm">No tests yet. Start your first test!</p>}
        {recentSessions?.map(s => (
          <div key={s.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg mb-2">
            <div>
              <div className="font-medium uppercase text-sm">{s.test_type} — {s.mode}</div>
              <div className="text-xs text-gray-500">{new Date(s.started_at).toLocaleDateString()}</div>
            </div>
            <div className="text-right">
              <div className="font-bold">{s.total_score ?? '—'}</div>
              {s.projected_tss && <div className="text-xs text-blue-600">TSS ~{Math.round(s.projected_tss)}</div>}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Create `app/student/history/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: sessions } = await supabase
    .from('test_sessions')
    .select('*')
    .eq('student_id', user!.id)
    .order('started_at', { ascending: false })

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Test History</h1>
      {sessions?.map(s => (
        <div key={s.id} className="flex justify-between items-center p-4 border rounded-xl mb-3">
          <div>
            <div className="font-medium uppercase">{s.test_type} · {s.mode}</div>
            <div className="text-sm text-gray-500">{new Date(s.started_at).toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-lg">{s.total_score ?? '—'}</div>
            {s.projected_tss && <div className="text-sm text-blue-600">TSS ~{Math.round(s.projected_tss)}</div>}
          </div>
        </div>
      ))}
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/student/dashboard/ app/student/history/
git commit -m "feat: add student dashboard and history pages"
```

---

## Task 18: Parent Dashboard + Reports

**Files:**
- Create: `app/parent/layout.tsx`
- Create: `app/parent/dashboard/page.tsx`
- Create: `app/parent/reports/page.tsx`
- Create: `app/parent/history/page.tsx`

- [ ] **Step 1: Create `app/parent/layout.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'parent') redirect('/student/dashboard')

  return <>{children}</>
}
```

- [ ] **Step 2: Create `app/parent/dashboard/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { ScoreSummary } from '@/components/reports/ScoreSummary'
import Link from 'next/link'

export default async function ParentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: child } = await supabase
    .from('student_profiles')
    .select('id, users!inner(full_name)')
    .eq('parent_id', user!.id)
    .single()

  const { data: sessions } = child
    ? await supabase
        .from('test_sessions')
        .select('*')
        .eq('student_id', child.id)
        .order('started_at', { ascending: false })
    : { data: null }

  const latestFull = sessions?.find(s => s.mode === 'full' && s.projected_tss)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const recentSessions = sessions?.filter(s => new Date(s.started_at) > thirtyDaysAgo) ?? []
  const firstRecent = recentSessions[recentSessions.length - 1]
  const progressPercent = latestFull && firstRecent?.projected_tss
    ? Math.round(((latestFull.projected_tss - firstRecent.projected_tss) / (firstRecent.projected_tss || 1)) * 100)
    : null

  return (
    <main className="max-w-2xl mx-auto p-8 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">
        {child ? `${(child as any).users.full_name}'s Progress` : 'Parent Dashboard'}
      </h1>

      {!child && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
          No student linked yet. Ask your child to sign up and then link accounts via Settings.
        </div>
      )}

      {child && (
        <ScoreSummary
          latestTss={latestFull?.projected_tss ?? null}
          totalTests={sessions?.length ?? 0}
          progressPercent={progressPercent}
        />
      )}

      <div className="flex gap-3">
        <Link href="/parent/reports" className="flex-1 py-3 text-center border rounded-xl hover:bg-gray-50">
          Full Report
        </Link>
        <Link href="/parent/history" className="flex-1 py-3 text-center border rounded-xl hover:bg-gray-50">
          Test History
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Create `app/parent/reports/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { KnowledgeGapMap } from '@/components/reports/KnowledgeGapMap'
import { ImprovementSuggestions } from '@/components/reports/ImprovementSuggestions'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: child } = await supabase
    .from('student_profiles').select('id').eq('parent_id', user!.id).single()

  if (!child) return <div className="p-8">No student linked.</div>

  const { data: tutoringSessions } = await supabase
    .from('tutoring_sessions')
    .select('*, question_bank!inner(topic, section)')
    .eq('student_id', child.id)

  const gaps = (tutoringSessions ?? []).map((ts: any) => ({
    topic: ts.question_bank.topic,
    section: ts.question_bank.section,
    mastered: ts.mastered,
    attempts: ts.attempts,
  }))

  // Section scores across all full tests
  const { data: sessions } = await supabase
    .from('test_sessions')
    .select('section_scores, started_at')
    .eq('student_id', child.id)
    .eq('mode', 'full')
    .not('section_scores', 'is', null)
    .order('started_at', { ascending: false })
    .limit(10)

  return (
    <main className="max-w-2xl mx-auto p-8 flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Detailed Report</h1>

      <section>
        <h2 className="font-semibold mb-3">Knowledge Gap Map</h2>
        <KnowledgeGapMap gaps={gaps} />
      </section>

      <section>
        <h2 className="font-semibold mb-3">Improvement Suggestions</h2>
        <ImprovementSuggestions studentId={child.id} />
      </section>

      <section>
        <h2 className="font-semibold mb-3">Section Progress (last 10 tests)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">Date</th>
                <th className="pb-2">Reading</th>
                <th className="pb-2">Writing</th>
                <th className="pb-2">Quantitative</th>
                <th className="pb-2">Abstract</th>
              </tr>
            </thead>
            <tbody>
              {sessions?.map((s, i) => {
                const sc = s.section_scores as Record<string, number>
                return (
                  <tr key={i} className="border-b">
                    <td className="py-2">{new Date(s.started_at).toLocaleDateString()}</td>
                    <td>{sc?.reading_comprehension ?? sc?.english ?? '—'}</td>
                    <td>{sc?.writing_total ?? '—'}/25</td>
                    <td>{sc?.quantitative_reasoning ?? sc?.mathematics ?? '—'}</td>
                    <td>{sc?.abstract_reasoning ?? sc?.general_ability ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Create `components/reports/ImprovementSuggestions.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'

export function ImprovementSuggestions({ studentId }: { studentId: string }) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reports/suggestions')
      .then(r => r.json())
      .then(d => { setSuggestions(d.suggestions ?? []); setLoading(false) })
  }, [studentId])

  if (loading) return <div className="text-sm text-gray-400">Generating suggestions...</div>

  return (
    <ul className="flex flex-col gap-2">
      {suggestions.map((s, i) => (
        <li key={i} className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-gray-700">
          {s}
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 5: Create `app/parent/history/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'

export default async function ParentHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: child } = await supabase
    .from('student_profiles').select('id').eq('parent_id', user!.id).single()

  if (!child) return <div className="p-8">No student linked.</div>

  const { data: sessions } = await supabase
    .from('test_sessions')
    .select('*')
    .eq('student_id', child.id)
    .order('started_at', { ascending: false })

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Test History</h1>
      {sessions?.map(s => (
        <div key={s.id} className="flex justify-between items-center p-4 border rounded-xl mb-3">
          <div>
            <div className="font-medium uppercase">{s.test_type} · {s.mode}</div>
            <div className="text-sm text-gray-500">{new Date(s.started_at).toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="font-bold">{s.total_score ?? '—'} correct</div>
            {s.projected_tss && <div className="text-sm text-blue-600">TSS ~{Math.round(s.projected_tss)}</div>}
          </div>
        </div>
      ))}
    </main>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add app/parent/ components/reports/ImprovementSuggestions.tsx
git commit -m "feat: add parent dashboard, reports, and history pages"
```

---

## Task 19: Vercel Deployment

- [ ] **Step 1: Push to GitHub**

```bash
git remote add origin https://github.com/YOUR_USERNAME/gate-prep-poc.git
git push -u origin main
```

- [ ] **Step 2: Import project in Vercel**

Go to vercel.com → New Project → import your GitHub repo.

- [ ] **Step 3: Add environment variables in Vercel**

Add these in Vercel project settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`

- [ ] **Step 4: Deploy and verify**

Trigger deploy. Visit the production URL and:
- Sign up as a student → redirects to `/student/dashboard` ✓
- Sign up as a parent → redirects to `/parent/dashboard` ✓
- Start a GATE test → questions load ✓
- Complete a section → timer works, next section advances ✓

- [ ] **Step 5: Add `.gitignore` entry for `.env.local`**

```bash
echo ".env.local" >> .gitignore
echo ".superpowers/" >> .gitignore
git add .gitignore
git commit -m "chore: ignore .env.local and .superpowers/"
```

---

## Task 20: End-to-End Smoke Test

Run through the full user flow manually to verify the PoC works end-to-end.

- [ ] **Student flow**
  1. Sign up as student → lands on dashboard
  2. Start a GATE full test → questions load per section
  3. Answer some questions right and some wrong
  4. Complete test → results page shows score + TSS
  5. Click a wrong answer → tutoring page loads explanation + follow-up
  6. Answer follow-up correctly → marked mastered

- [ ] **Parent flow**
  1. Sign up as parent
  2. Link child (via Supabase dashboard: set `student_profiles.parent_id` to parent user ID for PoC)
  3. Visit parent dashboard → sees child's TSS and recent tests
  4. View reports → knowledge gap map and improvement suggestions load
  5. View history → all child's sessions listed

- [ ] **Commit final state**

```bash
git add -A
git commit -m "chore: final PoC smoke test complete"
```

---

## Notes for Implementer

**Parent-child linking in PoC:** The signup page captures the child's email but full automated linking requires a lookup of the child's user ID after they sign up. For the PoC, the simplest approach is: after both accounts exist, set `student_profiles.parent_id` manually via the Supabase dashboard, or add a simple `/api/link-child` endpoint that accepts the child's email, finds their user ID, and updates the record.

**Session data in sessionStorage:** The live test page reads session data (questions, writing prompts) from `sessionStorage` keyed by session ID. The `select/page.tsx` must store this before redirecting. If the user refreshes during a test, they can re-fetch the assembled questions via the session ID from Supabase.

**Writing scoring latency:** Claude takes 3–10 seconds to score writing. The scoring call is made inline in `WritingPrompt.onSubmit` (in the live test page) before advancing to the next section. Show a loading spinner on the writing submission button while `/api/writing/score` is in-flight. The scored result is stored in component state and sent to `/api/test/complete` when the full test ends.

**`test_answers` unique constraint:** The `upsert` in `/api/test/answer` uses `onConflict: 'session_id,question_id'`. Add this unique index to the migration if not already present: `create unique index on test_answers(session_id, question_id);`

**Claude JSON parsing:** All Claude prompts instruct the model to return JSON only. If parsing fails, the API routes should return a 500 with a clear error message. Implement a retry wrapper if needed in production.
