import { flag, esc, nameOf, say, sayUndo, clip } from '../ui/ui.js';
import { standingsTable, bracketView, roundsOf, matchdayPager } from '../ui/parts.js';
import { tableCard, compartirImagen } from '../ui/cards.js';
import { tournaments, trashed, trashDaysLeft,
         sendToTrash, restoreFromTrash, emptyTrash } from '../core/store.js';
import { finalTable, formatName, progress, isLive, playedAt } from '../domain/engine.js';
import { isAdmin } from '../core/auth.js';
import { TRASH_DAYS } from '../config.js';

let search = '';
let showTrash = false;
let mode = 'torneos';       // 'torneos' | 'resultados'
let teamFilter = '';        // '' = todas las selecciones
let detail = 'resultados';  // pestaña dentro de un torneo abierto

/* El torneo abierto vive en la dirección (#/historial/<id>): así se puede
   compartir el enlace, y el botón "atrás" del celular lo cierra. */
export function renderHistory(view, openId = null) {
  const paint = () => {
    view.innerHTML = html(openId);
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
    const tab = e.target.closest('[data-detail]');
    if (tab) {
      detail = tab.dataset.detail;
      return paint();
    }
    const head = e.target.closest('[data-open]');
    if (head) {
      const id = head.dataset.open;
      if (openId === id) {
        /* Cerrar vuelve a la lista sin dejar un paso más en el "atrás". */
        history.replaceState(null, '', '#/historial');
        openId = null;
        return paint();
      }
      detail = 'resultados';
      location.hash = `#/historial/${encodeURIComponent(id)}`;
      return;
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

  /* Al abrir un torneo desde la lista o desde un enlace, se lo trae a la vista. */
  if (openId) {
    requestAnimationFrame(() => {
      const card = view.querySelector('.log-item.open');
      if (card) card.scrollIntoView({
        block: 'start',
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
    });
  }
}

function html(openId) {
  const all = [...tournaments()].sort((a, b) => cuandoSeJugo(b) - cuandoSeJugo(a));

  if (!all.length) {
    return `<section class="block"><div class="empty">
      <i class="ti ti-history"></i>
      <strong>Todavía no hay torneos</strong>
      Cuando se juegue el primero, queda guardado acá para siempre.
    </div></section>`;
  }

  const q = search.trim().toLowerCase();
  const list = q ? all.filter(t => t.name.toLowerCase().includes(q) || t.id === openId) : all;

  return `<section class="block">
    <h2><i class="ti ti-history"></i>Historial</h2>
    <p class="block-note">${all.length} ${all.length === 1 ? 'torneo' : 'torneos'}. ${mode === 'resultados'
      ? 'Los partidos de los torneos terminados, fecha por fecha.'
      : 'Tocá uno para ver sus resultados, la tabla y las llaves.'}</p>
    <div class="opts stack" role="tablist" aria-label="Qué mostrar">
      <button class="opt ${mode === 'torneos' ? 'on' : ''}" role="tab" aria-selected="${mode === 'torneos'}" data-hist-mode="torneos">Torneos</button>
      <button class="opt ${mode === 'resultados' ? 'on' : ''}" role="tab" aria-selected="${mode === 'resultados'}" data-hist-mode="resultados">Todos los resultados</button>
    </div>
    <div class="stack search-box">
      <i class="ti ti-search" aria-hidden="true"></i>
      <input type="search" id="q" placeholder="Buscar torneo" aria-label="Buscar torneo por nombre" value="${esc(search)}">
    </div>
    ${mode === 'resultados' ? allResults(list) : list.length ? `<div class="log">${list.map(t => row(t, openId)).join('')}</div>` : `
      <div class="empty"><i class="ti ti-search-off"></i>
        <strong>Ningún torneo se llama así</strong>Probá con otra palabra.</div>`}
  </section>
  ${trashBlock()}`;
}

/* ---------- Resultados ---------- */

/* Dónde arranca el carrusel: en la fecha que se está jugando, o en la
   primera si el torneo ya terminó. */
function startOf(t, rounds) {
  if (t.finished) return 0;
  const i = rounds.findIndex(r => r.games.some(m => !m.played));
  return i < 0 ? rounds.length - 1 : i;
}

function deciderNote(t) {
  return t.penWinner ? `<div class="res-pen"><i class="ti ti-trophy" aria-hidden="true"></i>Desempate: salió campeón
    ${flag(t.penWinner)} ${esc(nameOf(t.penWinner))}</div>` : '';
}

function resultsPager(t, keyPrefix, teamId = '') {
  const rounds = roundsOf(t, { played: true, teamId });
  if (!rounds.length) return '';
  return matchdayPager(`${keyPrefix}-${t.id}-${teamId}`, rounds, { start: startOf(t, rounds) }) +
    (teamId ? '' : deciderNote(t));
}

/* Cómo le fue a una selección en los partidos que se muestran. */
function teamSummary(teamId, list) {
  let pj = 0, pg = 0, pe = 0, pp = 0, gf = 0, gc = 0;
  list.forEach(t => roundsOf(t, { played: true, teamId }).forEach(r => r.games.forEach(m => {
    const home = m.home === teamId;
    const a = home ? m.hg : m.ag, b = home ? m.ag : m.hg;
    pj++; gf += a; gc += b;
    if (a > b || m.penWinner === teamId) pg++;
    else if (a < b || (m.penWinner && m.penWinner !== teamId)) pp++;
    else pe++;
  })));
  if (!pj) return '';
  const cell = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
  return `<div class="res-sum">
    <div class="res-sum-who">${flag(teamId)} <b>${esc(nameOf(teamId))}</b></div>
    <div class="res-sum-nums">
      ${cell(pj, 'PJ')}${cell(pg, 'G')}${cell(pe, 'E')}${cell(pp, 'P')}${cell(`${gf}-${gc}`, 'Goles')}
    </div>
    <div class="res-hint">Los ganados por penales cuentan como victoria.</div>
  </div>`;
}

/* La vista de todos los resultados, torneo por torneo. */
function allResults(list) {
  const done = list.filter(t => t.finished);

  const teams = [...new Set(tournaments().filter(t => t.finished).flatMap(t => t.teamIds))]
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  if (teamFilter && !teams.includes(teamFilter)) teamFilter = '';

  const picker = `<div class="stack">
    <label class="field" for="histTeam">Selección</label>
    <select id="histTeam">
      <option value="">Todas las selecciones</option>
      ${teams.map(id => `<option value="${id}" ${teamFilter === id ? 'selected' : ''}>${esc(nameOf(id))}</option>`).join('')}
    </select>
  </div>`;

  const blocks = done
    .map(t => ({ t, body: resultsPager(t, 'todos', teamFilter) }))
    .filter(x => x.body);

  if (!blocks.length) {
    return picker + `<div class="empty"><i class="ti ti-ball-football-off"></i>
      <strong>No hay resultados para mostrar</strong>
      ${done.length ? 'Probá con otra selección o con otra búsqueda.' : 'Cuando termine el primer torneo, sus partidos quedan acá.'}</div>`;
  }

  return picker + (teamFilter ? teamSummary(teamFilter, done) : '') +
    `<div class="log">${blocks.map(({ t, body }) => `
      <article class="log-item res-item">
        <div class="log-head static">
          <div class="grow">
            <div class="nm">${esc(t.name)}</div>
            <div class="sub">${cuandoSeJugo(t).toLocaleDateString('es-AR')} · ${esc(formatName(t.format))}${
              t.champion ? ` · Campeón ${esc(nameOf(t.champion))}` : ''}</div>
          </div>
          ${t.champion ? `<span class="log-flag">${flag(t.champion)}</span>` : ''}
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
    <button class="btn sm" data-trash-toggle aria-expanded="${showTrash}">
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
            <div class="log-head static">
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

function row(t, openId) {
  const open = openId === t.id;
  const p = progress(t);
  const estado = t.finished ? 'done' : isLive(t) ? 'live' : 'soon';

  return `<article class="log-item ${open ? 'open' : ''}">
    <button type="button" class="log-head" data-open="${t.id}" aria-expanded="${open}">
      <span class="grow">
        <span class="nm">${esc(t.name)}
          <span class="tag ${estado}">
            ${t.finished ? 'terminado' : isLive(t) ? 'en juego' : 'programado'}
          </span>
        </span>
        <span class="sub">${cuandoSeJugo(t).toLocaleDateString('es-AR')} · ${esc(formatName(t.format))} · ${p.played}/${p.total} partidos</span>
      </span>
      ${t.champion ? `<span class="log-flag">${flag(t.champion)}</span>` : ''}
      <i class="ti ti-chevron-down chev" aria-hidden="true"></i>
    </button>
    ${open ? `<div class="log-body">${detailBody(t)}</div>` : ''}
  </article>`;
}

/* Lo de adentro de un torneo, separado en pestañas para no tener que
   recorrer una tarjeta larguísima. */
function detailBody(t) {
  const rows = finalTable(t);
  const podium = t.finished ? rows.slice(0, 3) : [];
  const llaves = t.format === 'copa' && t.bracket;
  const tabs = [
    { id: 'resultados', label: 'Resultados' },
    { id: 'tabla', label: 'Tabla' },
    ...(llaves ? [{ id: 'llaves', label: 'Llaves' }] : [])
  ];
  if (!tabs.some(x => x.id === detail)) detail = 'resultados';

  const results = resultsPager(t, 'h');
  const panel =
    detail === 'tabla'  ? standingsTable(rows, { clave: 'historial-' + t.id }) :
    detail === 'llaves' ? bracketView(t) :
    results || `<div class="empty"><i class="ti ti-ball-football"></i>
      <strong>Todavía no se jugó ningún partido</strong>Cuando se carguen, aparecen acá fecha por fecha.</div>`;

  return `
    ${podium.length ? `<ol class="podium" aria-label="Podio">
      ${podium.map((r, i) => `<li><span class="medal m${i + 1}">${i + 1}</span>${flag(r.id)} ${esc(nameOf(r.id))}</li>`).join('')}
    </ol>` : ''}
    <div class="opts detail-tabs" role="tablist" aria-label="Ver del torneo">
      ${tabs.map(x => `<button class="opt ${detail === x.id ? 'on' : ''}" role="tab"
        aria-selected="${detail === x.id}" data-detail="${x.id}">${x.label}</button>`).join('')}
    </div>
    <div class="detail-panel">${panel}</div>
    <div class="row actions-row">
      ${t.finished ? `<button class="btn sm" data-share-table="${t.id}">
        <i class="ti ti-share-2"></i>Compartir tabla</button>` : ''}
      ${isAdmin() ? `<button class="btn danger sm" data-del="${t.id}"><i class="ti ti-trash"></i>Borrar torneo</button>` : ''}
    </div>`;
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
  if (location.hash.startsWith('#/historial/')) history.replaceState(null, '', '#/historial');
  paint();
}
