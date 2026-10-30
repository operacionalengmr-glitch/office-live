-- Office Live street (multiplayer): people walking outside share their positions over a private
-- Realtime broadcast channel, "office-street". Only confirmed @engmr.com.br accounts may join it
-- (receive) or send on it; nothing is stored, broadcast messages are not persisted.
create or replace function public.office_is_member() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null and lower(u.email) like '%@engmr.com.br'
  );
$$;
revoke all on function public.office_is_member() from public, anon;
grant execute on function public.office_is_member() to authenticated;

drop policy if exists "office street: members receive" on realtime.messages;
create policy "office street: members receive" on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'office-street' and realtime.messages.extension = 'broadcast' and public.office_is_member());

drop policy if exists "office street: members send" on realtime.messages;
create policy "office street: members send" on realtime.messages
  for insert to authenticated
  with check (realtime.topic() = 'office-street' and realtime.messages.extension = 'broadcast' and public.office_is_member());
