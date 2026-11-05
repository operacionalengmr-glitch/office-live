-- Office TV shortcut: in "Conectar ao ponto", leave the e-mail empty and type the PIN as the password.
-- The PIN is stored only as a bcrypt hash in a private table, never in the (public) code. A correct PIN returns
-- exactly what office_presence() returns for the account in office_pin.as_user: read-only live statuses.
-- It is not a real sign-in, so the TV controls and the street still need a normal e-mail login.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.office_pin (
  id int primary key default 1 check (id = 1),           -- a single PIN
  pin_hash text not null,
  as_user uuid not null references auth.users(id) on delete cascade
);
alter table public.office_pin enable row level security;  -- no policies: nobody can read it through the API
revoke all on public.office_pin from anon, authenticated;

-- -> same json rows as office_presence(), or null when the PIN is wrong
create or replace function public.office_presence_pin(pin text) returns json
language plpgsql volatile security definer set search_path = public, extensions as $$
declare uid uuid;
begin
  select as_user into uid from office_pin where pin_hash = crypt(pin, pin_hash);
  if uid is null then return null; end if;
  -- run office_presence() as that account (auth.uid() reads these settings); local to this call
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  return coalesce((select json_agg(p) from public.office_presence() p), '[]'::json);
end $$;

revoke all on function public.office_presence_pin(text) from public;
grant execute on function public.office_presence_pin(text) to anon, authenticated;

-- Set or change the PIN (replace both placeholders; the account must be a confirmed @engmr.com.br one):
-- insert into public.office_pin (pin_hash, as_user)
-- values (extensions.crypt('SEU_PIN', extensions.gen_salt('bf')),
--         (select id from auth.users where lower(email) = 'voce@engmr.com.br'))
-- on conflict (id) do update set pin_hash = excluded.pin_hash, as_user = excluded.as_user;
