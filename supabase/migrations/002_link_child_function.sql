-- SECURITY DEFINER function so a parent can set parent_id on a student's profile.
-- Direct UPDATE is blocked by RLS (only the student can update their own row),
-- so we use a trusted function that runs as the function owner and bypasses RLS.
create or replace function public.link_child_to_parent(child_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Verify the child has a student_profiles row (i.e., is actually a student)
  if not exists (
    select 1 from public.student_profiles where id = child_id
  ) then
    raise exception 'not_a_student';
  end if;

  -- Set parent_id. Allow re-linking only if the student isn't already linked
  -- to a *different* parent (prevents one parent hijacking another's child).
  update public.student_profiles
    set parent_id = auth.uid()
  where id = child_id
    and (parent_id is null or parent_id = auth.uid());

  if not found then
    raise exception 'already_linked';
  end if;
end;
$$;

-- Prevent unauthenticated callers from invoking this function
revoke execute on function public.link_child_to_parent(uuid) from anon;
