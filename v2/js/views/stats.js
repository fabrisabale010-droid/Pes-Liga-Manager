import { flag, esc, nameOf } from '../ui/ui.js';
import { mainColorOf, TEAMS } from '../domain/teams.js';
import { crunch, byPoints, byAverage, byTitles, years, headToHead } from '../domain/stats.js';
import { state } from '../core/store.js';
import { isAdmin } from '../core/auth.js';
import { say, sayUndo, cheer } from '../ui/ui.js';
import * as Annual from '../domain/annual.js';

let tab = 'puntos';
let year = null;          // null = toda la historia
let duoA = 'BRA', duoB = 'ARG';

const TABS = [
  { id:'puntos',   label:'Puntos' },
  { id:'promedio', label:'Promedio' },
  { id:'titulos',  label:'Títulos' },
  { id:'duelo',    label:'Cara a cara' },
  { id:'anual',    label:'Copa Anual' }
];

export function renderStats(view) {
  const paint = () => {
    view.innerHTML = html();
    wire(view, paint);
  };

  view.addEventListener('click', e => {
    const t = e.target.closest('[data-tab]');
    if (t) {
      tab = t.dataset.tab;
      if (tab === 'anual' && year === null) year = years()[0] ?? null;
      return paint();
    }
    const y = e.target.closest('[data-year]');
    if (y) { year = y.dataset.year === 'todo' ? null : Number(y.dataset.year); return paint(); }
    if (annualClicks(e, paint)) return;
  });

  paint();
}

/* ---------- Copa Anual ---------- */

function anual() {
  const y = year ?? years()[0];
  if (!y) return `<div class="empty"><i class="ti ti-calendar-off"></i>
    <strong>Todavía no hay años para cerrar</strong>Jugá el primer torneo.</div>`;

  const cup = Annual.cupOf(y);
  if (cup) {
    return `<div class="plaque">
      <div class="plaque-in">
        <i class="ti ti-trophy cup"></i>
        <div class="kicker">Copa Anual ${y}</div>
        <div class="who">${esc(nameOf(cup.champion))}</div>
        <span class="flag-xl">${flag(cup.champion)}</span>
      </div>
    </div>
    ${isAdmin() ? `<div style="text-align:center;margin-top:12px">
      <button class="btn danger sm" data-cup-del="${cup.id}">Borrar la Copa Anual ${y}</button>
    </div>` : ''}`;
  }

  const draft = Annual.draftOf(y);
  if (draft) return enCurso(draft, y);

  const cross = Annual.matchup(y);
  if (!cross) return `<div class="empty"><i class="ti ti-calendar-off"></i>
    <strong>Falta jugar más en ${y}</strong>
    Hacen falta al menos dos selecciones con partidos y un campeón para armar el cruce.</div>`;

  const explica =
    cross.kind === 'repechaje'
      ? `${flag(cross.espera)} <b>${esc(nameOf(cross.espera))}</b> lidera los puntos y los títulos de ${y}, así que espera en la final.
         ${flag(cross.duelo[0])} ${esc(nameOf(cross.duelo[0]))} y ${flag(cross.duelo[1])} ${esc(nameOf(cross.duelo[1]))} definen quién lo enfrenta.`
      : cross.kind === 'barrida'
        ? `${flag(cross.lider)} <b>${esc(nameOf(cross.lider))}</b> ganó todos los torneos de ${y} y además sumó más puntos.
           Lo enfrenta ${flag(cross.rival)} <b>${esc(nameOf(cross.rival))}</b>, el segundo en puntos.`
        : `${flag(cross.final[0])} <b>${esc(nameOf(cross.final[0]))}</b> sumó más puntos en ${y} y
           ${flag(cross.final[1])} <b>${esc(nameOf(cross.final[1]))}</b> ganó más torneos. Se enfrentan por la Copa Anual.`;

  return `<p class="block-note">${explica}</p>
    ${isAdmin()
      ? `<button class="btn gold" data-cup-start="${y}">Armar la Copa Anual ${y}</button>`
      : `<div class="empty"><i class="ti ti-hourglass"></i><strong>Falta que el organizador la arme</strong></div>`}`;
}

function enCurso(d, y) {
  const admin = isAdmin();
  const game = (g, which, titulo) => `
    <div class="fixture-head">${titulo}</div>
    <div class="game ${g.played ? 'done' : ''}">
      <span class="t ${Annual.winnerOf(g) === g.home ? 'win' : ''}">${flag(g.home)}<span>${esc(nameOf(g.home))}</span></span>
      <span class="mark">
        ${admin
          ? `<input class="score" type="number" min="0" inputmode="numeric" value="${g.hg ?? ''}" placeholder="–" data-cup="${y}:${which}:hg">
             <input class="score" type="number" min="0" inputmode="numeric" value="${g.ag ?? ''}" placeholder="–" data-cup="${y}:${which}:ag">`
          : `<span class="score" style="display:grid;place-items:center">${g.hg ?? '–'}</span>
             <span class="score" style="display:grid;place-items:center">${g.ag ?? '–'}</span>`}
      </span>
      <span class="t away ${Annual.winnerOf(g) === g.away ? 'win' : ''}">${flag(g.away)}<span>${esc(nameOf(g.away))}</span></span>
    </div>
    ${admin && g.played && g.hg === g.ag && !g.penWinner ? `
      <div class="pens">Empataron. ¿Quién pasó por penales?
        <div class="row">
          <button class="btn sm" data-cup-pen="${y}:${which}:${g.home}">${flag(g.home)} ${esc(nameOf(g.home))}</button>
          <button class="btn sm" data-cup-pen="${y}:${which}:${g.away}">${flag(g.away)} ${esc(nameOf(g.away))}</button>
        </div>
      </div>` : ''}`;

  const champ = Annual.winnerOf(d.final);

  return `
    ${d.semi ? game(d.semi, 'semi', 'Repechaje: define quién juega la final') : ''}
    ${d.stage === 'repechaje'
      ? `<p class="block-note">${flag(d.waiting)} ${esc(nameOf(d.waiting))} espera en la final.</p>`
      : game(d.final, 'final', `Final de la Copa Anual ${y}`)}
    ${champ && admin ? `<div style="margin-top:12px">
        <button class="btn gold" data-cup-crown="${y}">Coronar a ${esc(nameOf(champ))}</button>
      </div>` : ''}
    ${admin ? `<div style="margin-top:10px">
        <button class="btn danger sm" data-cup-cancel="${y}">Cancelar la Copa Anual</button>
      </div>` : ''}`;
}

function annualClicks(e, paint) {
  const start = e.target.closest('[data-cup-start]');
  if (start) { Annual.start(Number(start.dataset.cupStart)); say('Copa Anual armada'); paint(); return true; }

  const pen = e.target.closest('[data-cup-pen]');
  if (pen) {
    const [y, which, who] = pen.dataset.cupPen.split(':');
    const d = Annual.draftOf(Number(y));
    d[which].penWinner = who;
    Annual.refresh(Number(y));
    cheer(); paint(); return true;
  }

  const crown = e.target.closest('[data-cup-crown]');
  if (crown) {
    const champ = Annual.crown(Number(crown.dataset.cupCrown));
    if (champ) { say(`Campeón anual: ${nameOf(champ)}`); cheer(); }
    paint(); return true;
  }

  const cancel = e.target.closest('[data-cup-cancel]');
  if (cancel) { Annual.cancelDraft(Number(cancel.dataset.cupCancel)); say('Copa Anual cancelada'); paint(); return true; }

  const del = e.target.closest('[data-cup-del]');
  if (del) {
    const r = Annual.removeCup(del.dataset.cupDel);
    if (r) sayUndo('Copa Anual borrada', () => { Annual.restoreCup(r.copy, r.at); say('Copa restaurada'); paint(); });
    paint(); return true;
  }
  return false;
}

function wire(view, paint) {
  const a = view.querySelector('#duoA');
  const b = view.querySelector('#duoB');
  if (a) a.onchange = e => { duoA = e.target.value; paint(); };
  if (b) b.onchange = e => { duoB = e.target.value; paint(); };
  const swap = view.querySelector('#swap');
  if (swap) swap.onclick = () => { [duoA, duoB] = [duoB, duoA]; paint(); };

  view.querySelectorAll('[data-cup]').forEach(inp => {
    inp.onchange = () => {
      const [y, which, side] = inp.dataset.cup.split(':');
      const d = Annual.draftOf(Number(y));
      if (!d) return;
      const g = d[which];
      g[side] = inp.value === '' ? null : Math.max(0, parseInt(inp.value, 10) || 0);
      g.played = g.hg !== null && g.ag !== null;
      if (g.played && g.hg !== g.ag) g.penWinner = null;
      Annual.refresh(Number(y));
      if (g.played) cheer();
      paint();
    };
  });
}

function html() {
  if (!state.tournaments.length) {
    return `<section class="block"><div class="empty">
      <i class="ti ti-chart-bar"></i><strong>Todavía no hay números</strong>
      Cuando se juegue el primer torneo, acá aparece todo.
    </div></section>`;
  }

  return `<section class="block">
    <h2><i class="ti ti-chart-bar"></i>Estadísticas</h2>
    <p class="block-note">Todo lo que dejaron los torneos, sumado.</p>

    <div class="opts stack">
      ${TABS.map(t => `<button class="opt ${tab === t.id ? 'on' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}
    </div>

    ${tab === 'duelo' ? '' : yearPicker(tab === 'anual')}
    ${tab === 'puntos'   ? tablaPuntos()   : ''}
    ${tab === 'promedio' ? tablaPromedio() : ''}
    ${tab === 'titulos'  ? tablaTitulos()  : ''}
    ${tab === 'duelo'    ? duelo()         : ''}
    ${tab === 'anual'    ? anual()         : ''}
  </section>`;
}

function yearPicker(soloAnios) {
  const ys = years();
  if (!ys.length) return '';
  if (soloAnios && ys.length < 2 && year !== null) return '';
  return `<div class="opts stack">
    ${soloAnios ? '' : `<button class="opt ${year === null ? 'on' : ''}" data-year="todo">Toda la historia</button>`}
    ${ys.map(y => `<button class="opt ${year === y ? 'on' : ''}" data-year="${y}">${y}</button>`).join('')}
  </div>`;
}

const rows = () => crunch({ year }).teams;

function shell(head, body, note) {
  if (!body) {
    return `<div class="empty"><i class="ti ti-database-off"></i>
      <strong>Sin datos ${year ? 'en ' + year : ''}</strong>Probá con otro período.</div>`;
  }
  return `${note ? `<p class="block-note">${note}</p>` : ''}
    <div class="table-scroll"><table class="standings">
      <thead><tr>${head}</tr></thead><tbody>${body}</tbody>
    </table></div>`;
}

const cell = (r, i) => `
  <td class="sticky-l" style="border-left:3px solid ${mainColorOf(r.id)}">
    <span class="side" data-team="${r.id}">
      <span class="rank">${i + 1}</span>${flag(r.id)}<span class="nm">${esc(nameOf(r.id))}</span>
    </span>
  </td>`;

function tablaPuntos() {
  const list = byPoints(rows().filter(r => r.pj > 0));
  return shell(
    `<th class="sticky-l">Selección</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th class="sticky-r">Pts</th>`,
    list.map((r, i) => `<tr class="${i === 0 ? 'lead' : ''}">
      ${cell(r, i)}
      <td class="num">${r.pj}</td><td class="num">${r.pg}</td><td class="num">${r.pe}</td><td class="num">${r.pp}</td>
      <td class="num">${r.gf}</td><td class="num">${r.gc}</td>
      <td class="num">${r.dg > 0 ? '+' : ''}${r.dg}</td>
      <td class="pts sticky-r">${r.pts}</td>
    </tr>`).join(''),
    'Todos los puntos sumados, torneo tras torneo.'
  );
}

function tablaPromedio() {
  const list = byAverage(rows());
  return shell(
    `<th class="sticky-l">Selección</th><th>PJ</th><th>Pts</th><th>GF</th><th>GC</th><th class="sticky-r">Prom</th>`,
    list.map((r, i) => `<tr class="${i === 0 ? 'lead' : ''}">
      ${cell(r, i)}
      <td class="num">${r.pj}</td><td class="num">${r.pts}</td>
      <td class="num">${(r.gf / r.pj).toFixed(1)}</td><td class="num">${(r.gc / r.pj).toFixed(1)}</td>
      <td class="pts sticky-r">${r.prom.toFixed(2)}</td>
    </tr>`).join(''),
    'Puntos por partido: el que jugó poco no queda en desventaja.'
  );
}

function tablaTitulos() {
  const list = byTitles(rows());
  return shell(
    `<th class="sticky-l">Selección</th><th>Torneos</th><th>Finales</th><th>Podios</th><th class="sticky-r">Títulos</th>`,
    list.map((r, i) => `<tr class="${i === 0 ? 'lead' : ''}">
      ${cell(r, i)}
      <td class="num">${r.torneos}</td><td class="num">${r.finales}</td><td class="num">${r.podios}</td>
      <td class="pts sticky-r">${r.titulos}</td>
    </tr>`).join(''),
    year ? `Títulos ganados en ${year}.` : 'Títulos ganados desde que existe la app.'
  );
}

/* ---------- Cara a cara ---------- */

function duelo() {
  const opts = sel => TEAMS.map(t =>
    `<option value="${t.id}" ${sel === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('');

  if (duoA === duoB) {
    return `${pickers(opts)}<div class="empty"><i class="ti ti-arrows-shuffle"></i>
      <strong>Elegí dos selecciones distintas</strong></div>`;
  }

  const h = headToHead(duoA, duoB);
  if (!h.pj) {
    return `${pickers(opts)}<div class="empty"><i class="ti ti-ball-off"></i>
      <strong>Nunca se cruzaron</strong>${esc(nameOf(duoA))} y ${esc(nameOf(duoB))} todavía no jugaron entre sí.</div>`;
  }

  return `${pickers(opts)}
    <div class="duel">
      <div class="duel-side"><span>${flag(duoA)}</span><b>${h.ganóA}</b><small>${esc(nameOf(duoA))}</small></div>
      <div class="duel-mid"><b>${h.empates}</b><small>empates</small><span>${h.pj} partidos</span></div>
      <div class="duel-side"><span>${flag(duoB)}</span><b>${h.ganóB}</b><small>${esc(nameOf(duoB))}</small></div>
    </div>
    <div class="recs" style="margin-top:12px">
      <article class="rec"><div class="rec-n"><b>${h.golesA}</b></div>
        <div class="rec-b"><div class="rec-w">${flag(duoA)} <span>${esc(nameOf(duoA))}</span></div>
        <div class="rec-l">goles en estos cruces</div></div></article>
      <article class="rec"><div class="rec-n"><b>${h.golesB}</b></div>
        <div class="rec-b"><div class="rec-w">${flag(duoB)} <span>${esc(nameOf(duoB))}</span></div>
        <div class="rec-l">goles en estos cruces</div></div></article>
    </div>
    <div class="fixture-head">Todos los cruces</div>
    ${h.games.map(({ m, t }) => {
      const gA = m.home === duoA ? m.hg : m.ag;
      const gB = m.home === duoA ? m.ag : m.hg;
      return `<div class="game done">
        <span class="t ${gA > gB ? 'win' : ''}">${flag(duoA)}<span>${esc(nameOf(duoA))}</span></span>
        <span class="mark">
          <span class="score" style="display:grid;place-items:center">${gA}</span>
          <span class="score" style="display:grid;place-items:center">${gB}</span>
        </span>
        <span class="t away ${gB > gA ? 'win' : ''}">${flag(duoB)}<span>${esc(nameOf(duoB))}</span></span>
      </div>
      <div class="duel-src">${esc(t.name)}</div>`;
    }).join('')}`;
}

const pickers = opts => `
  <div class="row stack">
    <div><label class="field" for="duoA">Una</label><select id="duoA">${opts(duoA)}</select></div>
    <div style="flex:0 0 auto;align-self:end">
      <button class="btn sm" id="swap" title="Dar vuelta"><i class="ti ti-arrows-exchange"></i></button>
    </div>
    <div><label class="field" for="duoB">La otra</label><select id="duoB">${opts(duoB)}</select></div>
  </div>`;
