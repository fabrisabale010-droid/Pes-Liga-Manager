import { flag, esc, nameOf, openModal, cup, crest } from './ui.js';
import { mainColorOf } from '../domain/teams.js';
import { table, tieWinner, roundName, groupTable } from '../domain/engine.js';
import { tournaments } from '../core/store.js';
import { TITLES_BEFORE_APP } from '../config.js';

/* ---------- Tabla de posiciones ---------- */

export function standingsTable(rows, { qualify = 0 } = {}) {
  if (!rows.length) return '';
  return `<div class="table-scroll"><table class="standings">
    <thead><tr>
      <th class="sticky-l">Selección</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th class="sticky-r">Pts</th>
    </tr></thead>
    <tbody>${rows.map((r, i) => `
      <tr class="${i === 0 ? 'lead' : ''}">
        <td class="sticky-l" style="border-left:3px solid ${mainColorOf(r.id)}">
          <span class="side ${qualify && i < qualify ? 'q' : ''}" data-team="${r.id}">
            <span class="rank">${i + 1}</span>${flag(r.id)}<span class="nm">${esc(nameOf(r.id))}</span>
          </span>
        </td>
        <td class="num">${r.pj}</td><td class="num">${r.pg}</td><td class="num">${r.pe}</td>
        <td class="num">${r.pp}</td><td class="num">${r.gf}</td><td class="num">${r.gc}</td>
        <td class="num">${r.dg > 0 ? '+' : ''}${r.dg}</td>
        <td class="pts sticky-r">${r.pts}</td>
      </tr>`).join('')}
    </tbody></table></div>`;
}

/* ---------- Partidos ---------- */

export function gameRow(m, { editable = false, kind = 'game' } = {}) {
  const done = m.played;
  const homeWin = done && m.hg > m.ag;
  const awayWin = done && m.ag > m.hg;
  return `<div class="game ${done ? 'done' : ''}">
    <span class="t ${homeWin ? 'win' : ''}">${flag(m.home)}<span>${esc(nameOf(m.home))}</span></span>
    <span class="mark">
      ${editable
        ? `<input class="score" type="number" min="0" inputmode="numeric" value="${m.hg ?? ''}" placeholder="–" data-score="${kind}:${m.id}:hg">
           <input class="score" type="number" min="0" inputmode="numeric" value="${m.ag ?? ''}" placeholder="–" data-score="${kind}:${m.id}:ag">`
        : `<span class="score" style="display:grid;place-items:center">${m.hg ?? '–'}</span>
           <span class="score" style="display:grid;place-items:center">${m.ag ?? '–'}</span>`}
    </span>
    <span class="t away ${awayWin ? 'win' : ''}">${flag(m.away)}<span>${esc(nameOf(m.away))}</span></span>
  </div>`;
}

export function penaltyPicker(m, kind) {
  if (m.bye || !m.played || m.hg !== m.ag || m.penWinner) return '';
  return `<div class="pens">Empataron. ¿Quién pasó por penales?
    <div class="row">
      <button class="btn sm" data-pen="${kind}:${m.id}:${m.home}">${flag(m.home)} ${esc(nameOf(m.home))}</button>
      <button class="btn sm" data-pen="${kind}:${m.id}:${m.away}">${flag(m.away)} ${esc(nameOf(m.away))}</button>
    </div></div>`;
}

/* ---------- Llaves ---------- */

export function bracketView(t) {
  const b = t.bracket;
  if (!b) return '';
  const byRound = {};
  b.games.forEach(m => (byRound[m.round] ||= []).push(m));

  const cols = Object.keys(byRound).sort((a, c) => a - c).map(r => `
    <div class="round">
      <div class="round-name">${roundName(Number(r), b.rounds)}</div>
      ${byRound[r].sort((a, c) => a.pos - c.pos).map(m => {
        const w = tieWinner(m);
        if (m.bye) {
          const who = m.home || m.away;
          return `<div class="tie"><div class="l win"><span>${flag(who)} ${esc(nameOf(who))}</span><b>pasa</b></div></div>`;
        }
        if (!m.home || !m.away) {
          return `<div class="tie"><div class="l"><span>Por definirse</span></div></div>`;
        }
        return `<div class="tie">
          <div class="l ${w === m.home ? 'win' : ''}"><span>${flag(m.home)} ${esc(nameOf(m.home))}</span><b>${m.hg ?? '–'}</b></div>
          <div class="l ${w === m.away ? 'win' : ''}"><span>${flag(m.away)} ${esc(nameOf(m.away))}</span><b>${m.ag ?? '–'}</b></div>
        </div>`;
      }).join('')}
    </div>`).join('');

  return `<div class="bracket">${cols}</div>`;
}

/* ---------- Grupos ---------- */

export function groupsView(t) {
  return t.groups.map(g => `
    <div style="margin-bottom:16px">
      <div class="fixture-head">Grupo ${g.label}</div>
      ${standingsTable(groupTable(t, g.label), { qualify: t.groupsConfig.advance })}
    </div>`).join('');
}

/* ---------- Ficha rápida de una selección ---------- */

export function titlesCount() {
  const count = { ...TITLES_BEFORE_APP };
  tournaments().forEach(t => {
    if (t.finished && t.champion) count[t.champion] = (count[t.champion] || 0) + 1;
  });
  return count;
}

export function openTeamCard(id) {
  let pj = 0, pts = 0, played = 0;
  tournaments().forEach(t => {
    if (!t.teamIds.includes(id)) return;
    played++;
    const row = table(t.teamIds, t.games).find(r => r.id === id);
    if (row) { pj += row.pj; pts += row.pts; }
  });
  const titles = titlesCount()[id] || 0;

  openModal(`
    <div>${crest(id, 112)}</div>
    <h3>${esc(nameOf(id))}</h3>
    <div class="grid-2">
      <div class="stat"><b>${played}</b><span>torneos jugados</span></div>
      <div class="stat"><b>${titles}</b><span>títulos ${titles ? '' : 'todavía'}</span></div>
      <div class="stat"><b>${pj}</b><span>partidos</span></div>
      <div class="stat"><b>${pts}</b><span>puntos sumados</span></div>
    </div>`);
}

/* Se engancha una sola vez y sirve para cualquier tabla de la app. */
export function enableTeamCards() {
  document.addEventListener('click', e => {
    const hit = e.target.closest('[data-team]');
    if (hit) openTeamCard(hit.dataset.team);
  });
}
