/* Números de toda la historia. Los usa tanto la Vitrina (récords) como
   Estadísticas (tablas históricas y cara a cara). */

import { state } from '../core/store.js';
import { finalTable } from './engine.js';
import { nameOf } from './teams.js';

/* Todos los partidos jugados, en el orden real en que ocurrieron.
   Hace falta ese orden para poder calcular rachas que crucen torneos. */
export function allGames({ year = null } = {}) {
  const out = [];
  [...state.tournaments]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach(t => {
      if (year && new Date(t.createdAt).getFullYear() !== year) return;
      const grupos = [...t.games].sort((a, b) => a.day - b.day || a.id - b.id);
      const llaves = t.bracket
        ? [...t.bracket.games].filter(m => !m.bye && m.home && m.away)
            .sort((a, b) => a.round - b.round || a.pos - b.pos)
        : [];
      [...grupos, ...llaves].forEach(m => { if (m.played) out.push({ m, t }); });
    });
  return out;
}

export function years() {
  return [...new Set(state.tournaments.map(t => new Date(t.createdAt).getFullYear()))]
    .sort((a, b) => b - a);
}

const empty = id => ({
  id, pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, pts:0,
  torneos:0, titulos:0, podios:0, ultimos:0, finales:0,
  goleadasDadas:0, goleadasRecibidas:0,
  rachaG:0, rachaP:0, rachaSinGanar:0,
  _g:0, _p:0, _s:0
});

export function crunch({ year = null } = {}) {
  const byTeam = new Map();
  const get = id => {
    if (!byTeam.has(id)) byTeam.set(id, empty(id));
    return byTeam.get(id);
  };

  let goles = 0, partidos = 0, mayorGoleada = null, masGoles = null;

  state.tournaments.forEach(t => {
    if (year && new Date(t.createdAt).getFullYear() !== year) return;
    t.teamIds.forEach(id => { get(id).torneos++; });
  });

  allGames({ year }).forEach(({ m }) => {
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

    if (m.hg > m.ag) h.pts += 3;
    else if (m.ag > m.hg) a.pts += 3;
    else { h.pts++; a.pts++; }

    const pen = m.penWinner || null;
    const ganaH = m.hg > m.ag || pen === m.home;
    const ganaA = m.ag > m.hg || pen === m.away;

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
      h._g = a._g = h._p = a._p = 0;
      h._s++; a._s++;
    }

    [h, a].forEach(x => {
      x.rachaG = Math.max(x.rachaG, x._g);
      x.rachaP = Math.max(x.rachaP, x._p);
      x.rachaSinGanar = Math.max(x.rachaSinGanar, x._s);
    });
  });

  state.tournaments.forEach(t => {
    if (!t.finished) return;
    if (year && new Date(t.createdAt).getFullYear() !== year) return;
    const orden = finalTable(t);
    if (t.champion) get(t.champion).titulos++;
    orden.slice(0, 3).forEach(r => { get(r.id).podios++; });
    if (orden.length > 2) get(orden[orden.length - 1].id).ultimos++;
    if (t.format === 'copa' && t.bracket) {
      const fin = t.bracket.games.find(m => m.round === t.bracket.rounds);
      if (fin && fin.home && fin.away) { get(fin.home).finales++; get(fin.away).finales++; }
    }
  });

  const teams = [...byTeam.values()]
    .map(x => ({ ...x, dg: x.gf - x.gc, prom: x.pj ? x.pts / x.pj : 0 }))
    .filter(x => x.pj > 0 || x.torneos > 0);

  return { teams, goles, partidos, mayorGoleada, masGoles };
}

export const byPoints = teams =>
  [...teams].sort((a, b) =>
    b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || nameOf(a.id).localeCompare(nameOf(b.id)));

export const byAverage = teams =>
  [...teams].filter(t => t.pj > 0)
    .sort((a, b) => b.prom - a.prom || b.pts - a.pts || nameOf(a.id).localeCompare(nameOf(b.id)));

export const byTitles = teams =>
  [...teams].filter(t => t.titulos > 0)
    .sort((a, b) => b.titulos - a.titulos || b.podios - a.podios);

/* ---------- Cara a cara ---------- */

export function headToHead(a, b) {
  const games = allGames()
    .filter(({ m }) =>
      (m.home === a && m.away === b) || (m.home === b && m.away === a));

  const res = { pj:0, ganóA:0, ganóB:0, empates:0, golesA:0, golesB:0, games };

  games.forEach(({ m }) => {
    res.pj++;
    const gA = m.home === a ? m.hg : m.ag;
    const gB = m.home === a ? m.ag : m.hg;
    res.golesA += gA; res.golesB += gB;
    const pen = m.penWinner;
    if (gA > gB || pen === a) res.ganóA++;
    else if (gB > gA || pen === b) res.ganóB++;
    else res.empates++;
  });

  return res;
}

/* ---------- Hitos ---------- */

const STEPS = [25, 50, 100, 150, 200, 300, 400, 500, 750, 1000];

export const METRICS = [
  { key:'gf',  label:'goles a favor',   icon:'ti-ball-football', good:true },
  { key:'pts', label:'puntos sumados',  icon:'ti-medal',         good:true },
  { key:'pg',  label:'partidos ganados',icon:'ti-trophy',        good:true },
  { key:'pj',  label:'partidos jugados',icon:'ti-history',       good:true },
  { key:'gc',  label:'goles recibidos', icon:'ti-shield-off',    good:false },
  { key:'pp',  label:'partidos perdidos',icon:'ti-mood-sad',     good:false }
];

/* Para un valor devuelve el último escalón alcanzado y cuánto falta para el próximo. */
export function milestone(value) {
  const done = [...STEPS].reverse().find(s => value >= s) ?? null;
  const next = STEPS.find(s => s > value) ?? null;
  return { done, next, missing: next === null ? null : next - value };
}

/* Todo lo alcanzado, de lo más grande a lo más chico. */
export function reached(teams) {
  const out = [];
  teams.forEach(t => {
    METRICS.forEach(m => {
      const { done } = milestone(t[m.key] ?? 0);
      if (done) out.push({ id: t.id, metric: m, step: done, value: t[m.key] });
    });
  });
  return out.sort((a, b) => b.step - a.step || a.metric.key.localeCompare(b.metric.key));
}

/* Lo que está por caer: sirve para saber qué mirar el próximo torneo. */
export function coming(teams, within = 15) {
  const out = [];
  teams.forEach(t => {
    METRICS.forEach(m => {
      const value = t[m.key] ?? 0;
      if (!value) return;
      const { next, missing } = milestone(value);
      if (next !== null && missing <= within) {
        out.push({ id: t.id, metric: m, step: next, missing, value });
      }
    });
  });
  return out.sort((a, b) => a.missing - b.missing || b.step - a.step);
}
