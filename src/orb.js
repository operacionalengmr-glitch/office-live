// Crystal orb in the bosses' lounge: click it to open a chat box that talks to an AI through the Supabase
// function supabase/functions/orb-chat (the API key stays there). Text only for now; the conversation lives
// in memory (lost on reload) and only the last turns are sent, to keep each request small.
// Base for more later: the function takes a `mode`, and each mode can get its own prompt, tools or data.
import { ORB } from './art.js';
import * as Live from './supabase.js';
import { esc } from './ui.js';

const $ = s => document.querySelector(s);
const SEND_TURNS = 12; // must match MAX_TURNS in the function (extra turns are dropped there anyway)
const history = [];    // [{ role: 'user' | 'model', text }]
let busy = false;

export const overOrb = (x, y) => { const b = ORB.box; return b && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h; };

export function open() {
  ORB.open = true; $('#orbChat').hidden = false; render();
  $('#orbChat textarea').focus();
}
export function close() { ORB.open = false; $('#orbChat').hidden = true; }
export const toggle = () => (ORB.open ? close() : open());

// tiny markdown: **bold**, *italic*, `code`, line breaks (after escaping)
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>');

function render(error) {
  const log = $('#orbChat .log');
  log.innerHTML = (history.length ? '' : '<li class="hint">Pergunte qualquer coisa à esfera…</li>')
    + history.map(m => `<li class="${m.role}">${md(m.text)}</li>`).join('')
    + (busy ? '<li class="model wait"><span></span><span></span><span></span></li>' : '')
    + (error ? `<li class="err">${esc(error)}</li>` : '');
  log.scrollTop = log.scrollHeight;
  $('#orbChat button[type=submit]').disabled = busy;
}

async function send(text) {
  history.push({ role: 'user', text });
  busy = true; render();
  let error;
  try {
    const { reply } = await Live.askOrb(history.slice(-SEND_TURNS));
    history.push({ role: 'model', text: reply });
  } catch (err) {
    history.pop(); // let them try again with the same question
    $('#orbChat textarea').value = text;
    error = /fetch|network|send a request/i.test(err.message) ? 'A esfera não respondeu (sem conexão?)' : err.message;
  }
  busy = false; render(error);
}

export function initOrb() {
  const box = $('#orbChat'), form = box.querySelector('form'), ta = form.querySelector('textarea');
  box.querySelector('.x').addEventListener('click', close);
  box.querySelector('[data-a=clear]').addEventListener('click', () => { history.length = 0; render(); ta.focus(); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = ta.value.trim();
    if (!text || busy) return;
    ta.value = ''; send(text);
  });
  ta.addEventListener('keydown', e => { // Enter sends, Shift+Enter breaks the line, Esc closes
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    if (e.key === 'Escape') close();
  });
  render();
}
