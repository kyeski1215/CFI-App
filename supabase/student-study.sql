-- Student study side: run once in Supabase → SQL Editor (after schema.sql and student-access.sql).
-- Each student keeps one small activity record per instructor card: lesson prep they ticked off,
-- debriefs they've read, flashcard progress, and questions for their instructor.
-- The student writes it; the instructor who shared the card can read it. Nobody else can.

create table if not exists public.student_activity (
  cfi_user uuid not null,                    -- the instructor who shared the card
  card_id text not null,                     -- the card's id (the instructor's student record id)
  student_user uuid not null default auth.uid(),
  student_email text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (cfi_user, card_id)
);

alter table public.student_activity enable row level security;
grant select, insert, update on public.student_activity to authenticated;

-- True when the signed-in person is the student a given card was shared with.
create or replace function public.owns_shared_card(cfi uuid, card text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.records r
    where r.user_id = cfi and r.collection = 'cards' and r.id = card and not r.deleted
      and lower(r.data->>'studentEmail') = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;
grant execute on function public.owns_shared_card(uuid, text) to authenticated;

drop policy if exists "student writes own activity" on public.student_activity;
create policy "student writes own activity" on public.student_activity
  for insert to authenticated
  with check (student_user = auth.uid() and public.owns_shared_card(cfi_user, card_id));

drop policy if exists "student updates own activity" on public.student_activity;
create policy "student updates own activity" on public.student_activity
  for update to authenticated
  using (student_user = auth.uid())
  with check (student_user = auth.uid() and public.owns_shared_card(cfi_user, card_id));

drop policy if exists "student or instructor reads activity" on public.student_activity;
create policy "student or instructor reads activity" on public.student_activity
  for select to authenticated
  using (student_user = auth.uid() or cfi_user = auth.uid());
