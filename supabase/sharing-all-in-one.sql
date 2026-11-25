-- Shared library + Blitz fleet + Blitz access management, in one idempotent script.
-- Safe to run more than once. Put the owner's account email in the two marked lines.

-- 1. Library owners
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.app_admins enable row level security;

create or replace function public.is_app_admin(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where user_id = uid)
$$;
grant execute on function public.is_app_admin(uuid) to anon, authenticated;

drop policy if exists "everyone reads the shared library" on public.records;
create policy "everyone reads the shared library" on public.records
  for select to anon, authenticated
  using (collection = 'resources' and not deleted and public.is_app_admin(user_id));
grant select on public.records to anon;

insert into public.app_admins (user_id)
select id from auth.users where lower(email) = lower('OWNER@EXAMPLE.COM')  -- owner email
on conflict do nothing;

-- 2. Blitz members and invites
create table if not exists public.org_members (
  user_id uuid primary key references auth.users on delete cascade,
  org text not null default 'blitz'
);
alter table public.org_members enable row level security;

create table if not exists public.org_invites (
  email text primary key,
  org text not null default 'blitz',
  added_at timestamptz not null default now()
);
alter table public.org_invites enable row level security;

insert into public.org_members (user_id)
select id from auth.users where lower(email) = lower('OWNER@EXAMPLE.COM')  -- owner email
on conflict do nothing;

create or replace function public.is_blitz_member(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.org_members where user_id = uid and org = 'blitz')
    or exists (
      select 1 from auth.users u join public.org_invites i on lower(i.email) = lower(u.email)
      where u.id = uid and i.org = 'blitz' and u.email_confirmed_at is not null
    )
$$;

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

-- 3. Fleet visibility
drop policy if exists "blitz reads the fleet" on public.records;
create policy "blitz reads the fleet" on public.records
  for select to authenticated
  using (collection = 'aircraft' and not deleted and public.is_app_admin(user_id) and public.can_see_blitz_fleet());

-- 4. Manage access from Settings (owner only)
drop function if exists public.blitz_member_list();
create function public.blitz_member_list()
returns table (member_email text, signed_up boolean, is_owner boolean)
language sql stable security definer set search_path = public as $$
  select u.email::text, true, public.is_app_admin(u.id)
  from public.org_members m join auth.users u on u.id = m.user_id
  where m.org = 'blitz' and public.is_app_admin(auth.uid())
  union all
  select i.email,
    exists (select 1 from auth.users u2 where lower(u2.email) = lower(i.email) and u2.email_confirmed_at is not null),
    false
  from public.org_invites i
  where i.org = 'blitz' and public.is_app_admin(auth.uid())
    and not exists (select 1 from public.org_members m2 join auth.users u3 on u3.id = m2.user_id where lower(u3.email) = lower(i.email))
$$;

create or replace function public.blitz_add(member_email text) returns void
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(member_email));
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'Only the library owner can manage Blitz access.';
  end if;
  if position('@' in e) < 2 or position('.' in e) = 0 then
    raise exception 'That doesn''t look like an email address.';
  end if;
  insert into public.org_invites (email) values (e) on conflict (email) do nothing;
end $$;

create or replace function public.blitz_remove(member_email text) returns void
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(member_email));
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'Only the library owner can manage Blitz access.';
  end if;
  if e = lower(coalesce(auth.jwt()->>'email', '')) then
    raise exception 'You can''t remove yourself: your students would lose the fleet.';
  end if;
  delete from public.org_invites where lower(email) = e;
  delete from public.org_members m using auth.users u where u.id = m.user_id and lower(u.email) = e;
end $$;

revoke execute on function public.blitz_member_list() from public, anon;
revoke execute on function public.blitz_add(text) from public, anon;
revoke execute on function public.blitz_remove(text) from public, anon;
grant execute on function public.blitz_member_list() to authenticated;
grant execute on function public.blitz_add(text) to authenticated;
grant execute on function public.blitz_remove(text) to authenticated;
