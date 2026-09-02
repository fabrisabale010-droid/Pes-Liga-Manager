import { flag, esc, nameOf } from '../ui/ui.js';
import { titlesCount } from '../ui/parts.js';
import { state } from '../core/store.js';
import { table, finalTable, tieWinner } from '../domain/engine.js';
import { TITLES_BEFORE_APP } from '../config.js';

let filter = 'todo';

const FILTERS = [
  { id:'todo',   label:'Todo' },
  { id:'liga',   label:'Ligas' },
  { id:'copa',   label:'Copas' },
  { id:'previo', label:'Antes de la app' }
];

export function renderShowcase(view) {
  view.innerHTML = `
    <section class="block">
      <h2><i class="ti ti-trophy"></i>Vitrina</h2>
      <p class="block-note">Las ligas y las copas se cuentan por separado, más los títulos que ya existían antes de la app.</p>
      <div class="opts stack">
        ${FILTERS.map(f => `<button class="opt ${filter === f.id ? 'on' : ''}" data-filter="${f.id}">${f.label}</button>`).join('')}
      </div>
      ${cabinet()}
    </section>
    ${records()}`;

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
  const out = filter === 'todo' ? { ...TITLES_BEFORE_APP } : {};
  state.tournaments.forEach(t => {
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
      <span class="fl">${flag(id)}</span>
      <div class="nm">${esc(nameOf(id))}</div>
      <div class="n">${n}<i class="ti ti-trophy"></i></div>
      <div class="u">${n === 1 ? 'título' : 'títulos'}</div>
    </div>`).join('')}</div>`;
}

/* ---------- Números de toda la historia ---------- */

/* Recorre todos los partidos en orden para poder calcular rachas. */
function crunch() {
  const byTeam = new Map();
  const get = id => {
    if (!byTeam.has(id)) byTeam.set(id, {
      id, pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, pts:0,
      torneos:0, titulos:0, podios:0, ultimos:0, finales:0,
      goleadasDadas:0, goleadasRecibidas:0,
      rachaG:0, rachaP:0, rachaSinGanar:0,
      _g:0, _p:0, _s:0
    });
    return byTeam.get(id);
  };

  let goles = 0, partidos = 0, mayorGoleada = null, masGoles = null;

  const orden = [...state.tournaments]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  orden.forEach(t => {
    t.teamIds.forEach(id => { get(id).torneos++; });

    const games = [
      ...[...t.games].sort((a, b) => a.day - b.day || a.id - b.id),
      ...(t.bracket ? [...t.bracket.games]
            .filter(m => !m.bye && m.home && m.away)
            .sort((a, b) => a.round - b.round || a.pos - b.pos) : [])
    ];

    games.forEach(m => {
      if (!m.played) return;
      partidos++;
      goles += m.hg + m.ag;

      const gap = Math.abs(m.hg - m.ag);
      const total = m.hg + m.ag;
      if (!mayorGoleada || gap > mayorGoleada.gap) mayorGoleada = { m, gap };
      if (!masGoles || total > masGoles.total) masGoles = { m, total };

      const h = get(m.home), a = get(m.away);
      h.pj++; a.pj++;
      h.gf += m.hg; h.gc += m.ag;
      a.gf += m.ag; a.gc += m.hg;

      const pen = m.penWinner || null;
      const ganaH = m.hg > m.ag || pen === m.home;
      const ganaA = m.ag > m.hg || pen === m.away;

      if (m.hg > m.ag) { h.pts += 3; }
      else if (m.ag > m.hg) { a.pts += 3; }
      else { h.pts++; a.pts++; }

      if (ganaH && !ganaA) {
        h.pg++; a.pp++;
        if (gap >= 3) { h.goleadasDadas++; a.goleadasRecibidas++; }
        h._g++; h._p = 0; h._s = 0;
        a._p++; a._g = 0; a._s++;
      } else if (ganaA && !ganaH) {
        a.pg++; h.pp++;
        if (gap >= 3) { a.goleadasDadas++; h.goleadasRecibidas++; }
        a._g++; a._p = 0; a._s = 0;
        h._p++; h._g = 0; h._s++;
      } else {
        h.pe++; a.pe++;
        h._g = 0; a._g = 0; h._p = 0; a._p = 0; h._s++; a._s++;
      }

      [h, a].forEach(x => {
        x.rachaG = Math.max(x.rachaG, x._g);
        x.rachaP = Math.max(x.rachaP, x._p);
        x.rachaSinGanar = Math.max(x.rachaSinGanar, x._s);
      });
    });

    if (t.finished) {
      const orden2 = finalTable(t);
      if (t.champion) get(t.champion).titulos++;
      orden2.slice(0, 3).forEach(r => { get(r.id).podios++; });
      if (orden2.length > 2) get(orden2[orden2.length - 1].id).ultimos++;
      if (t.format === 'copa' && t.bracket) {
        const fin = t.bracket.games.find(m => m.round === t.bracket.rounds);
        if (fin && fin.home && fin.away) {
          get(fin.home).finales++; get(fin.away).finales++;
        }
      }
    }
  });

  return {
    teams: [...byTeam.values()].filter(x => x.pj > 0),
    goles, partidos, mayorGoleada, masGoles
  };
}

/* ---------- Récords ---------- */

const MIN_PJ = 3;

function records() {
  const d = crunch();
  if (!d.teams.length) return '';

  const pool = d.teams.filter(x => x.pj >= MIN_PJ);
  const base = pool.length ? pool : d.teams;

  const best  = (fn) => [...base].sort((a, b) => fn(b) - fn(a))[0];
  const worst = (fn) => [...base].sort((a, b) => fn(a) - fn(b))[0];

  const ef = x => x.pts / (x.pj * 3);
  const num = (v, dec = 2) => Number(v).toFixed(dec);

  const line = (label, who, value, bad) => `
    <div class="rec ${bad ? 'bad' : ''}">
      <div class="rec-v">${value}</div>
      <div class="rec-t">
        <strong>${who}</strong>
        <span>${label}</span>
      </div>
    </div>`;

  const team = x => `${flag(x.id)} ${esc(nameOf(x.id))}`;

  /* --- Para presumir --- */
  const titulos = Object.entries(titlesCount()).sort((a, b) => b[1] - a[1])[0];
  const puntos  = best(x => x.pts);
  const wins    = best(x => x.pg);
  const ataque  = best(x => x.gf / x.pj);
  const valla   = worst(x => x.gc / x.pj);
  const efect   = best(ef);
  const rachaG  = best(x => x.rachaG);
  const goleador= best(x => x.goleadasDadas);
  const podios  = best(x => x.podios);

  const bien = [
    titulos ? line('títulos ganados', `${flag(titulos[0])} ${esc(nameOf(titulos[0]))}`, titulos[1]) : '',
    line('puntos sumados en total', team(puntos), puntos.pts),
    line('partidos ganados', team(wins), wins.pg),
    line('goles por partido', team(ataque), num(ataque.gf / ataque.pj)),
    line('goles recibidos por partido', team(valla), num(valla.gc / valla.pj)),
    line('de los puntos en juego', team(efect), Math.round(ef(efect) * 100) + '%'),
    rachaG.rachaG > 1 ? line('victorias al hilo', team(rachaG), rachaG.rachaG) : '',
    goleador.goleadasDadas ? line('goleadas puestas', team(goleador), goleador.goleadasDadas) : '',
    podios.podios ? line('veces en el podio', team(podios), podios.podios) : ''
  ].filter(Boolean).join('');

  /* --- Para cargarse --- */
  const derrotas = best(x => x.pp);
  const colador  = best(x => x.gc / x.pj);
  const flojito  = worst(x => x.gf / x.pj);
  const sinGanar = best(x => x.rachaSinGanar);
  const rachaP   = best(x => x.rachaP);
  const humillado= best(x => x.goleadasRecibidas);
  const empatador= best(x => x.pe);
  const peorEf   = worst(ef);
  const ultimo   = best(x => x.ultimos);
  const secos    = [...base].filter(x => x.titulos === 0 && x.torneos > 0)
                            .sort((a, b) => b.torneos - a.torneos)[0];

  const mal = [
    line('partidos perdidos', team(derrotas), derrotas.pp, 1),
    line('goles recibidos por partido', team(colador), num(colador.gc / colador.pj), 1),
    line('goles por partido, el ataque más flojo', team(flojito), num(flojito.gf / flojito.pj), 1),
    sinGanar.rachaSinGanar > 1 ? line('partidos seguidos sin ganar', team(sinGanar), sinGanar.rachaSinGanar, 1) : '',
    rachaP.rachaP > 1 ? line('derrotas al hilo', team(rachaP), rachaP.rachaP, 1) : '',
    humillado.goleadasRecibidas ? line('goleadas recibidas', team(humillado), humillado.goleadasRecibidas, 1) : '',
    empatador.pe ? line('empates, el rey del punto', team(empatador), empatador.pe, 1) : '',
    line('de los puntos en juego, la peor cosecha', team(peorEf), Math.round(ef(peorEf) * 100) + '%', 1),
    ultimo.ultimos ? line('veces último en la tabla', team(ultimo), ultimo.ultimos, 1) : '',
    secos ? line('torneos jugados sin ganar ninguno', team(secos), secos.torneos, 1) : ''
  ].filter(Boolean).join('');

  /* --- Partidos memorables --- */
  const g = d.mayorGoleada, mg = d.masGoles;
  const partido = m =>
    `${flag(m.home)} ${esc(nameOf(m.home))} ${m.hg}–${m.ag} ${esc(nameOf(m.away))} ${flag(m.away)}`;

  return `
    <section class="block">
      <h2><i class="ti ti-award"></i>Para presumir</h2>
      <p class="block-note">Sobre ${d.partidos} partidos y ${d.goles} goles.
        Para entrar hay que tener al menos ${MIN_PJ} partidos jugados.</p>
      <div class="recs">${bien}</div>
    </section>

    <section class="block">
      <h2><i class="ti ti-mood-sad"></i>Para cargarse un rato</h2>
      <p class="block-note">Todo esto también queda guardado. No es personal, son los números.</p>
      <div class="recs">${mal}</div>
    </section>

    ${(g || mg) ? `<section class="block">
      <h2><i class="ti ti-flame"></i>Partidos que quedaron</h2>
      <div class="recs">
        ${g ? line('la goleada más grande', partido(g.m), `${g.gap}`) : ''}
        ${mg ? line('el partido con más goles', partido(mg.m), `${mg.total}`) : ''}
      </div>
    </section>` : ''}`;
}
