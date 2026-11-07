// Orb chat: the crystal ball in the bosses' lounge (src/orb.js) talks to an AI through this function, so the
// API key stays in Supabase and never reaches the browser. The model is NVIDIA's Nemotron 3 Ultra (secret
// NVIDIA_API_KEY, text only); without that secret it falls back to Gemini (secret GEMINI_API_KEY).
//
// Request:  POST { mode?: 'chat', messages: [{ role: 'user' | 'model', text }] }
// Response: { reply: string, model: string }  or  { error: string } with a 4xx/5xx status
//
// Only signed-in, confirmed @engmr.com.br accounts can use it (same rule as the rest of the game), and each
// request is trimmed (last turns, characters per message) to keep the free quota and the function light.
// New features go in MODES: each mode picks its own system prompt (and later tools, data, another model...).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import FALLBACK from './prompt.ts'; // copy of orb-prompt.txt from the last deploy (tools/build_orb_prompt.py)

const DOMAIN = '@engmr.com.br';
const MAX_TURNS = 12;        // past messages sent to the model
const MAX_CHARS = 2000;      // per message
const PER_MINUTE = 10;       // requests per user per minute (per function instance; a soft brake, not a quota)

// The orb's personality is orb-prompt.txt at the root of the public repo: edit it on GitHub and, a few minutes
// after the commit reaches main, the orb uses it (no redeploy). If GitHub can't be reached, the last good copy
// (or the one bundled at deploy time) is used.
const PROMPT_URL = 'https://raw.githubusercontent.com/operacionalengmr-glitch/office-live/main/orb-prompt.txt';
const PROMPT_TTL = 5 * 60_000;
let prompt = { text: FALLBACK.trim(), at: 0 };
async function systemPrompt() {
  if (Date.now() - prompt.at < PROMPT_TTL) return prompt.text;
  prompt.at = Date.now(); // also on failure, so a GitHub outage doesn't slow every request
  try {
    const r = await fetch(PROMPT_URL, { signal: AbortSignal.timeout(3000) });
    const text = r.ok ? (await r.text()).trim() : '';
    if (text) prompt.text = text; else console.warn('orb-chat prompt', r.status);
  } catch (err) { console.warn('orb-chat prompt', err); }
  return prompt.text;
}

const MODES: Record<string, { system: () => Promise<string>; maxTokens: number }> = {
  chat: { system: systemPrompt, maxTokens: 1024 },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const hits = new Map<string, number[]>();
function limited(user: string) {
  const now = Date.now(), list = (hits.get(user) || []).filter(t => now - t < 60_000);
  list.push(now); hits.set(user, list);
  return list.length > PER_MINUTE;
}

type Msg = { role: 'user' | 'model'; text: string };

// NVIDIA's API is OpenAI-compatible. Nemotron is a reasoning model: if its thinking comes back inside the
// answer (<think>…</think>), it's cut out, and the token budget leaves room for it.
async function nemotron(mode: { system: () => Promise<string>; maxTokens: number }, messages: Msg[], key: string) {
  const model = Deno.env.get('NVIDIA_MODEL') || 'nvidia/nemotron-3-ultra-550b-a55b';
  const r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: await mode.system() }, ...messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text }))],
      max_tokens: mode.maxTokens * 4, temperature: 0.8,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.detail || data?.error?.message || data?.error || `HTTP ${r.status}`;
    throw Object.assign(new Error(String(msg)), { status: r.status === 429 ? 429 : 502 });
  }
  const text = String(data?.choices?.[0]?.message?.content || '');
  const reply = text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/^[\s\S]*<\/think>/, '').trim();
  return { reply: reply || '(a esfera ficou em silêncio)', model };
}

async function gemini(mode: { system: () => Promise<string>; maxTokens: number }, messages: Msg[]) {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY não configurada no Supabase');
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: await mode.system() }] },
      contents: messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
      generationConfig: { maxOutputTokens: mode.maxTokens, temperature: 0.8 },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data?.error?.message || `HTTP ${r.status}`;
    throw Object.assign(new Error(msg), { status: r.status === 429 ? 429 : 502 });
  }
  const reply = (data?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('').trim();
  return { reply: reply || '(a esfera ficou em silêncio)', model };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'use POST' }, 405);

  // who is asking: the user's own session token, checked by Supabase Auth
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: { user } } = token ? await sb.auth.getUser(token) : { data: { user: null } };
  if (!user || !user.email_confirmed_at || !user.email?.toLowerCase().endsWith(DOMAIN))
    return json({ error: 'Conecte ao ponto (@engmr.com.br) para falar com a esfera' }, 401);
  if (limited(user.id)) return json({ error: 'Calma! A esfera precisa respirar. Tente de novo em um minuto.' }, 429);

  let body: { mode?: string; messages?: Msg[] };
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const mode = MODES[body.mode || 'chat'];
  if (!mode) return json({ error: 'modo desconhecido' }, 400);
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter(m => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string' && m.text.trim())
    .slice(-MAX_TURNS)
    .map(m => ({ role: m.role, text: m.text.slice(0, MAX_CHARS) }));
  while (messages.length && messages[0].role !== 'user') messages.shift(); // the conversation starts with the user
  if (!messages.length || messages[messages.length - 1].role !== 'user') return json({ error: 'faltou a pergunta' }, 400);

  try {
    const nvidia = Deno.env.get('NVIDIA_API_KEY');
    const res = await (nvidia ? nemotron(mode, messages, nvidia) : gemini(mode, messages));
    console.log('orb-chat answered by', res.model); // shows in the function logs which model is live
    return json(res);
  }
  catch (err) {
    console.error('orb-chat', err);
    return json({ error: (err as Error).message }, (err as { status?: number }).status || 500);
  }
});
