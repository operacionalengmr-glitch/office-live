-- Which character is the signed-in account? Used to let you (and only you) walk out of the office door
-- while your timer is paused. Same account check as office_presence(); returns null for anyone else.
create or replace function public.office_me() returns text
language sql stable security definer set search_path = public as $$
  select oc.game_id
  from auth.users u join office_characters oc on oc.email = lower(u.email)
  where u.id = auth.uid() and u.email_confirmed_at is not null and lower(u.email) like '%@engmr.com.br';
$$;

revoke all on function public.office_me() from public, anon;
grant execute on function public.office_me() to authenticated;
