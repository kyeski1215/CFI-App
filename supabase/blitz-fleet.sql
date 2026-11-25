-- Blitz fleet: run once in Supabase → SQL Editor (after shared-library.sql).
-- Aircraft on the library owner's account (app_admins) are readable only by Blitz Aviation
-- members (org_members) and by students whose card was shared by a Blitz member.

create table if not exists public.org_members (
  user_id uuid primary key references auth.users on delete cascade,
  org text not null default 'blitz'
);
alter table public.org_members enable row level security; -- not readable or writable from the app

create or replace function public.is_blitz_member(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.org_members where user_id = uid and org = 'blitz')
$$;

-- Security definer so the card lookup below doesn't re-enter the records policies.
create or replace function public.can_see_blitz_fleet() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_blitz_member(auth.uid())
    or exists (
      select 1 from public.records c
      where c.collection = 'cards' and not c.deleted
        and lower(c.data->>'studentEmail') = lower(coalesce(auth.jwt()->>'email', ''))
        and public.is_blitz_member(c.user_id)
    )
$$;
grant execute on function public.is_blitz_member(uuid) to authenticated;
grant execute on function public.can_see_blitz_fleet() to authenticated;

drop policy if exists "blitz reads the fleet" on public.records;
create policy "blitz reads the fleet" on public.records
  for select to authenticated
  using (collection = 'aircraft' and not deleted and public.is_app_admin(user_id) and public.can_see_blitz_fleet());

-- Blitz members (CFIs). Their shared students can see the fleet too. Repeat for each CFI's email.
insert into public.org_members (user_id)
select id from auth.users where lower(email) = lower('OWNER@EXAMPLE.COM')
on conflict do nothing;
