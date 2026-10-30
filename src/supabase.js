// Live statuses from the "ponto" Supabase project (the timesheet app).
// Sign in with the same e-mail/password as the timesheet; the game then polls
// public.office_presence(), a read-only function that only returns each character's
// status, since and the running timer's project + task (no history or hours).
// Only confirmed @engmr.com.br accounts get data; the email -> character map stays in Supabase.
// The client library is loaded lazily so the game still runs (demo mode) offline.
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const URL = 'https://wfkypsbbfbtpsxlufozo.supabase.co';
const KEY = 'sb_publishable_6qKuHStezjK4YauR7DgsAQ_FGEn43re'; // publishable key: safe in the browser, RLS applies
export const POLL_MS = 20000;

let clientP = null;
const client = () => (clientP ||= import(CDN).then(m => m.createClient(URL, KEY)));

export async function currentUser() {
  const { data } = await (await client()).auth.getSession();
  return data.session?.user || null;
}

export async function signIn(email, password) {
  const { data, error } = await (await client()).auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export const signOut = async () => (await client()).auth.signOut();

// the signed-in account's character id (public.office_me, supabase/office_me.sql), or null
export async function whoAmI() {
  const { data, error } = await (await client()).rpc('office_me');
  if (error) throw error;
  return data || null;
}

/* ---------- office TV (supabase/office_tv.sql) ----------
   Anyone can read the shared queue; only signed-in @engmr.com.br accounts can change it. */
// -> { now, can_edit, state: { entry_id, video_id, title, added_by, started_at, paused_pos }, queue: [{ id, video_id, title, added_by }] }
export async function tvGet() {
  const { data, error } = await (await client()).rpc('office_tv_get');
  if (error) throw error;
  return data;
}
// fn: 'add' | 'skip' | 'pause' | 'play' | 'remove' | 'clear'
export async function tvCall(fn, args) {
  const { error } = await (await client()).rpc('office_tv_' + fn, args);
  if (error) throw error;
}
// every TV change touches the single office_tv_state row
export async function tvSubscribe(onChange, onStatus) {
  return (await client()).channel('office-tv')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'office_tv_state' }, onChange)
    .subscribe(onStatus);
}

/* ---------- street multiplayer (supabase/office_street.sql) ----------
   Private broadcast channel: only confirmed @engmr.com.br accounts can join or send. Nothing is stored. */
export async function streetJoin(onMessage) {
  const sb = await client();
  const { data } = await sb.auth.getSession();
  if (!data.session) throw new Error('not signed in');
  sb.realtime.setAuth(data.session.access_token); // private channels are authorised with the user's token
  const ch = sb.channel('office-street', { config: { private: true, broadcast: { self: false } } });
  ch.on('broadcast', { event: 'pos' }, ({ payload }) => onMessage(payload))
    .on('broadcast', { event: 'bye' }, ({ payload }) => onMessage({ ...payload, bye: true }));
  await new Promise((resolve, reject) => ch.subscribe(st => {
    if (st === 'SUBSCRIBED') resolve();
    else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') reject(new Error('street channel: ' + st));
  }));
  return {
    send: (event, payload) => ch.send({ type: 'broadcast', event, payload }),
    leave: () => sb.removeChannel(ch),
  };
}

// -> [{ id (game character), status: 'working'|'break'|'offline', since: Date|null, project: { name, client, color, task }|null }]
// project/task come from the running timer only (task = the timer's description).
export async function fetchPresence() {
  const { data, error } = await (await client()).rpc('office_presence');
  if (error) throw error;
  return data.map(r => ({
    id: r.game_id, status: r.status, since: r.since ? new Date(r.since) : null,
    project: r.project_name || r.task
      ? { name: r.project_name || 'Sem projeto', client: r.project_client || '', color: r.project_color || '#8ab4ff', task: r.task || '' }
      : null,
  }));
}
