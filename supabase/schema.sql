-- CFI Cockpit sync table. Run once in Supabase → SQL Editor.
-- One row per app record (student, mock checkride, resource). Each user only sees their own rows.

create table if not exists public.records (
  user_id    uuid    not null default auth.uid() references auth.users on delete cascade,
  collection text    not null,
  id         text    not null,
  data       jsonb   not null,
  updated_ms bigint  not null,          -- client edit time, used for last-write-wins
  deleted    boolean not null default false,
  server_ts  timestamptz not null default now(),  -- set by trigger, used as the pull cursor
  primary key (user_id, collection, id)
);

create index if not exists records_user_server_ts on public.records (user_id, server_ts);

create or replace function public.records_touch() returns trigger
language plpgsql as $$
begin
  -- Ignore an upload that is older than what the server already has.
  if tg_op = 'UPDATE' and new.updated_ms < old.updated_ms then
    return old;
  end if;
  new.server_ts := clock_timestamp();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
for each row execute function public.records_touch();

-- Signed-in users can use the table (row-level security below still limits them to their own rows).
-- Newer Supabase projects don't grant this automatically. Logged-out visitors get nothing.
grant select, insert, update, delete on public.records to authenticated;
revoke all on public.records from anon;

alter table public.records enable row level security;

drop policy if exists "own rows" on public.records;
create policy "own rows" on public.records
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
