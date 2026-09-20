import { flag, esc, nameOf, say, sayUndo, clip, whenDate, askConfirm } from '../ui/ui.js';
import { standingsTable, bracketView, fixtureView, skeleton } from '../ui/parts.js';
import { tableCard, compartirImagen } from '../ui/cards.js';
import { openFixtureShare } from '../ui/fixtureShare.js';
import { tournaments, trashed, trashDaysLeft, isLoading,
         sendToTrash, restoreFromTrash, emptyTrash } from '../core/store.js';
import { finalTable, formatName, progress, isLive } from '../domain/engine.js';
import { isAdmin } from '../core/auth.js';

let search = '';
let openId = null;
let showTrash = false;
const tabs = {};              // qué pestaña tiene abierta cada torneo: 'tabla' | 'partidos'

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
  };

  view.addEventListener('keydown', e => {
    const head = e.target.closest?.('[data-open]');
    if (head && e.target === head && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      head.click();
    }
  });

  view.addEventListener('click', e => {
    const head = e.target.closest('[data-open]');
    if (head) {
      openId = openId === head.dataset.open ? null : head.dataset.open;
      return paint();
    }
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      const at = tab.dataset.tab.lastIndexOf(':');
      tabs[tab.dataset.tab.slice(0, at)] = tab.dataset.tab.slice(at + 1);
      return paint();
    }

    const compartir = e.target.closest('[data-share-table]');
    if (compartir) return compartirTabla(compartir);

    const fx = e.target.closest('[data-share-fixture]');
    if (fx) {
      const t = tournaments().find(x => x.id === fx.dataset.shareFixture);
      if (t) openFixtureShare(t);
      return;
    }

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
      const n = trashed().length;
      askConfirm({
        title: '¿Vaciar la papelera?',
        text: `${n === 1 ? 'Se va 1 torneo' : `Se van ${n} torneos`} para siempre. No hay vuelta atrás.`,
        yes: 'Sí, vaciar'
      }).then(ok => {
        if (!ok) return;
        emptyTrash();
        say('Papelera vacía');
        paint();
      });
      return;
    }
  });

  paint();
}

function html() {
  if (isLoading()) return skeleton();
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
    <p class="block-note">${all.length} ${all.length === 1 ? 'torneo' : 'torneos'}. Tocá uno para ver cómo terminó.</p>
    <div class="stack">
      <input type="search" id="q" placeholder="Buscar por nombre" value="${esc(search)}">
    </div>
    ${list.length ? `<div class="log">${list.map(row).join('')}</div>` : `
      <div class="empty"><i class="ti ti-search-off"></i>
        <strong>Ningún torneo se llama así</strong>Probá con otra palabra.</div>`}
  </section>
  ${trashBlock()}`;
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
        Se recuperan de acá durante 7 días. Después se borran solos.
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
function cuandoSeJugo(t) {
  const programada = whenDate(t.when);
  if (programada) return programada;
  return new Date(t.finishedAt || t.createdAt);
}

function row(t) {
  const open = openId === t.id;
  const tab = tabs[t.id] || 'tabla';
  const p = progress(t);
  const rows = finalTable(t);
  const podium = rows.slice(0, 3);

  return `<article class="log-item ${open ? 'open' : ''}">
    <div class="log-head" data-open="${t.id}" role="button" tabindex="0" aria-expanded="${open}">
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
      <div class="seg" role="tablist" aria-label="Qué ver de este torneo">
        ${[['tabla', 'Tabla', 'ti-list-numbers'], ['partidos', 'Partidos', 'ti-clipboard-list']].map(([k, label, icon]) => `
          <button role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-tab="${t.id}:${k}">
            <i class="ti ${icon}" aria-hidden="true"></i>${label}
          </button>`).join('')}
      </div>
      ${tab === 'partidos' ? `
        ${t.format === 'copa' && t.bracket ? `<div class="fixture-head">Llaves</div>${bracketView(t)}` : ''}
        ${fixtureView(t)}` : `
        ${t.format === 'copa' && t.bracket ? bracketView(t) : ''}
        ${standingsTable(rows)}`}
      <div class="row" style="margin-top:12px">
        <button class="btn sm" data-share-fixture="${t.id}" style="flex:0 0 auto">
          <i class="ti ti-share-2" aria-hidden="true"></i>${t.finished ? 'Compartir resultados' : 'Compartir fixture'}</button>
        ${t.finished ? `<button class="btn sm" data-share-table="${t.id}" style="flex:0 0 auto">
          <i class="ti ti-share-2" aria-hidden="true"></i>Compartir tabla</button>` : ''}
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
