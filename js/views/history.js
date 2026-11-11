import { flag, esc, nameOf, say, sayUndo, clip, whenDate } from '../ui/ui.js';
import { standingsTable, bracketView, gameRow } from '../ui/parts.js';
import { tableCard, compartirImagen } from '../ui/cards.js';
import { tournaments, trashed, trashDaysLeft,
         sendToTrash, restoreFromTrash, emptyTrash } from '../core/store.js';
import { finalTable, formatName, progress, isLive, roundName, playedAt } from '../domain/engine.js';
import { isAdmin } from '../core/auth.js';
import { TRASH_DAYS } from '../config.js';

let search = '';
let openId = null;
let showTrash = false;
let mode = 'torneos';       // 'torneos' | 'resultados'
let teamFilter = '';        // '' = todas las selecciones

/* El router entrega un contenedor nuevo en cada visita, así que el listener
   se engancha una sola vez acá y todo lo demás sólo repinta el contenido. */
export function renderHistory(view) {
  const paint = () => {
    view.innerHTML = html();
    const box = view.querySelector('#q');
    if (!box) return;
    box.oninput = e => {
      search = e.target.value;
      const at = e.target.selectionStart;
      paint();
      const again = view.querySelector('#q');
      again.focus();
      again.setSelectionRange(at, at);
    };
    const sel = view.querySelector('#histTeam');
    if (sel) sel.onchange = e => { teamFilter = e.target.value; paint(); };
  };

  view.addEventListener('click', e => {
    const modo = e.target.closest('[data-hist-mode]');
    if (modo) {
      mode = modo.dataset.histMode;
      return paint();
    }
    const head = e.target.closest('[data-open]');
    if (head) {
      openId = openId === head.dataset.open ? null : head.dataset.open;
      return paint();
    }
    const compartir = e.target.closest('[data-share-table]');
    if (compartir) return compartirTabla(compartir);

    const del = e.target.closest('[data-del]');
    if (del) return remove(del.dataset.del, paint);

    if (e.target.closest('[data-trash-toggle]')) {
      showTrash = !showTrash;
      return paint();
    }
    const back = e.target.closest('[data-restore]');
    if (back) {
      const t = restoreFromTrash(back.dataset.restore);
      say(`Volvió «${clip(t.name)}»`);
      return paint();
    }
    if (e.target.closest('[data-empty-trash]')) {
      if (!confirm('¿Vaciar la papelera? Lo que hay adentro se pierde para siempre.')) return;
      emptyTrash();
      say('Papelera vacía');
      return paint();
    }
  });

  paint();
}

function html() {
  const all = [...tournaments()].sort((a, b) => cuandoSeJugo(b) - cuandoSeJugo(a));

  if (!all.length) {
    return `<section class="block"><div class="empty">
      <i class="ti ti-history"></i>
      <strong>Todavía no hay torneos</strong>
      Cuando se juegue el primero, queda guardado acá para siempre.
    </div></section>`;
  }

  const q = search.trim().toLowerCase();
  const list = q ? all.filter(t => t.name.toLowerCase().includes(q)) : all;

  return `<section class="block">
    <h2><i class="ti ti-history"></i>Historial</h2>
    <p class="block-note">${all.length} ${all.length === 1 ? 'torneo' : 'torneos'}. ${mode === 'resultados'
      ? 'Todos los partidos de los torneos terminados.'
      : 'Tocá uno para ver cómo terminó.'}</p>
    <div class="opts stack">
      <button class="opt ${mode === 'torneos' ? 'on' : ''}" data-hist-mode="torneos">Torneos</button>
      <button class="opt ${mode === 'resultados' ? 'on' : ''}" data-hist-mode="resultados">Todos los resultados</button>
    </div>
    <div class="stack">
      <input type="search" id="q" placeholder="Buscar por nombre" value="${esc(search)}">
    </div>
    ${mode === 'resultados' ? allResults(list) : list.length ? `<div class="log">${list.map(row).join('')}</div>` : `
      <div class="empty"><i class="ti ti-search-off"></i>
        <strong>Ningún torneo se llama así</strong>Probá con otra palabra.</div>`}
  </section>
  ${trashBlock()}`;
}

/* ---------- Resultados ---------- */

/* Los partidos jugados de un torneo, en el orden en que se jugaron:
   primero la fase de liga o de grupos (por fecha) y después las llaves. */
function sections(t, teamId = '') {
  const plays = m => m.played && !m.bye && m.home && m.away &&
    (!teamId || m.home === teamId || m.away === teamId);
  const out = [];

  const byKey = new Map();
  [...t.games]
    .filter(plays)
    .sort((a, b) => (a.group || '').localeCompare(b.group || '') || a.day - b.day || a.id - b.id)
    .forEach(m => {
      const label = `${m.group ? `Grupo ${m.group} · ` : ''}Fecha ${m.day}`;
      if (!byKey.has(label)) byKey.set(label, []);
      byKey.get(label).push(m);
    });
  byKey.forEach((games, label) => out.push({ label, games }));

  if (t.bracket) {
    const byRound = new Map();
    [...t.bracket.games]
      .filter(plays)
      .sort((a, b) => a.round - b.round || a.pos - b.pos)
      .forEach(m => {
        if (!byRound.has(m.round)) byRound.set(m.round, []);
        byRound.get(m.round).push(m);
      });
    byRound.forEach((games, r) => out.push({ label: roundName(r, t.bracket.rounds), games }));
  }
  return out;
}

const countGames = secs => secs.reduce((n, s) => n + s.games.length, 0);

/* Un partido con su aclaración de penales, si la hubo. */
function resultRow(m) {
  const pen = m.penWinner && m.hg === m.ag
    ? `<div class="res-pen">Pasó ${flag(m.penWinner)} ${esc(nameOf(m.penWinner))} por penales</div>`
    : '';
  return gameRow(m) + pen;
}

function resultsList(t, teamId = '') {
  const secs = sections(t, teamId);
  if (!secs.length) return '';
  return secs.map(s => `<div class="fixture-head">${esc(s.label)}</div>
    ${s.games.map(resultRow).join('')}`).join('') +
    (t.penWinner && !teamId ? `<div class="res-pen">Desempate: salió campeón
      ${flag(t.penWinner)} ${esc(nameOf(t.penWinner))}</div>` : '');
}

/* Dentro de cada torneo: se despliega para no alargar la tarjeta. */
function resultsBlock(t) {
  const n = countGames(sections(t));
  if (!n) return '';
  return `<details class="res-box">
    <summary><i class="ti ti-list-details"></i>Ver los ${n} ${n === 1 ? 'resultado' : 'resultados'}</summary>
    ${resultsList(t)}
  </details>`;
}

/* Cómo le fue a una selección en los partidos que se muestran. */
function teamSummary(teamId, list) {
  let pj = 0, pg = 0, pe = 0, pp = 0, gf = 0, gc = 0;
  list.forEach(t => sections(t, teamId).forEach(s => s.games.forEach(m => {
    const home = m.home === teamId;
    const a = home ? m.hg : m.ag, b = home ? m.ag : m.hg;
    pj++; gf += a; gc += b;
    if (a > b || m.penWinner === teamId) pg++;
    else if (a < b || (m.penWinner && m.penWinner !== teamId)) pp++;
    else pe++;
  })));
  if (!pj) return '';
  return `<p class="block-note res-sum">${flag(teamId)} <b>${esc(nameOf(teamId))}</b>:
    ${pj} ${pj === 1 ? 'partido' : 'partidos'} · ${pg} G · ${pe} E · ${pp} P · ${gf}-${gc} en goles
    <span class="res-hint">(los ganados por penales cuentan como victoria)</span></p>`;
}

/* La vista de todos los resultados, torneo por torneo. */
function allResults(list) {
  const done = list.filter(t => t.finished);

  const teams = [...new Set(tournaments().filter(t => t.finished).flatMap(t => t.teamIds))]
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  if (teamFilter && !teams.includes(teamFilter)) teamFilter = '';

  const picker = `<div class="stack">
    <select id="histTeam" aria-label="Filtrar por selección">
      <option value="">Todas las selecciones</option>
      ${teams.map(id => `<option value="${id}" ${teamFilter === id ? 'selected' : ''}>${esc(nameOf(id))}</option>`).join('')}
    </select>
  </div>`;

  const blocks = done
    .map(t => ({ t, body: resultsList(t, teamFilter) }))
    .filter(x => x.body);

  if (!blocks.length) {
    return picker + `<div class="empty"><i class="ti ti-ball-football-off"></i>
      <strong>No hay resultados para mostrar</strong>
      ${done.length ? 'Probá con otra selección o con otra búsqueda.' : 'Cuando termine el primer torneo, sus partidos quedan acá.'}</div>`;
  }

  return picker + (teamFilter ? teamSummary(teamFilter, done) : '') +
    `<div class="log">${blocks.map(({ t, body }) => `
      <article class="log-item open res-item">
        <div class="log-head" style="cursor:default">
          <div class="grow">
            <div class="nm">${esc(t.name)}</div>
            <div class="sub">${cuandoSeJugo(t).toLocaleDateString('es-AR')} · ${esc(formatName(t.format))}${
              t.champion ? ` · Campeón ${esc(nameOf(t.champion))}` : ''}</div>
          </div>
          ${t.champion ? `<span style="font-size:20px">${flag(t.champion)}</span>` : ''}
        </div>
        <div class="log-body">${body}</div>
      </article>`).join('')}</div>`;
}

/* ---------- Papelera ---------- */

function trashBlock() {
  if (!isAdmin()) return '';
  const list = trashed();
  if (!list.length) return '';

  return `<section class="block">
    <button class="btn sm" data-trash-toggle>
      <i class="ti ti-trash"></i>Papelera (${list.length})
      <i class="ti ti-chevron-${showTrash ? 'up' : 'down'}"></i>
    </button>
    ${showTrash ? `
      <p class="block-note" style="margin-top:12px">
        Se recuperan de acá durante ${TRASH_DAYS} ${TRASH_DAYS === 1 ? 'día' : 'días'}. Después se borran solos.
      </p>
      <div class="log">
        ${list.map(t => `
          <article class="log-item">
            <div class="log-head" style="cursor:default">
              <div class="grow">
                <div class="nm">${esc(t.name)}</div>
                <div class="sub">
                  ${t.champion ? `Campeón ${esc(nameOf(t.champion))} · ` : ''}
                  quedan ${trashDaysLeft(t)} ${trashDaysLeft(t) === 1 ? 'día' : 'días'}
                </div>
              </div>
              <button class="btn sm" data-restore="${t.id}">Restaurar</button>
            </div>
          </article>`).join('')}
      </div>
      <div style="margin-top:12px">
        <button class="btn danger sm" data-empty-trash>Vaciar la papelera</button>
      </div>` : ''}
  </section>`;
}

/* La fecha que importa es la que se jugó, no la que se cargó en la app. */
const cuandoSeJugo = playedAt;

function row(t) {
  const open = openId === t.id;
  const p = progress(t);
  const rows = finalTable(t);
  const podium = rows.slice(0, 3);

  return `<article class="log-item ${open ? 'open' : ''}">
    <div class="log-head" data-open="${t.id}">
      <div class="grow">
        <div class="nm">${esc(t.name)}
          <span class="tag ${t.finished ? 'done' : isLive(t) ? 'live' : 'soon'}">
            ${t.finished ? 'terminado' : isLive(t) ? 'en juego' : 'programado'}
          </span>
        </div>
        <div class="sub">${cuandoSeJugo(t).toLocaleDateString('es-AR')} · ${esc(formatName(t.format))} · ${p.played}/${p.total} partidos</div>
      </div>
      ${t.champion ? `<span style="font-size:20px">${flag(t.champion)}</span>` : ''}
      <i class="ti ti-chevron-down chev"></i>
    </div>
    <div class="log-body">
      ${t.finished && podium.length ? `<div class="podium">
        ${podium.map((r, i) => `<div>${['🥇','🥈','🥉'][i]} ${flag(r.id)} ${esc(nameOf(r.id))}</div>`).join('')}
      </div>` : ''}
      ${t.format === 'copa' && t.bracket ? bracketView(t) : ''}
      ${standingsTable(rows, { clave: 'historial-' + t.id })}
      ${resultsBlock(t)}
      <div class="row" style="margin-top:12px">
        ${t.finished ? `<button class="btn sm" data-share-table="${t.id}" style="flex:0 0 auto">
          <i class="ti ti-share-2"></i>Compartir tabla</button>` : ''}
        ${isAdmin() ? `<button class="btn danger sm" data-del="${t.id}" style="flex:0 0 auto">Borrar torneo</button>` : ''}
      </div>
    </div>
  </article>`;
}

function compartirTabla(btn) {
  const t = tournaments().find(x => x.id === btn.dataset.shareTable);
  if (!t) return;
  compartirImagen(btn, () => tableCard(t, finalTable(t)),
    `tabla-${t.name.replace(/[^a-z0-9]+/gi, '-')}`,
    `📋 ${t.name}${t.champion ? ' — campeón ' + nameOf(t.champion) : ''}`);
}

function remove(id, paint) {
  const t = sendToTrash(id);
  if (!t) return;
  sayUndo(`Borraste «${clip(t.name)}»`, () => {
    restoreFromTrash(id);
    say('Torneo restaurado');
    paint();
  });
  paint();
}
