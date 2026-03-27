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

-- get_user_id_by_email function for parent-child linking
create or replace function public.get_user_id_by_email(email text)
returns uuid
language sql
security definer
as $$
  select id from auth.users where auth.users.email = $1 limit 1;
$$;
