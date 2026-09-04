/* Premios. Dos tipos muy distintos:

   - Los ANUALES salen solos de las estadísticas del año. Nadie los vota.
   - Los DE LA COPA los votan ustedes al terminar cada torneo.

   Para inventar un premio nuevo, agregá una línea en las listas de abajo.
   Para cambiar las categorías de votación, editá POLL_CATEGORIES. */

import { crunch } from './stats.js';
import { nameOf } from './teams.js';

const MIN_PJ = 3;                  // partidos mínimos para entrar en un premio

const prom = (a, b) => (b ? a / b : 0);
const uno = x => Number(x).toFixed(2);

/* ---------- Premios anuales ---------- */

export const DORADOS = [
  {
    id: 'balon',
    nombre: 'Balón de Oro',
    detalle: 'el mejor del año, todo junto',
    icono: 'ti-award',
    valor: t => uno(t.puntaje),
    orden: t => t.puntaje,
    pie: t => `${t.pts} puntos · ${t.titulos} ${t.titulos === 1 ? 'título' : 'títulos'} · ${t.dg > 0 ? '+' : ''}${t.dg} de diferencia`
  },
  {
    id: 'bota',
    nombre: 'Bota de Oro',
    detalle: 'el que más goles metió',
    icono: 'ti-ball-football',
    valor: t => t.gf,
    orden: t => t.gf,
    pie: t => `${uno(prom(t.gf, t.pj))} por partido`
  },
  {
    id: 'guante',
    nombre: 'Guante de Oro',
    detalle: 'la valla menos vencida',
    icono: 'ti-shield-check',
    valor: t => uno(prom(t.gc, t.pj)),
    orden: t => -prom(t.gc, t.pj),
    pie: t => `${t.gc} goles en ${t.pj} partidos`
  },
  {
    id: 'ganador',
    nombre: 'El Ganador',
    detalle: 'el que más partidos ganó',
    icono: 'ti-trophy',
    valor: t => t.pg,
    orden: t => t.pg,
    pie: t => `de ${t.pj} jugados`
  },
  {
    id: 'verdugo',
    nombre: 'El Verdugo',
    detalle: 'el que más goleadas puso',
    icono: 'ti-swords',
    valor: t => t.goleadasDadas,
    orden: t => t.goleadasDadas,
    pie: t => 'ganó por tres o más',
    exige: t => t.goleadasDadas > 0
  },
  {
    id: 'regular',
    nombre: 'El Metrónomo',
    detalle: 'el más regular, punto por punto',
    icono: 'ti-activity',
    valor: t => uno(prom(t.pts, t.pj)),
    orden: t => prom(t.pts, t.pj),
    pie: t => `${t.pts} puntos en ${t.pj} partidos`
  },
  {
    id: 'racha',
    nombre: 'La Aplanadora',
    detalle: 'la racha ganadora más larga',
    icono: 'ti-flame',
    valor: t => t.rachaG,
    orden: t => t.rachaG,
    pie: () => 'victorias al hilo',
    exige: t => t.rachaG > 1
  }
];

export const PAPELONES = [
  {
    id: 'colador',
    nombre: 'El Colador',
    detalle: 'el que más goles se comió',
    icono: 'ti-shield-off',
    valor: t => t.gc,
    orden: t => t.gc,
    pie: t => `${uno(prom(t.gc, t.pj))} por partido`
  },
  {
    id: 'perdedor',
    nombre: 'El Perdedor',
    detalle: 'el que más partidos perdió',
    icono: 'ti-mood-sad',
    valor: t => t.pp,
    orden: t => t.pp,
    pie: t => `de ${t.pj} jugados`
  },
  {
    id: 'goleado',
    nombre: 'El Bailado',
    detalle: 'el que más goleadas se comió',
    icono: 'ti-mood-cry',
    valor: t => t.goleadasRecibidas,
    orden: t => t.goleadasRecibidas,
    pie: () => 'perdió por tres o más',
    exige: t => t.goleadasRecibidas > 0
  },
  {
    id: 'empatador',
    nombre: 'El Rey del Empate',
    detalle: 'el que más veces repartió',
    icono: 'ti-equal',
    valor: t => t.pe,
    orden: t => t.pe,
    pie: t => `de ${t.pj} jugados`,
    exige: t => t.pe > 0
  },
  {
    id: 'seco',
    nombre: 'El Seco',
    detalle: 'el ataque más flojo',
    icono: 'ti-droplet-off',
    valor: t => uno(prom(t.gf, t.pj)),
    orden: t => -prom(t.gf, t.pj),
    pie: t => `${t.gf} goles en ${t.pj} partidos`
  },
  {
    id: 'sequia',
    nombre: 'La Sequía',
    detalle: 'la racha más larga sin ganar',
    icono: 'ti-snowflake',
    valor: t => t.rachaSinGanar,
    orden: t => t.rachaSinGanar,
    pie: () => 'partidos sin ganar',
    exige: t => t.rachaSinGanar > 1
  },
  {
    id: 'aspirante',
    nombre: 'El Eterno Aspirante',
    detalle: 'jugó y jugó, pero no ganó nada',
    icono: 'ti-hourglass',
    valor: t => t.torneos,
    orden: t => t.torneos,
    pie: () => 'torneos sin salir campeón',
    exige: t => t.titulos === 0 && t.torneos > 0
  }
];

/* Puntaje del Balón de Oro: los puntos por partido pesan lo principal,
   los títulos empujan fuerte y la diferencia de gol desempata. */
const puntaje = t =>
  prom(t.pts, t.pj) * 10 + t.titulos * 6 + prom(t.dg, t.pj) * 2;

export function premiosDelAnio(year) {
  const teams = crunch({ year }).teams
    .filter(t => t.pj >= MIN_PJ)
    .map(t => ({ ...t, puntaje: puntaje(t) }));

  if (!teams.length) return null;

  const resolver = lista => lista.map(p => {
    const aptos = p.exige ? teams.filter(p.exige) : teams;
    if (!aptos.length) return null;
    const ganador = [...aptos].sort((a, b) => p.orden(b) - p.orden(a))[0];
    return {
      ...p,
      equipo: ganador.id,
      valorTexto: String(p.valor(ganador)),
      pieTexto: p.pie(ganador)
    };
  }).filter(Boolean);

  return {
    year,
    dorados: resolver(DORADOS),
    papelones: resolver(PAPELONES)
  };
}

/* ---------- Premios de la copa (votados) ---------- */

export const POLL_CATEGORIES = [
  { id: 'puflito',  nombre: 'Puflito de la copa',    detalle: 'el que se infló y no rindió' },
  { id: 'buscon',   nombre: 'Buscón de la copa',     detalle: 'el que la buscó toda la noche' },
  { id: 'colafacil',nombre: 'Cola fácil de la copa', detalle: 'al que le entraban todas' },
  { id: 'golosina', nombre: 'Golosina de la copa',   detalle: 'el más dulce, el que todos querían' }
];

export const votosDe = (t, catId) => (t.awards?.[catId]) || {};

export const totalVotos = (t, catId) =>
  Object.values(votosDe(t, catId)).reduce((a, b) => a + b, 0);

export const votosDisponibles = (t, catId) =>
  Math.max(0, t.teamIds.length - totalVotos(t, catId));

/* Quién ganó una categoría. Si hay empate, devuelve a todos. */
export function ganadoresDe(t, catId) {
  const votos = votosDe(t, catId);
  const max = Math.max(0, ...Object.values(votos));
  if (!max) return [];
  return Object.keys(votos).filter(id => votos[id] === max);
}

export const votacionCompleta = t =>
  POLL_CATEGORIES.every(c => votosDisponibles(t, c.id) === 0);

export function resumenVotacion(t) {
  return POLL_CATEGORIES.map(c => ({
    ...c,
    ganadores: ganadoresDe(t, c.id),
    votos: votosDe(t, c.id),
    total: totalVotos(t, c.id),
    faltan: votosDisponibles(t, c.id)
  }));
}

export const nombreDe = nameOf;
