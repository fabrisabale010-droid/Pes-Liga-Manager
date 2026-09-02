/* Copa Anual: cierra el año enfrentando al que más puntos sumó contra el que
   más torneos ganó. Si es el mismo, se lo espera en la final mientras los
   segundos de cada tabla definen quién lo enfrenta. */

import { state, update } from '../core/store.js';
import { crunch, byPoints, byTitles } from './stats.js';
import { uid } from './engine.js';

export const cupOf = year =>
  (state.annualCups || []).find(c => c.year === year) || null;

const draftKey = year => `annual_${year}`;

export const draftOf = year =>
  (state.annualDrafts || {})[draftKey(year)] || null;

/* ---------- Quiénes se cruzan ---------- */

export function matchup(year) {
  const teams = crunch({ year }).teams;
  const porPuntos = byPoints(teams.filter(t => t.pj > 0));
  const porTitulos = byTitles(teams);

  if (porPuntos.length < 2 || !porTitulos.length) return null;

  const lider = porPuntos[0].id;
  const campeon = porTitulos[0].id;

  if (lider !== campeon) {
    return {
      kind: 'directa',
      lider, campeon,
      final: [lider, campeon]
    };
  }

  /* El mismo equipo lidera las dos tablas: espera en la final. */
  const segundoPuntos = porPuntos[1]?.id ?? null;
  const segundoTitulos = porTitulos[1]?.id ?? null;

  if (segundoTitulos && segundoPuntos && segundoTitulos !== segundoPuntos) {
    return {
      kind: 'repechaje',
      espera: lider,
      duelo: [segundoPuntos, segundoTitulos]
    };
  }

  const rival = segundoTitulos || segundoPuntos;
  if (!rival || rival === lider) return null;

  /* Ganó todos los torneos del año: no hay con quién armar el repechaje,
     así que lo espera el segundo en puntos. */
  return { kind: 'barrida', lider, rival, final: [lider, rival] };
}

/* ---------- Armar y jugar ---------- */

const newGame = (home, away) => ({
  home, away, hg: null, ag: null, played: false, penWinner: null
});

export function start(year) {
  const cross = matchup(year);
  if (!cross) return null;

  const draft = cross.kind === 'repechaje'
    ? { year, stage: 'repechaje', waiting: cross.espera,
        semi: newGame(cross.duelo[0], cross.duelo[1]), final: null }
    : { year, stage: 'final', waiting: null,
        semi: null, final: newGame(cross.final[0], cross.final[1]) };

  update(() => {
    state.annualDrafts = state.annualDrafts || {};
    state.annualDrafts[draftKey(year)] = draft;
  });
  return draft;
}

export function winnerOf(game) {
  if (!game) return null;
  if (game.penWinner) return game.penWinner;
  if (game.played && game.hg !== game.ag) return game.hg > game.ag ? game.home : game.away;
  return null;
}

/* Cuando se resuelve el repechaje, se arma sola la final. */
export function refresh(year) {
  const d = draftOf(year);
  if (!d || d.stage !== 'repechaje') return d;
  const pasa = winnerOf(d.semi);
  if (!pasa) return d;
  update(() => {
    d.stage = 'final';
    d.final = d.final || newGame(d.waiting, pasa);
  });
  return d;
}

export function crown(year) {
  const d = draftOf(year);
  const champ = winnerOf(d?.final);
  if (!champ) return null;

  update(() => {
    state.annualCups = state.annualCups || [];
    state.annualCups.push({ id: uid(), year, champion: champ });
    delete state.annualDrafts[draftKey(year)];
  });
  return champ;
}

export function removeCup(id) {
  const at = (state.annualCups || []).findIndex(c => String(c.id) === String(id));
  if (at < 0) return null;
  const copy = { ...state.annualCups[at] };
  update(() => { state.annualCups.splice(at, 1); });
  return { copy, at };
}

export function restoreCup(copy, at) {
  update(() => { state.annualCups.splice(at, 0, copy); });
}

export function cancelDraft(year) {
  update(() => { delete state.annualDrafts[draftKey(year)]; });
}

export const annualTitles = () => {
  const out = {};
  (state.annualCups || []).forEach(c => {
    out[c.champion] = (out[c.champion] || 0) + 1;
  });
  return out;
};
