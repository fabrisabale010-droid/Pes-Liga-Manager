import { flag, esc, nameOf, say, sayUndo, clip, whenDate } from '../ui/ui.js';
import { standingsTable, bracketView } from '../ui/parts.js';
import { tableCard, share } from '../ui/cards.js';
import { tournaments, trashed, trashDaysLeft,
         sendToTrash, restoreFromTrash, emptyTrash } from '../core/store.js';
import { finalTable, formatName, progress } from '../domain/engine.js';
import { isAdmin } from '../core/auth.js';

let search = '';
let openId = null;
let showTrash = false;

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

  view.addEventListener('click', e => {
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
  const p = progress(t);
  const rows = finalTable(t);
  const podium = rows.slice(0, 3);

  return `<article class="log-item ${open ? 'open' : ''}">
    <div class="log-head" data-open="${t.id}">
      <div class="grow">
        <div class="nm">${esc(t.name)}
          <span class="tag ${t.finished ? 'done' : 'live'}">${t.finished ? 'terminado' : 'en juego'}</span>
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
      ${standingsTable(rows)}
      <div class="row" style="margin-top:12px">
        ${t.finished ? `<button class="btn sm" data-share-table="${t.id}" style="flex:0 0 auto">
          <i class="ti ti-share-2"></i>Compartir tabla</button>` : ''}
        ${isAdmin() ? `<button class="btn danger sm" data-del="${t.id}" style="flex:0 0 auto">Borrar torneo</button>` : ''}
      </div>
    </div>
  </article>`;
}

async function compartirTabla(btn) {
  const t = tournaments().find(x => x.id === btn.dataset.shareTable);
  if (!t) return;
  btn.disabled = true;
  try {
    const res = await share(await tableCard(t, finalTable(t)),
      `tabla-${t.name.replace(/[^a-z0-9]+/gi, '-')}`,
      `📋 ${t.name}${t.champion ? ' — campeón ' + nameOf(t.champion) : ''}`);
    if (res === 'descargada') say('Tu celular no deja compartir: se guardó en Descargas');
  } catch (err) {
    say('No se pudo compartir: ' + (err.name || err.message || 'error'));
  }
  btn.disabled = false;
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
