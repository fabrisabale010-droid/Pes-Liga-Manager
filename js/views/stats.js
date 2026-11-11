import { flag, esc, nameOf, crest } from '../ui/ui.js';
import { mainColorOf } from '../domain/teams.js';
import { crunch, byPoints, byAverage, byTitles, years, reached, coming } from '../domain/stats.js';
import { tournaments } from '../core/store.js';
import { playedAt } from '../domain/engine.js';

let tab = 'puntos';
let year = null;          // null = toda la historia

const TABS = [
  { id:'puntos',   label:'Puntos' },
  { id:'promedio', label:'Promedio' },
  { id:'titulos',  label:'Títulos' },
  { id:'hitos',    label:'Hitos' }
];

export function renderStats(view) {
  const paint = () => { view.innerHTML = html(); };

  view.addEventListener('click', e => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; return paint(); }
    const y = e.target.closest('[data-year]');
    if (y) { year = y.dataset.year === 'todo' ? null : Number(y.dataset.year); return paint(); }
  });

  paint();
}

/* ---------- Hitos ---------- */

function hitos() {
  const teams = crunch().teams.filter(t => t.pj > 0);
  if (!teams.length) return `<div class="empty"><i class="ti ti-flag"></i>
    <strong>Todavía no hay hitos</strong>Se van marcando solos a medida que juegan.</div>`;

  const logrados = reached(teams);
  const cerca = coming(teams);

  const ficha = (h, pendiente) => `
    <article class="rec hito ${h.metric.good ? '' : 'bad'}">
      <div class="rec-n"><b>${h.step}</b></div>
      <div class="rec-b">
        <div class="rec-w">${flag(h.id)} <span>${esc(nameOf(h.id))}</span></div>
        <div class="rec-l">
          ${h.metric.label}
          ${pendiente ? ` · le faltan ${h.missing}` : ` · va por ${h.value}`}
        </div>
        ${pendiente ? `<span class="meter" role="img" aria-label="${h.value} de ${h.step}">
          <i style="width:${Math.min(100, Math.round(h.value / h.step * 100))}%"></i></span>` : ''}
      </div>
    </article>`;

  return `
    ${cerca.length ? `
      <h3 style="margin:6px 0 4px">Están por caer</h3>
      <p class="block-note">A quince o menos de alcanzar el próximo escalón.</p>
      <div class="recs" style="margin-bottom:22px">${cerca.map(h => ficha(h, true)).join('')}</div>
    ` : ''}
    <h3 style="margin:6px 0 4px">Ya alcanzados</h3>
    <p class="block-note">Los escalones van de 25 en 25 hasta 100, y después de a cientos.</p>
    ${logrados.length
      ? `<div class="recs">${logrados.map(h => ficha(h, false)).join('')}</div>`
      : `<div class="empty"><i class="ti ti-flag"></i>
          <strong>Ninguno llegó al primer escalón</strong>El primero es a los 25.</div>`}`;
}



function html() {
  if (!tournaments().length) {
    return `<section class="block"><div class="empty">
      <i class="ti ti-chart-bar"></i><strong>Todavía no hay números</strong>
      Cuando se juegue el primer torneo, acá aparece todo.
    </div></section>`;
  }

  return `<section class="block">
    <h2><i class="ti ti-chart-bar"></i>Estadísticas</h2>
    <p class="block-note">Todo lo que dejaron los torneos, sumado.</p>

    <div class="opts stack" role="tablist" aria-label="Qué ver">
      ${TABS.map(t => `<button class="opt ${tab === t.id ? 'on' : ''}" role="tab"
        aria-selected="${tab === t.id}" data-tab="${t.id}">${t.label}</button>`).join('')}
    </div>

    ${tab === 'hitos' ? '' : yearPicker(false)}
    ${tab === 'hitos' ? '' : kpis()}
    ${tab === 'hitos' ? '' : spotlight()}
    ${tab === 'puntos'   ? tablaPuntos()   : ''}
    ${tab === 'promedio' ? tablaPromedio() : ''}
    ${tab === 'titulos'  ? tablaTitulos()  : ''}
    ${tab === 'hitos'    ? hitos()         : ''}
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

/* Los números grandes del período elegido. */
function kpis() {
  const d = crunch({ year });
  const jugados = tournaments().filter(t => t.finished && (!year || playedAt(t).getFullYear() === year)).length;
  if (!d.partidos && !jugados) return '';
  const tile = (v, l) => `<div class="kpi"><span class="kpi-l">${l}</span><b class="kpi-v">${v}</b></div>`;
  return `<div class="kpis">
    ${tile(jugados, 'Torneos terminados')}
    ${tile(d.partidos, 'Partidos')}
    ${tile(d.goles, 'Goles')}
    ${tile(d.partidos ? (d.goles / d.partidos).toFixed(1) : '0', 'Goles por partido')}
  </div>`;
}

/* El que manda en la tabla elegida, destacado arriba. */
function spotlight() {
  const all = rows();
  const lider =
    tab === 'puntos'   ? byPoints(all.filter(r => r.pj > 0))[0] :
    tab === 'promedio' ? byAverage(all)[0] :
    tab === 'titulos'  ? byTitles(all)[0] : null;
  if (!lider) return '';
  const [valor, unidad] =
    tab === 'puntos'   ? [lider.pts, 'puntos'] :
    tab === 'promedio' ? [lider.prom.toFixed(2), 'puntos por partido'] :
                         [lider.titulos, lider.titulos === 1 ? 'título' : 'títulos'];
  return `<div class="spot">
    <span class="spot-crest">${crest(lider.id, 64)}</span>
    <span class="spot-txt">
      <span class="spot-k">Líder${year ? ' ' + year : ''}</span>
      <strong>${esc(nameOf(lider.id))}</strong>
    </span>
    <span class="spot-v"><b>${valor}</b><span>${unidad}</span></span>
  </div>`;
}

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

