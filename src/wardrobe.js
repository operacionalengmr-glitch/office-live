// Panels of the Resenha bar: the wardrobe (pick your class, see its stats and skills) and the host's sparring
// offer. Plain DOM over the canvas; while one is open the walker doesn't move.
import { CLASSES, EL_NAME, rankToNext, debug } from './rpg.js';

let root = null, onClose = null;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TARGET = { one: 'Um alvo', around: 'Alvo + perto', all: 'Todos', line: 'Linha', self: 'Você' };
const STATS = [['hp', 'Vida'], ['mp', 'MP'], ['atk', 'Ataque'], ['def', 'Defesa'], ['agi', 'Agilidade'], ['mag', 'Magia']];

export const isOpen = () => !!root && !root.hidden;
export function closeUi() { if (!root || root.hidden) return; root.hidden = true; root.innerHTML = ''; const f = onClose; onClose = null; f?.(); }
function open(html, cls) {
  if (!root) {
    root = document.createElement('div'); root.id = 'dunUi'; document.body.appendChild(root);
    root.addEventListener('mousedown', e => { if (e.target === root) closeUi(); });
    addEventListener('keydown', e => { if (isOpen() && e.code === 'Escape') { e.stopPropagation(); closeUi(); } }, true);
  }
  root.className = cls; root.innerHTML = `<div class="box">${html}<button class="x" aria-label="Fechar">✕</button></div>`; root.hidden = false;
  root.querySelector('.x').onclick = closeUi;
}

/* ---------------- wardrobe ---------------- */
export function openWardrobe(hero, onPick) {
  let sel = hero.clsId;
  const render = () => {
    const c = CLASSES.find(k => k.id === sel), job = hero.jobs[c.id] || { rank: 1, xp: 0 }, worn = c.id === hero.clsId, unlock = debug.unlockAll;
    const list = CLASSES.map(k => `<button data-id="${k.id}" class="${k.id === sel ? 'on' : ''}${k.id === hero.clsId ? ' worn' : ''}"><i style="background:${k.color}"></i><b>${esc(k.name)}</b><small>${esc(k.weapon.name)} · rank ${(hero.jobs[k.id] || { rank: 1 }).rank}</small></button>`).join('');
    const stats = STATS.map(([k, n]) => { const v = c.mods[k]; return `<div class="st"><span>${n}</span><em><i style="width:${Math.round(Math.min(1, (v - 0.6) / 0.9) * 100)}%;background:${v >= 1.15 ? '#7dff9a' : v <= 0.9 ? '#ff9f80' : '#f2c14e'}"></i></em></div>`; }).join('');
    const skills = c.skills.map(s => { const locked = !unlock && s.rank > job.rank; return `<li class="${locked ? 'lock' : ''}"><span class="rk">R${s.rank}</span><div><b>${esc(s.name)}</b><small>${s.el ? EL_NAME[s.el] + ' · ' : ''}${TARGET[s.target]}${s.hits ? ` · ${s.hits}×` : ''}</small><p>${esc(s.desc)}</p></div><span class="mp">${s.mp} MP</span></li>`; }).join('');
    open(`<h3>👔 Guarda-roupa <small>troque de classe · as roupas continuam as mesmas por enquanto</small></h3>
      <div class="wr"><nav>${list}</nav><section>
        <div class="hd"><i style="background:${c.color}"></i><div><h4>${esc(c.name)}</h4><small>Arma: <b>${esc(c.weapon.name)}</b> · Rank ${job.rank} <em class="bar"><i style="width:${Math.round(job.xp / rankToNext(job.rank) * 100)}%"></i></em></small></div></div>
        <p class="ds">${esc(c.desc)}</p><div class="stats">${stats}</div><ul class="sk">${skills}</ul>
        <div class="ft"><label><input type="checkbox" ${unlock ? 'checked' : ''}> Liberar todas as habilidades (debug)</label><button class="go" ${worn ? 'disabled' : ''}>${worn ? 'Em uso' : 'Vestir ' + esc(c.name)}</button></div>
      </section></div>`, 'wardrobe');
    root.querySelectorAll('nav button').forEach(b => { b.onclick = () => { sel = b.dataset.id; render(); }; });
    root.querySelector('.ft input').onchange = e => { debug.unlockAll = e.target.checked; render(); };
    const go = root.querySelector('.go'); if (!worn) go.onclick = () => { hero.setClass(c.id); onPick?.(c); render(); };
    root.querySelector('nav .on')?.scrollIntoView({ block: 'nearest' });
  };
  render();
}

/* ---------------- the host: sparring ---------------- */
export function openHost(hero, onSpar) {
  let level = Math.max(1, Math.min(6, Math.ceil(hero.level / 2)));
  const render = () => {
    open(`<h3>🍸 Anfitrião</h3><p class="say">"E aí, ${esc(hero.cls.name.toLowerCase())}! Quer esquentar no tatame antes de descer? É só treino: se apagar, eu te levanto. Vale XP e rank da classe."</p>
      <div class="lvl">Força dos delinquentes <button data-d="-1">−</button><b>${level}</b><button data-d="1">+</button></div>
      <div class="opts"><button data-n="1">🥊 1 delinquente</button><button data-n="2">🥊 2 delinquentes</button><button data-n="3">🥊 3 delinquentes</button></div>
      <small class="tip">Vida e MP voltam cheios depois de cada treino.</small>`, 'host');
    root.querySelectorAll('[data-d]').forEach(b => { b.onclick = () => { level = Math.max(1, Math.min(9, level + +b.dataset.d)); render(); }; });
    root.querySelectorAll('[data-n]').forEach(b => { b.onclick = () => { closeUi(); onSpar(+b.dataset.n, level); }; });
  };
  render();
}
