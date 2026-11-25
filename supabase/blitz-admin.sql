-- Manage Blitz Aviation access from the app (Settings → Blitz Aviation access).
-- Run once in Supabase → SQL Editor, after blitz-fleet.sql. Only library owners (app_admins)
-- can list, add or remove; anyone added by email gets access once they sign up and confirm it.

create table if not exists public.org_invites (
  email text primary key,
  org text not null default 'blitz',
  added_at timestamptz not null default now()
);
alter table public.org_invites enable row level security; -- only reachable through the functions below

-- Members are org_members rows, or anyone whose confirmed email is on org_invites.
create or replace function public.is_blitz_member(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.org_members where user_id = uid and org = 'blitz')
    or exists (
      select 1 from auth.users u join public.org_invites i on lower(i.email) = lower(u.email)
      where u.id = uid and i.org = 'blitz' and u.email_confirmed_at is not null
    )
$$;

create or replace function public.blitz_member_list()
returns table (email text, signed_up boolean, is_owner boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'Only the library owner can manage Blitz access.';
  end if;
  return query
    select u.email::text, true, public.is_app_admin(u.id)
    from public.org_members m join auth.users u on u.id = m.user_id
    where m.org = 'blitz'
    union all
    select i.email,
      exists (select 1 from auth.users u where lower(u.email) = lower(i.email) and u.email_confirmed_at is not null),
      false
    from public.org_invites i
    where i.org = 'blitz'
      and not exists (select 1 from public.org_members m join auth.users u on u.id = m.user_id where lower(u.email) = lower(i.email));
end $$;

create or replace function public.blitz_add(member_email text) returns void
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(member_email));
begin
  if not public.is_app_admin(auth.uid()) then
    raise exception 'Only the library owner can manage Blitz access.';
  end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
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
