-- Shared resource library: run once in Supabase → SQL Editor.
-- Everything the library owner(s) add on the Resources page is readable by every user of the app
-- (signed in or not). Anyone else's resources stay private to them. Only owners listed in
-- app_admins publish to the library; add an owner by email with the insert at the bottom.

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.app_admins enable row level security; -- no policies: not readable or writable from the app

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

-- Replace the email with the library owner's account email (the account must already exist).
insert into public.app_admins (user_id)
select id from auth.users where lower(email) = lower('OWNER@EXAMPLE.COM')
on conflict do nothing;
