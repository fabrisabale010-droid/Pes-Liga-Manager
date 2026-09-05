/* Premios anuales.

   Salen solos de las estadísticas del año: nadie los vota.
   Para inventar un premio nuevo, agregá una línea en las listas de abajo. */

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
    valor: t => `${Math.round(t.puntaje)}/100`,
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

/* Puntaje del Balón de Oro, del 0 al 100. Se reparte así:

     70 puntos  rendimiento: los puntos por partido sobre el máximo posible (3)
     20 puntos  títulos, comparado con el que más ganó en el año
     10 puntos  diferencia de gol por partido, comparada con la mejor del año

   Lo pensé para que el rendimiento pese lo principal, pero que ganar torneos
   y golear también sumen. Si querés cambiar el reparto, están acá los números. */
function calcularPuntajes(teams) {
  const maxTitulos = Math.max(1, ...teams.map(t => t.titulos));
  const maxDif = Math.max(0.01, ...teams.map(t => Math.max(0, prom(t.dg, t.pj))));

  return teams.map(t => {
    const rendimiento = Math.min(1, prom(t.pts, t.pj) / 3) * 70;
    const titulos = (t.titulos / maxTitulos) * 20;
    const diferencia = (Math.max(0, prom(t.dg, t.pj)) / maxDif) * 10;
    return { ...t, puntaje: Math.min(100, rendimiento + titulos + diferencia) };
  });
}

export function premiosDelAnio(year) {
  const base = crunch({ year }).teams.filter(t => t.pj >= MIN_PJ);
  if (!base.length) return null;
  const teams = calcularPuntajes(base);

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
    /* Mientras el año no termine, los premios pueden cambiar. */
    enCurso: year === new Date().getFullYear(),
    dorados: resolver(DORADOS),
    papelones: resolver(PAPELONES)
  };
}
