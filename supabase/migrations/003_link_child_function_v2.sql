-- Explicitly pass the parent user ID into the SECURITY DEFINER function instead of
-- relying on auth.uid() inside the function body. This avoids silent failures where
-- the child row is "updated" but parent_id remains null.
create or replace function public.link_child_to_parent_v2(child_id uuid, parent_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if parent_user_id is null then
    raise exception 'parent_required';
  end if;

  -- Verify the target account is actually a student profile.
  if not exists (
    select 1 from public.student_profiles where id = child_id
  ) then
    raise exception 'not_a_student';
  end if;

  update public.student_profiles
    set parent_id = parent_user_id
  where id = child_id
    and (parent_id is null or parent_id = parent_user_id);

  if not found then
    raise exception 'already_linked';
  end if;
end;
$$;

revoke execute on function public.link_child_to_parent_v2(uuid, uuid) from anon;
