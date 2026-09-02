import { flag, esc, nameOf } from '../ui/ui.js';
import { titlesCount } from '../ui/parts.js';
import { state } from '../core/store.js';
import { table } from '../domain/engine.js';
import { TITLES_BEFORE_APP } from '../config.js';

let filter = 'todo';

const FILTERS = [
  { id:'todo',   label:'Todo' },
  { id:'liga',   label:'Ligas' },
  { id:'copa',   label:'Copas' },
  { id:'previo', label:'Antes de la app' }
];

export function renderShowcase(view) {
  view.innerHTML = `
    <section class="block">
      <h2><i class="ti ti-trophy"></i>Vitrina</h2>
      <p class="block-note">Las ligas y las copas se cuentan por separado, más los títulos que ya existían antes de la app.</p>
      <div class="opts stack">
        ${FILTERS.map(f => `<button class="opt ${filter === f.id ? 'on' : ''}" data-filter="${f.id}">${f.label}</button>`).join('')}
      </div>
      ${cabinet()}
    </section>
    ${records()}`;

  view.querySelector('.opts').addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    filter = btn.dataset.filter;
    renderShowcase(view);
  });
}

function counts() {
  if (filter === 'previo') return { ...TITLES_BEFORE_APP };
  const out = filter === 'todo' ? { ...TITLES_BEFORE_APP } : {};
  state.tournaments.forEach(t => {
    if (!t.finished || !t.champion) return;
    const isCup = t.format === 'copa';
    if (filter === 'liga' && isCup) return;
    if (filter === 'copa' && !isCup) return;
    out[t.champion] = (out[t.champion] || 0) + 1;
  });
  return out;
}

function cabinet() {
  const list = Object.entries(counts()).sort((a, b) => b[1] - a[1]);
  if (!list.length) {
    return `<div class="empty"><i class="ti ti-trophy-off"></i>
      <strong>Vitrina vacía</strong>Todavía nadie ganó un torneo de este tipo.</div>`;
  }
  const best = list[0][1];
  return `<div class="cabinet">${list.map(([id, n]) => `
    <div class="slot ${n === best ? 'top' : ''}">
      <span class="fl">${flag(id)}</span>
      <div class="nm">${esc(nameOf(id))}</div>
      <div class="n">${n}<i class="ti ti-trophy"></i></div>
      <div class="u">${n === 1 ? 'título' : 'títulos'}</div>
    </div>`).join('')}</div>`;
}

/* ---------- Récords ---------- */

function records() {
  const done = state.tournaments.filter(t => t.finished);
  if (!done.length) return '';

  const totals = new Map();
  let biggest = null, goals = 0, games = 0;

  state.tournaments.forEach(t => {
    table(t.teamIds, t.games).forEach(r => {
      const acc = totals.get(r.id) || { id: r.id, pj: 0, pts: 0, gf: 0, gc: 0 };
      acc.pj += r.pj; acc.pts += r.pts; acc.gf += r.gf; acc.gc += r.gc;
      totals.set(r.id, acc);
    });
    t.games.forEach(m => {
      if (!m.played) return;
      games++; goals += m.hg + m.ag;
      const gap = Math.abs(m.hg - m.ag);
      if (!biggest || gap > biggest.gap) biggest = { m, gap };
    });
  });

  const rows = [...totals.values()].filter(r => r.pj > 0);
  if (!rows.length) return '';

  const most = Object.entries(titlesCount()).sort((a, b) => b[1] - a[1])[0];
  const attack = [...rows].sort((a, b) => b.gf / b.pj - a.gf / a.pj)[0];
  const wall = [...rows].sort((a, b) => a.gc / a.pj - b.gc / b.pj)[0];

  const line = (label, value) =>
    `<div class="log-item"><div class="log-head" style="cursor:default">
       <div class="grow"><div class="nm">${value}</div><div class="sub">${label}</div></div>
     </div></div>`;

  return `<section class="block">
    <h2><i class="ti ti-chart-bar"></i>Récords</h2>
    <p class="block-note">Lo que dejaron ${games} partidos y ${goals} goles.</p>
    <div class="log">
      ${most ? line('Más títulos', `${flag(most[0])} ${esc(nameOf(most[0]))} · ${most[1]}`) : ''}
      ${line('Mejor ataque por partido', `${flag(attack.id)} ${esc(nameOf(attack.id))} · ${(attack.gf / attack.pj).toFixed(2)}`)}
      ${line('Valla menos vencida', `${flag(wall.id)} ${esc(nameOf(wall.id))} · ${(wall.gc / wall.pj).toFixed(2)}`)}
      ${biggest ? line('Goleada más grande',
        `${flag(biggest.m.home)} ${esc(nameOf(biggest.m.home))} ${biggest.m.hg}–${biggest.m.ag} ${esc(nameOf(biggest.m.away))} ${flag(biggest.m.away)}`) : ''}
      ${line('Promedio de goles por partido', (goals / Math.max(1, games)).toFixed(2))}
    </div>
  </section>`;
}
