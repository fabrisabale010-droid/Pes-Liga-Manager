import { flag, esc, nameOf, openModal, crest } from './ui.js';
import { mainColorOf } from '../domain/teams.js';
import { table, tieWinner, roundName, groupTable } from '../domain/engine.js';
import { tournaments } from '../core/store.js';
import { TITLES_BEFORE_APP } from '../config.js';
import { crunch } from '../domain/stats.js';

/* ---------- Tabla de posiciones ---------- */

/* Se recuerda el orden anterior para poder mostrar quién subió y quién bajó
   cuando se carga un resultado. Es la única animación que no responde a un
   toque: está porque muestra exactamente qué cambió en la tabla. */
const ordenPrevio = new Map();

function movimientos(clave, ids) {
  const antes = ordenPrevio.get(clave);
  ordenPrevio.set(clave, ids);
  if (!antes) return new Map();                 // primera vez: nada que comparar

  const cambios = new Map();
  ids.forEach((id, ahora) => {
    const estaba = antes.indexOf(id);
    if (estaba >= 0 && estaba !== ahora) {
      cambios.set(id, estaba > ahora ? 'sube' : 'baja');
    }
  });
  return cambios;
}

export function standingsTable(rows, { qualify = 0, clave = 'tabla' } = {}) {
  if (!rows.length) return '';
  const movidos = movimientos(clave, rows.map(r => r.id));
  return `<div class="table-scroll"><table class="standings">
    <thead><tr>
      <th class="sticky-l">Selección</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th class="sticky-r">Pts</th>
    </tr></thead>
    <tbody>${rows.map((r, i) => `
      <tr class="${i === 0 ? 'lead' : ''} ${movidos.get(r.id) || ''}">
        <td class="sticky-l" style="border-left:3px solid ${mainColorOf(r.id)}">
          <span class="side ${qualify && i < qualify ? 'q' : ''}" data-team="${r.id}">
            <span class="rank">${i + 1}</span>${flag(r.id)}<span class="nm">${esc(nameOf(r.id))}</span>
            ${movidos.get(r.id) ? `<i class="mov ti ti-chevron-${movidos.get(r.id) === 'sube' ? 'up' : 'down'}"></i>` : ''}
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

/* Usa las mismas cuentas que Estadísticas (incluye los partidos de llaves),
   así la ficha y las tablas históricas nunca muestran números distintos. */
function openTeamCard(id) {
  const s = crunch().teams.find(x => x.id === id);
  const played = s?.torneos || 0, pj = s?.pj || 0, pts = s?.pts || 0;
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


/* ---------- Fechas, una por una ----------

   Los resultados se recorren fecha por fecha, como en las apps de fútbol:
   flechas a los costados, una tira para saltar a cualquier fecha y, en el
   celular, deslizar con el dedo. Por dentro es un carril con scroll-snap,
   así el gesto es el nativo del teléfono y no hay que reinventarlo. */

const shortRound = (round, total) => {
  const name = roundName(round, total);
  return name === 'Final' ? 'Final'
    : name === 'Semifinal' ? 'Semis'
    : name === 'Cuartos de final' ? 'Cuartos'
    : name === 'Octavos de final' ? 'Octavos'
    : `R${round}`;
};

/* Las fechas de un torneo, en orden: primero las de liga o grupos y
   después cada ronda de las llaves. */
export function roundsOf(t, { teamId = '', played = false, bracket = true } = {}) {
  const ok = m => m.home && m.away && !m.bye && (!played || m.played) &&
    (!teamId || m.home === teamId || m.away === teamId);
  const out = [];

  [...new Set(t.games.map(m => m.day))].sort((a, b) => a - b).forEach(day => {
    const games = t.games.filter(m => m.day === day && ok(m))
      .sort((a, b) => (a.group || '').localeCompare(b.group || '') || a.id - b.id);
    if (games.length) out.push({ label: `Fecha ${day}`, short: `F${day}`, kind: 'g', day, games });
  });

  if (bracket && t.bracket) {
    [...new Set(t.bracket.games.map(m => m.round))].sort((a, b) => a - b).forEach(r => {
      const games = t.bracket.games.filter(m => m.round === r && ok(m)).sort((a, b) => a.pos - b.pos);
      if (games.length) out.push({
        label: roundName(r, t.bracket.rounds), short: shortRound(r, t.bracket.rounds), kind: 'b', games
      });
    });
  }
  return out;
}

/* Qué fecha estaba mirando cada uno, para no perderla al redibujar. */
const pagerAt = new Map();

const penNote = m => m.penWinner && m.played && m.hg === m.ag
  ? `<div class="res-pen"><i class="ti ti-target-arrow" aria-hidden="true"></i>Pasó ${flag(m.penWinner)} ${esc(nameOf(m.penWinner))} por penales</div>`
  : '';

export function matchdayPager(key, rounds, { start = 0, editable = false, live = -1 } = {}) {
  if (!rounds.length) return '';
  const at = Math.min(Math.max(0, pagerAt.get(key) ?? start), rounds.length - 1);
  const n = rounds.length;

  const slides = rounds.map((r, i) => {
    const played = r.games.filter(m => m.played).length;
    const goals = r.games.reduce((g, m) => g + (m.played ? m.hg + m.ag : 0), 0);
    const sub = `${played} de ${r.games.length} ${r.games.length === 1 ? 'partido jugado' : 'partidos jugados'}` +
      (played ? ` · ${goals} ${goals === 1 ? 'gol' : 'goles'}` : '');
    let group = null;
    const body = r.games.map(m => {
      const head = m.group && m.group !== group ? `<div class="pager-group">Grupo ${esc(m.group)}</div>` : '';
      group = m.group || group;
      return head + gameRow(m, { editable, kind: r.kind }) + penNote(m);
    }).join('');
    return `<section class="pager-slide" role="tabpanel" id="${esc(key)}-s${i}" aria-label="${esc(r.label)}"
      data-label="${esc(r.label)}" data-sub="${esc(sub)}" data-live="${i === live ? 1 : ''}">${body}</section>`;
  }).join('');

  const chips = rounds.map((r, i) => `<button type="button" class="pager-chip ${i === live ? 'live' : ''}"
      role="tab" aria-controls="${esc(key)}-s${i}" aria-selected="${i === at}" data-pg-go="${i}">${esc(r.short)}</button>`).join('');

  return `<div class="pager" data-pager="${esc(key)}" data-start="${at}">
    <div class="pager-head">
      <button type="button" class="pager-nav" data-pg="prev" aria-label="Fecha anterior"><i class="ti ti-chevron-left"></i></button>
      <div class="pager-title" aria-live="polite">
        <strong>${esc(rounds[at].label)}</strong>
        <span>${at + 1} de ${n}</span>
      </div>
      <button type="button" class="pager-nav" data-pg="next" aria-label="Fecha siguiente"><i class="ti ti-chevron-right"></i></button>
    </div>
    ${n > 1 ? `<div class="pager-strip" role="tablist" aria-label="Elegir fecha">${chips}</div>` : ''}
    <div class="pager-track" tabindex="0" aria-label="Partidos de la fecha">${slides}</div>
    <div class="pager-foot"></div>
  </div>`;
}

function mountPager(pager) {
  pager.dataset.mounted = '1';
  const key = pager.dataset.pager;
  const track = pager.querySelector('.pager-track');
  const slides = [...track.children];
  const chips = [...pager.querySelectorAll('[data-pg-go]')];
  const strip = pager.querySelector('.pager-strip');
  const title = pager.querySelector('.pager-title');
  const foot = pager.querySelector('.pager-foot');
  const prev = pager.querySelector('[data-pg="prev"]');
  const next = pager.querySelector('[data-pg="next"]');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = -1;

  const sync = i => {
    if (i === index) return;
    index = i;
    pagerAt.set(key, i);
    const s = slides[i];
    title.innerHTML = `<strong>${esc(s.dataset.label)}${s.dataset.live ? ' <span class="tag live">en juego</span>' : ''}</strong>
      <span>${i + 1} de ${slides.length}</span>`;
    foot.textContent = s.dataset.sub;
    prev.disabled = i === 0;
    next.disabled = i === slides.length - 1;
    slides.forEach((x, k) => x.classList.toggle('on', k === i));
    chips.forEach((c, k) => c.setAttribute('aria-selected', String(k === i)));
    const chip = chips[i];
    if (chip && strip) {
      const want = chip.offsetLeft - strip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2;
      strip.scrollTo({ left: Math.max(0, want), behavior: calm ? 'auto' : 'smooth' });
    }
  };

  const goTo = (i, smooth = true) => {
    i = Math.min(Math.max(0, i), slides.length - 1);
    track.scrollTo({ left: i * track.clientWidth, behavior: smooth && !calm ? 'smooth' : 'auto' });
    sync(i);
  };

  let ticking = false;
  track.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (track.clientWidth) sync(Math.round(track.scrollLeft / track.clientWidth));
    });
  }, { passive: true });

  pager.addEventListener('click', e => {
    const nav = e.target.closest('[data-pg]');
    if (nav) return goTo(index + (nav.dataset.pg === 'next' ? 1 : -1));
    const chip = e.target.closest('[data-pg-go]');
    if (chip) goTo(Number(chip.dataset.pgGo));
  });

  pager.addEventListener('keydown', e => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(index - 1); }
  });

  /* Si cambia el ancho (girar el teléfono), se vuelve a acomodar la fecha. */
  new ResizeObserver(() => {
    if (index >= 0 && track.clientWidth) track.scrollLeft = index * track.clientWidth;
  }).observe(track);

  const start = Number(pager.dataset.start) || 0;
  sync(start);
  requestAnimationFrame(() => { track.scrollLeft = start * track.clientWidth; });
}

/* Cualquier carrusel que aparezca en pantalla se activa solo. */
export function enablePagers() {
  const scan = () => document.querySelectorAll('.pager:not([data-mounted])').forEach(mountPager);
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
}
