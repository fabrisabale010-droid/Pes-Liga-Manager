/* Todo lo que juntó una selección desde que existe la app: títulos, premios
   anuales y números. Sirve tanto para su ficha como para comparar dos. */

import { state, tournaments } from '../core/store.js';
import { crunch, years, headToHead } from './stats.js';
import { premiosDelAnio } from './awards.js';
import { TITLES_BEFORE_APP } from '../config.js';
import { TEAMS, nameOf } from './teams.js';

/* Títulos separados por tipo, como en la Vitrina. */
export function titulosDe(id) {
  let liga = 0, copa = 0;
  tournaments().forEach(t => {
    if (!t.finished || t.champion !== id) return;
    if (t.format === 'copa') copa++; else liga++;
  });

  const anual = (state.annualCups || []).filter(c => c.champion === id).length;
  const previos = TITLES_BEFORE_APP[id] || 0;

  return { liga, copa, anual, previos, total: liga + copa + anual + previos };
}

/* Todos los premios anuales que ganó, año por año. */
export function premiosDe(id) {
  const dorados = [], papelones = [];
  years().forEach(y => {
    const p = premiosDelAnio(y);
    if (!p) return;
    p.dorados.forEach(x => { if (x.equipo === id) dorados.push({ ...x, year: y, enCurso: p.enCurso }); });
    p.papelones.forEach(x => { if (x.equipo === id) papelones.push({ ...x, year: y, enCurso: p.enCurso }); });
  });
  return { dorados, papelones };
}

/* Podios: cuántas veces terminó primero, segundo o tercero. */
export function podiosDe(id) {
  const stats = crunch().teams.find(t => t.id === id);
  return {
    podios: stats?.podios || 0,
    finales: stats?.finales || 0,
    ultimos: stats?.ultimos || 0
  };
}

const vacio = id => ({
  id, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0, dg: 0,
  torneos: 0, titulos: 0, podios: 0, ultimos: 0, finales: 0,
  goleadasDadas: 0, goleadasRecibidas: 0,
  rachaG: 0, rachaP: 0, rachaSinGanar: 0, prom: 0
});

/* La ficha completa de una selección. */
export function perfil(id) {
  const stats = crunch().teams.find(t => t.id === id) || vacio(id);
  const titulos = titulosDe(id);
  const premios = premiosDe(id);

  return {
    id,
    nombre: nameOf(id),
    stats,
    titulos,
    premios,
    efectividad: stats.pj ? stats.pts / (stats.pj * 3) : 0,
    golesPorPartido: stats.pj ? stats.gf / stats.pj : 0,
    recibidosPorPartido: stats.pj ? stats.gc / stats.pj : 0
  };
}

/* Las que alguna vez jugaron o ganaron algo, ordenadas por títulos. */
export function seleccionesConHistoria() {
  const stats = new Map(crunch().teams.map(t => [t.id, t]));
  return TEAMS
    .map(t => ({ id: t.id, stats: stats.get(t.id), titulos: titulosDe(t.id) }))
    .filter(x => (x.stats && x.stats.pj > 0) || x.titulos.total > 0)
    .sort((a, b) =>
      b.titulos.total - a.titulos.total ||
      (b.stats?.pts || 0) - (a.stats?.pts || 0) ||
      nameOf(a.id).localeCompare(nameOf(b.id))
    );
}

/* Comparación cara a cara, con los números de cada uno al lado. */
export function comparar(a, b) {
  return {
    a: perfil(a),
    b: perfil(b),
    duelo: headToHead(a, b)
  };
}

/* Qué fila gana en una comparación: 1 el primero, 2 el segundo, 0 empate.
   `menosEsMejor` sirve para goles recibidos y derrotas. */
export const quienGana = (x, y, menosEsMejor = false) => {
  if (x === y) return 0;
  const mayor = x > y ? 1 : 2;
  return menosEsMejor ? (mayor === 1 ? 2 : 1) : mayor;
};

export const FILAS_COMPARACION = [
  { label: 'Títulos',              valor: p => p.titulos.total },
  { label: 'Torneos jugados',      valor: p => p.stats.torneos },
  { label: 'Partidos',             valor: p => p.stats.pj },
  { label: 'Ganados',              valor: p => p.stats.pg },
  { label: 'Empatados',            valor: p => p.stats.pe },
  { label: 'Perdidos',             valor: p => p.stats.pp, menos: true },
  { label: 'Goles a favor',        valor: p => p.stats.gf },
  { label: 'Goles en contra',      valor: p => p.stats.gc, menos: true },
  { label: 'Diferencia',           valor: p => p.stats.dg, texto: p => (p.stats.dg > 0 ? '+' : '') + p.stats.dg },
  { label: 'Puntos',               valor: p => p.stats.pts },
  { label: 'Efectividad',          valor: p => p.efectividad, texto: p => Math.round(p.efectividad * 100) + '%' },
  { label: 'Goles por partido',    valor: p => p.golesPorPartido, texto: p => p.golesPorPartido.toFixed(2) },
  { label: 'Recibidos por partido',valor: p => p.recibidosPorPartido, texto: p => p.recibidosPorPartido.toFixed(2), menos: true },
  { label: 'Goleadas puestas',     valor: p => p.stats.goleadasDadas },
  { label: 'Goleadas recibidas',   valor: p => p.stats.goleadasRecibidas, menos: true },
  { label: 'Mejor racha ganadora', valor: p => p.stats.rachaG },
  { label: 'Peor racha sin ganar', valor: p => p.stats.rachaSinGanar, menos: true },
  { label: 'Veces en el podio',    valor: p => p.stats.podios },
  { label: 'Veces último',         valor: p => p.stats.ultimos, menos: true }
];
