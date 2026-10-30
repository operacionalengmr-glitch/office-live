-- Office TV: a shared YouTube queue that plays on the TV for everyone who has the game open.
-- Anyone can watch (read); only confirmed @engmr.com.br accounts can change it, through the functions below.
-- Clients subscribe to office_tv_state over Realtime; every change (queue included) touches that row,
-- then they call office_tv_get() for the whole picture plus the server clock to stay in sync.

create table if not exists public.office_tv_queue (
  id bigint generated always as identity primary key,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text check (char_length(title) <= 200),
  added_by text,
  added_at timestamptz not null default now()
);

create table if not exists public.office_tv_state (
  id int primary key default 1 check (id = 1),
  entry_id bigint,             -- queue entry now on the TV (it leaves the queue when it starts)
  video_id text,
  title text,
  added_by text,
  started_at timestamptz,      -- when position 0 was (or would have been) while playing
  paused_pos double precision, -- seconds in; not null = paused
  updated_at timestamptz not null default now()
);
insert into public.office_tv_state (id) values (1) on conflict do nothing;

alter table public.office_tv_queue enable row level security;
alter table public.office_tv_state enable row level security;
drop policy if exists "tv state is public" on public.office_tv_state;
create policy "tv state is public" on public.office_tv_state for select to anon, authenticated using (true);
-- no write policies: writes only go through the security definer functions

alter publication supabase_realtime add table public.office_tv_state;

-- who is calling: game character id, or null if not allowed to control the TV
create or replace function public.office_tv_caller() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(oc.game_id, split_part(lower(u.email), '@', 1))
  from auth.users u left join office_characters oc on oc.email = lower(u.email)
  where u.id = auth.uid() and u.email_confirmed_at is not null and lower(u.email) like '%@engmr.com.br';
$$;

create or replace function public.office_tv_guard() returns text
language plpgsql stable security definer set search_path = public as $$
declare who text := office_tv_caller();
begin
  if who is null then raise exception 'not allowed' using errcode = '42501'; end if;
  return who;
end $$;

-- move the next queued video onto the TV (or switch it off when the queue is empty)
create or replace function public.office_tv_advance() returns void
language plpgsql security definer set search_path = public as $$
declare q office_tv_queue;
begin
  select * into q from office_tv_queue order by id limit 1;
  if found then
    delete from office_tv_queue where id = q.id;
    update office_tv_state set entry_id = q.id, video_id = q.video_id, title = q.title, added_by = q.added_by,
      started_at = now(), paused_pos = null, updated_at = now() where id = 1;
  else
    update office_tv_state set entry_id = null, video_id = null, title = null, added_by = null,
      started_at = null, paused_pos = null, updated_at = now() where id = 1;
  end if;
end $$;

create or replace function public.office_tv_get() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'now', now(),
    'can_edit', office_tv_caller() is not null,
    'state', (select row_to_json(s) from office_tv_state s where id = 1),
    'queue', coalesce((select json_agg(q order by q.id) from office_tv_queue q), '[]'::json));
$$;

create or replace function public.office_tv_add(p_video_id text, p_title text default null) returns void
language plpgsql security definer set search_path = public as $$
declare who text := office_tv_guard();
begin
  if (select count(*) from office_tv_queue) >= 50 then raise exception 'queue is full'; end if;
  insert into office_tv_queue (video_id, title, added_by) values (p_video_id, left(nullif(btrim(p_title), ''), 200), who);
  if (select video_id from office_tv_state where id = 1) is null then perform office_tv_advance();
  else update office_tv_state set updated_at = now() where id = 1; end if;
end $$;

-- p_entry: the entry the caller thinks is playing, so several viewers hitting "ended" at once skip only one video
create or replace function public.office_tv_skip(p_entry bigint default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform office_tv_guard();
  if p_entry is null or p_entry = (select entry_id from office_tv_state where id = 1) then perform office_tv_advance(); end if;
end $$;

create or replace function public.office_tv_pause() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform office_tv_guard();
  update office_tv_state set paused_pos = greatest(0, extract(epoch from now() - started_at)), updated_at = now()
  where id = 1 and video_id is not null and paused_pos is null;
end $$;

create or replace function public.office_tv_play() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform office_tv_guard();
  update office_tv_state set started_at = now() - make_interval(secs => paused_pos), paused_pos = null, updated_at = now()
  where id = 1 and paused_pos is not null;
end $$;

create or replace function public.office_tv_remove(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform office_tv_guard();
  delete from office_tv_queue where id = p_id;
  update office_tv_state set updated_at = now() where id = 1;
end $$;

create or replace function public.office_tv_clear() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform office_tv_guard();
  delete from office_tv_queue;
  update office_tv_state set updated_at = now() where id = 1;
end $$;

revoke all on function public.office_tv_caller(), public.office_tv_guard(), public.office_tv_advance() from public, anon, authenticated;
revoke all on function public.office_tv_add(text, text), public.office_tv_skip(bigint), public.office_tv_pause(),
  public.office_tv_play(), public.office_tv_remove(bigint), public.office_tv_clear() from public, anon;
grant execute on function public.office_tv_add(text, text), public.office_tv_skip(bigint), public.office_tv_pause(),
  public.office_tv_play(), public.office_tv_remove(bigint), public.office_tv_clear() to authenticated;
grant execute on function public.office_tv_get() to anon, authenticated;
