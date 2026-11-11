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

let recTab = 'presumir';

const REC_TABS = [
  { id:'presumir', label:'Para presumir' },
  { id:'cargar',   label:'Para cargarse' },
  { id:'partidos', label:'Partidos' }
];

/* El listener se engancha una sola vez por visita; cambiar de filtro o de
   pestaña sólo vuelve a dibujar. (Antes se sumaba uno nuevo en cada cambio
   y "Compartir" se disparaba varias veces.) */
export function renderShowcase(view) {
  const paint = () => {
    view.innerHTML = `
      <section class="block">
        <h2>${cup()}Vitrina</h2>
        <p class="block-note">Las ligas, las copas y la Copa Anual se cuentan por separado, más los títulos que ya existían antes de la app.</p>
        <div class="opts stack" role="tablist" aria-label="Tipo de título">
          ${FILTERS.map(f => `<button class="opt ${filter === f.id ? 'on' : ''}" role="tab"
            aria-selected="${filter === f.id}" data-filter="${f.id}">${f.label}</button>`).join('')}
        </div>
        ${cabinet()}
      </section>
      ${records()}`;
  };

  view.addEventListener('click', async e => {
    const f = e.target.closest('[data-filter]');
    if (f) { filter = f.dataset.filter; return paint(); }

    const rt = e.target.closest('[data-rec-tab]');
    if (rt) { recTab = rt.dataset.recTab; return paint(); }

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

  paint();
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

/* Los tres primeros en un podio; el resto en una lista con una barra que
   muestra cuánto le falta a cada uno para alcanzar al que más ganó. */
function cabinet() {
  const list = Object.entries(counts()).sort((a, b) => b[1] - a[1] || nameOf(a[0]).localeCompare(nameOf(b[0])));
  if (!list.length) {
    return `<div class="empty"><i class="ti ti-trophy-off"></i>
      <strong>Vitrina vacía</strong>Todavía nadie ganó un torneo de este tipo.</div>`;
  }
  const best = list[0][1];
  const total = list.reduce((n, [, v]) => n + v, 0);

  /* Puesto real: los que empatan comparten lugar. */
  let lugar = 0, previo = null;
  const ranked = list.map(([id, n], i) => {
    if (n !== previo) { lugar = i + 1; previo = n; }
    return { id, n, lugar };
  });

  const share = (id, n) => `<button class="rec-share slot-share" data-share-slot="${id}:${n}"
      title="Compartir" aria-label="Compartir los títulos de ${esc(nameOf(id))}"><i class="ti ti-share-2"></i></button>`;

  const top3 = ranked.slice(0, 3);
  /* En el podio el primero va al medio, como en una entrega de premios. */
  const orden = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
  const podio = `<div class="shelf" role="list" aria-label="Podio de títulos">
    ${orden.map(r => `<div class="shelf-step p${r.lugar}" role="listitem">
      ${share(r.id, r.n)}
      <span class="shelf-crest">${crest(r.id, r.lugar === 1 ? 104 : 76)}</span>
      <span class="shelf-name">${esc(nameOf(r.id))}</span>
      <span class="shelf-n"><b>${r.n}</b> ${r.n === 1 ? 'título' : 'títulos'}</span>
      <span class="shelf-base">${r.lugar}º</span>
    </div>`).join('')}
  </div>`;

  const resto = ranked.slice(3);
  const filas = resto.length ? `<ol class="rank-list" aria-label="Resto de la vitrina">
    ${resto.map(r => `<li class="rank-row">
      <span class="rank-pos">${r.lugar}</span>
      <span class="rank-who">${flag(r.id)}<span>${esc(nameOf(r.id))}</span></span>
      <span class="meter" role="img" aria-label="${r.n} de ${best}"><i style="width:${Math.round(r.n / best * 100)}%"></i></span>
      <span class="rank-n">${r.n}</span>
      ${share(r.id, r.n)}
    </li>`).join('')}
  </ol>` : '';

  return `${podio}${filas}
    <div class="shelf-foot">
      <span>${total} ${total === 1 ? 'título' : 'títulos'} entre ${list.length} ${list.length === 1 ? 'selección' : 'selecciones'}</span>
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

  const partidos = (g || mg) ? [
    g ? card(g.gap, '', duelo(g.m), 'la diferencia más grande', 0, null, g.m, g.t) : '',
    mg ? card(mg.total, '', duelo(mg.m), 'el partido con más goles', 0, null, mg.m, mg.t) : ''
  ].join('') : '';

  const tabs = REC_TABS.filter(x => x.id !== 'partidos' || partidos);
  if (!tabs.some(x => x.id === recTab)) recTab = 'presumir';
  const nota = {
    presumir: `Sobre ${d.partidos} partidos y ${d.goles} goles. Para entrar hay que tener ${MIN_PJ} partidos o más.`,
    cargar: 'Esto también queda guardado. No es personal, son los números.',
    partidos: 'Los partidos que nadie se olvida.'
  }[recTab];
  const cuerpo = recTab === 'cargar' ? mal : recTab === 'partidos' ? partidos : bien;

  return `
    <section class="block">
      <h2><i class="ti ti-award"></i>Récords</h2>
      <div class="opts stack" role="tablist" aria-label="Tipo de récord">
        ${tabs.map(x => `<button class="opt ${recTab === x.id ? 'on' : ''}" role="tab"
          aria-selected="${recTab === x.id}" data-rec-tab="${x.id}">${x.label}</button>`).join('')}
      </div>
      <p class="block-note">${nota}</p>
      <div class="recs">${cuerpo}</div>
    </section>`;
}
