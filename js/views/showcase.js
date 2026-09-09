import { flag, esc, nameOf, cup, crest } from '../ui/ui.js';
import { titlesCount } from '../ui/parts.js';
import { tournaments } from '../core/store.js';
import { crunch } from '../domain/stats.js';
import { recordCard, cabinetCard, cabinetAllCard, compartirImagen } from '../ui/cards.js';
import { annualTitles } from '../domain/annual.js';
import { TITLES_BEFORE_APP } from '../config.js';

let filter = 'todo';

const ETIQUETA = {
  todo: 'Todos los títulos',
  liga: 'Títulos de liga',
  copa: 'Títulos de copa',
  previo: 'Títulos previos a la app',
  anual: 'Copas Anuales'
};

const FILTERS = [
  { id:'todo',   label:'Todo' },
  { id:'liga',   label:'Ligas' },
  { id:'copa',   label:'Copas' },
  { id:'previo', label:'Antes de la app' },
  { id:'anual',  label:'Copa Anual' }
];

export function renderShowcase(view) {
  view.innerHTML = `
    <section class="block">
      <h2>${cup()}Vitrina</h2>
      <p class="block-note">Las ligas, las copas y la Copa Anual se cuentan por separado, más los títulos que ya existían antes de la app.</p>
      <div class="opts stack">
        ${FILTERS.map(f => `<button class="opt ${filter === f.id ? 'on' : ''}" data-filter="${f.id}">${f.label}</button>`).join('')}
      </div>
      ${cabinet()}
    </section>
    ${records()}`;

  view.addEventListener('click', async e => {
    const slot = e.target.closest('[data-share-slot]');
    if (slot) return compartirSlot(slot);

    const todos = e.target.closest('[data-share-cabinet]');
    if (todos) return compartirVitrina(todos);

    const hit = e.target.closest('[data-rec]');
    if (!hit) return;
    const datos = (window._recs || [])[Number(hit.dataset.rec)];
    if (!datos) return;
    const quienes = (datos.holders || []).map(nameOf).join(' y ');
    const nombre = quienes ? quienes.replace(/ y /g, '-')
      : datos.match ? `${nameOf(datos.match.home)}-${nameOf(datos.match.away)}` : 'record';
    const detalle = quienes ? ' — ' + quienes
      : datos.match ? ` — ${nameOf(datos.match.home)} ${datos.match.hg}-${datos.match.ag} ${nameOf(datos.match.away)}` : '';
    compartirImagen(hit, () => recordCard(datos), `record-${nombre}`,
      `${datos.value}${datos.unit} ${datos.label}${detalle}`);
  });

  view.querySelector('.opts').addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    filter = btn.dataset.filter;
    renderShowcase(view);
  });
}

/* ---------- Vitrina ---------- */

function counts() {
  if (filter === 'previo') return { ...TITLES_BEFORE_APP };
  if (filter === 'anual') return annualTitles();
  const out = filter === 'todo' ? { ...TITLES_BEFORE_APP } : {};
  tournaments().forEach(t => {
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
      <button class="rec-share slot-share" data-share-slot="${id}:${n}" title="Compartir" aria-label="Compartir">
        <i class="ti ti-share-2"></i>
      </button>
      <span class="fl">${crest(id, 92)}</span>
      <span class="nm">${esc(nameOf(id))}</span>
      <span class="n"><b>${n}</b>${cup()}</span>
      <span class="u">${n === 1 ? 'título' : 'títulos'}</span>
    </div>`).join('')}</div>
    <div style="margin-top:12px">
      <button class="btn sm" data-share-cabinet><i class="ti ti-share-2"></i>Compartir la vitrina</button>
    </div>`;
}

function compartirSlot(btn) {
  const [id, n] = btn.dataset.shareSlot.split(':');
  compartirImagen(btn, () => cabinetCard(id, Number(n), ETIQUETA[filter]),
    `vitrina-${nameOf(id)}`,
    `${nameOf(id)} · ${n} ${Number(n) === 1 ? 'título' : 'títulos'}`);
}

function compartirVitrina(btn) {
  const lista = Object.entries(counts()).sort((a, b) => b[1] - a[1]);
  if (!lista.length) return;
  compartirImagen(btn, () => cabinetAllCard(lista, ETIQUETA[filter]),
    'vitrina', `🏆 La vitrina: ${lista.map(([id, n]) => `${nameOf(id)} ${n}`).join(' · ')}`);
}

/* ---------- Récords ---------- */

const MIN_PJ = 3;

function records() {
  const d = crunch();
  const jugaron = d.teams.filter(x => x.pj > 0);
  if (!jugaron.length) return '';

  const pool = jugaron.filter(x => x.pj >= MIN_PJ);
  const base = pool.length ? pool : jugaron;

  /* Devuelven TODOS los que empatan en la punta, no solo el primero:
     si dos pusieron la misma cantidad de goleadas, aparecen los dos. */
  const top = (fn, alReves = false) => {
    const valor = alReves ? (x => -fn(x)) : fn;
    const mejor = Math.max(...base.map(valor));
    return base.filter(x => valor(x) === mejor);
  };
  const best  = fn => top(fn)[0];
  const worst = fn => top(fn, true)[0];
  const ef = x => x.pts / (x.pj * 3);
  const dec = v => Number(v).toFixed(2);
  const who = x => `${flag(x.id)} <span>${esc(nameOf(x.id))}</span>`;

  /* Varios empatados: se muestran todos, uno al lado del otro. */
  const todos = lista => lista.length === 1
    ? who(lista[0])
    : lista.map(x => `${flag(x.id)} <span>${esc(nameOf(x.id))}</span>`).join('<i class="y">y</i>');

  /* Cada ficha guarda sus datos crudos para poder dibujar la imagen. */
  const guardadas = [];
  const card = (value, unit, holder, label, bad, equipos, match, contexto) => {
    const lista = Array.isArray(equipos) ? equipos.map(x => x.id ?? x)
                : equipos ? [equipos] : [];
    const i = guardadas.push({
      value, unit, label, bad: !!bad,
      holders: lista,
      holder: lista[0] || null,
      match: match || null,
      contexto: contexto ? { name: contexto.name, date: contexto.finishedAt || contexto.createdAt } : null
    }) - 1;
    return `
    <article class="rec ${bad ? 'bad' : ''}">
      <div class="rec-n"><b>${value}</b>${unit ? `<i>${unit}</i>` : ''}</div>
      <div class="rec-b">
        <div class="rec-w">${holder}</div>
        <div class="rec-l">${label}</div>
      </div>
      <button class="rec-share" data-rec="${i}" title="Compartir" aria-label="Compartir">
        <i class="ti ti-share-2"></i>
      </button>
    </article>`;
  };
  window._recs = guardadas;

  const titulos  = Object.entries(titlesCount()).sort((a, b) => b[1] - a[1])[0];
  const puntos   = best(x => x.pts);
  const wins     = best(x => x.pg);
  const ataque   = best(x => x.gf / x.pj);
  const valla    = worst(x => x.gc / x.pj);
  const efect    = best(ef);
  const rachaG   = best(x => x.rachaG);
  const goleador = best(x => x.goleadasDadas);
  const podios   = best(x => x.podios);

  const bien = [
    titulos ? card(titulos[1], '', `${flag(titulos[0])} <span>${esc(nameOf(titulos[0]))}</span>`, 'títulos ganados', 0, titulos[0]) : '',
    card(puntos.pts, '', todos(top(x => x.pts)), 'puntos sumados en total', 0, top(x => x.pts)),
    card(wins.pg, '', todos(top(x => x.pg)), 'partidos ganados', 0, top(x => x.pg)),
    card(dec(ataque.gf / ataque.pj), '', who(ataque), 'goles por partido', 0, ataque.id),
    card(dec(valla.gc / valla.pj), '', who(valla), 'goles recibidos por partido', 0, valla.id),
    card(Math.round(ef(efect) * 100), '%', who(efect), 'de los puntos que jugó', 0, efect.id),
    rachaG.rachaG > 1 ? card(rachaG.rachaG, '', todos(top(x => x.rachaG)), 'victorias al hilo', 0, top(x => x.rachaG)) : '',
    goleador.goleadasDadas ? card(goleador.goleadasDadas, '', todos(top(x => x.goleadasDadas)), 'goleadas puestas', 0, top(x => x.goleadasDadas)) : '',
    podios.podios ? card(podios.podios, '', todos(top(x => x.podios)), 'veces en el podio', 0, top(x => x.podios)) : ''
  ].filter(Boolean).join('');

  const derrotas  = best(x => x.pp);
  const colador   = best(x => x.gc / x.pj);
  const flojito   = worst(x => x.gf / x.pj);
  const sinGanar  = best(x => x.rachaSinGanar);
  const rachaP    = best(x => x.rachaP);
  const humillado = best(x => x.goleadasRecibidas);
  const empatador = best(x => x.pe);
  const peorEf    = worst(ef);
  const ultimo    = best(x => x.ultimos);
  const secos     = [...base].filter(x => x.titulos === 0 && x.torneos > 0)
                             .sort((a, b) => b.torneos - a.torneos)[0];

  const mal = [
    card(derrotas.pp, '', todos(top(x => x.pp)), 'partidos perdidos', 1, top(x => x.pp)),
    card(dec(colador.gc / colador.pj), '', who(colador), 'goles recibidos por partido', 1, colador.id),
    card(dec(flojito.gf / flojito.pj), '', who(flojito), 'goles por partido, el ataque más flojo', 1, flojito.id),
    sinGanar.rachaSinGanar > 1 ? card(sinGanar.rachaSinGanar, '', todos(top(x => x.rachaSinGanar)), 'partidos seguidos sin ganar', 1, top(x => x.rachaSinGanar)) : '',
    rachaP.rachaP > 1 ? card(rachaP.rachaP, '', todos(top(x => x.rachaP)), 'derrotas al hilo', 1, top(x => x.rachaP)) : '',
    humillado.goleadasRecibidas ? card(humillado.goleadasRecibidas, '', todos(top(x => x.goleadasRecibidas)), 'goleadas recibidas', 1, top(x => x.goleadasRecibidas)) : '',
    empatador.pe ? card(empatador.pe, '', todos(top(x => x.pe)), 'empates, el rey del punto', 1, top(x => x.pe)) : '',
    card(Math.round(ef(peorEf) * 100), '%', who(peorEf), 'de los puntos que jugó, la peor cosecha', 1, peorEf.id),
    ultimo.ultimos ? card(ultimo.ultimos, '', todos(top(x => x.ultimos)), 'veces último en la tabla', 1, top(x => x.ultimos)) : '',
    secos ? card(secos.torneos, '', who(secos), 'torneos jugados sin ganar ninguno', 1, secos.id) : ''
  ].filter(Boolean).join('');

  const g = d.mayorGoleada, mg = d.masGoles;
  const duelo = m =>
    `${flag(m.home)} <span>${esc(nameOf(m.home))} ${m.hg}–${m.ag} ${esc(nameOf(m.away))}</span> ${flag(m.away)}`;

  return `
    <section class="block">
      <h2><i class="ti ti-award"></i>Para presumir</h2>
      <p class="block-note">Sobre ${d.partidos} partidos y ${d.goles} goles. Para entrar hay que tener ${MIN_PJ} partidos o más.</p>
      <div class="recs">${bien}</div>
    </section>

    <section class="block">
      <h2><i class="ti ti-mood-sad"></i>Para cargarse un rato</h2>
      <p class="block-note">Esto también queda guardado. No es personal, son los números.</p>
      <div class="recs">${mal}</div>
    </section>

    ${(g || mg) ? `<section class="block">
      <h2><i class="ti ti-flame"></i>Partidos que quedaron</h2>
      <div class="recs">
        ${g ? card(g.gap, '', duelo(g.m), 'la diferencia más grande', 0, null, g.m, g.t) : ''}
        ${mg ? card(mg.total, '', duelo(mg.m), 'el partido con más goles', 0, null, mg.m, mg.t) : ''}
      </div>
    </section>` : ''}`;
}
