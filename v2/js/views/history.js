import { flag, esc, nameOf, shortDate, say, sayUndo } from '../ui/ui.js';
import { standingsTable, bracketView, groupsView } from '../ui/parts.js';
import { state, update } from '../core/store.js';
import { finalTable, formatName, progress } from '../domain/engine.js';
import { isAdmin } from '../core/auth.js';
import { go } from '../ui/router.js';

let search = '';
let openId = null;

export function renderHistory(view) {
  const all = [...state.tournaments].sort(
    (a, b) => new Date(b.finishedAt || b.createdAt) - new Date(a.finishedAt || a.createdAt)
  );

  if (!all.length) {
    view.innerHTML = `<section class="block"><div class="empty">
      <i class="ti ti-history"></i>
      <strong>Todavía no hay torneos</strong>
      Cuando se juegue el primero, queda guardado acá para siempre.
    </div></section>`;
    return;
  }

  const q = search.trim().toLowerCase();
  const list = q ? all.filter(t => t.name.toLowerCase().includes(q)) : all;

  view.innerHTML = `
    <section class="block">
      <h2><i class="ti ti-history"></i>Historial</h2>
      <p class="block-note">${all.length} ${all.length === 1 ? 'torneo jugado' : 'torneos jugados'}. Tocá uno para ver cómo terminó.</p>
      <div class="stack">
        <input type="search" id="q" placeholder="Buscar por nombre" value="${esc(search)}">
      </div>
      ${list.length ? `<div class="log">${list.map(row).join('')}</div>` : `
        <div class="empty"><i class="ti ti-search-off"></i>
          <strong>Ningún torneo se llama así</strong>Probá con otra palabra.</div>`}
    </section>`;

  const input = view.querySelector('#q');
  input.oninput = e => {
    search = e.target.value;
    const at = e.target.selectionStart;
    renderHistory(view);
    const again = view.querySelector('#q');
    again.focus();
    again.setSelectionRange(at, at);
  };

  /* Esta vista se repinta a sí misma al buscar o desplegar, así que el
     listener se engancha una sola vez por contenedor. */
  if (view.dataset.wired) return;
  view.dataset.wired = '1';

  view.addEventListener('click', e => {
    const head = e.target.closest('[data-open]');
    if (head) {
      const id = head.dataset.open;
      openId = openId === id ? null : id;
      return renderHistory(view);
    }
    const del = e.target.closest('[data-del]');
    if (del) remove(del.dataset.del, view);
  });
}

function row(t) {
  const open = openId === t.id;
  const p = progress(t);
  const rows = finalTable(t);
  const podium = rows.slice(0, 3);

  return `<article class="log-item ${open ? 'open' : ''}">
    <div class="log-head" data-open="${t.id}">
      <div class="grow">
        <div class="nm">${esc(t.name)}
          <span class="tag ${t.finished ? 'done' : 'live'}">${t.finished ? 'terminado' : 'en juego'}</span>
        </div>
        <div class="sub">${shortDate(t.finishedAt || t.createdAt)} · ${esc(formatName(t.format))} · ${p.played}/${p.total} partidos</div>
      </div>
      ${t.champion ? `<span style="font-size:20px">${flag(t.champion)}</span>` : ''}
      <i class="ti ti-chevron-down chev"></i>
    </div>
    <div class="log-body">
      ${t.finished && podium.length ? `<div class="podium">
        ${podium.map((r, i) => `<div>${['🥇','🥈','🥉'][i]} ${flag(r.id)} ${esc(nameOf(r.id))}</div>`).join('')}
      </div>` : ''}
      ${t.format === 'copa' && t.bracket ? bracketView(t) : standingsTable(rows)}
      ${isAdmin() ? `<div style="margin-top:12px">
        <button class="btn danger sm" data-del="${t.id}">Borrar torneo</button>
      </div>` : ''}
    </div>
  </article>`;
}

function remove(id, view) {
  const at = state.tournaments.findIndex(t => t.id === id);
  if (at < 0) return;
  const copy = JSON.parse(JSON.stringify(state.tournaments[at]));

  update(() => { state.tournaments.splice(at, 1); });
  sayUndo(`Borraste «${copy.name}»`, () => {
    update(() => { state.tournaments.splice(at, 0, copy); });
    say('Torneo restaurado');
    renderHistory(view);
  });
  renderHistory(view);
}
