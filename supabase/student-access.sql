-- Student view: run once in Supabase → SQL Editor (after schema.sql).
-- A student who signs in with the email on their roster record can read the card their
-- instructor shares (collection 'cards', written by the instructor's app). Nothing else.
drop policy if exists "students read their card" on public.records;
create policy "students read their card" on public.records
  for select to authenticated
  using (
    collection = 'cards'
    and not deleted
    and lower(data->>'studentEmail') = lower(coalesce(auth.jwt()->>'email', ''))
  );
