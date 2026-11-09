/* Única fuente de verdad. Las vistas leen de acá y se enteran de los cambios
   por suscripción: ninguna vista habla con Firebase directamente. */

import { firebaseConfig, DOC_PATH, LEGACY_DOC_PATH, LOCAL_KEY, TRASH_DAYS } from '../config.js';
import { uid, advance, isLive, isScheduled, kickoff } from '../domain/engine.js';

const listeners = new Set();
let db = null;
let online = false;
let writing = false;

export let state = blank();

function blank() {
  return { v: 2, tournaments: [], annualCups: [], annualDrafts: {}, sound: true };
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach(fn => fn(state));
}

/* ---------- Normalizar ---------- */

function normalize(raw) {
  const s = { ...blank(), ...(raw || {}) };
  s.tournaments = Array.isArray(s.tournaments) ? s.tournaments : [];
  s.annualCups = Array.isArray(s.annualCups) ? s.annualCups : [];
  s.annualDrafts = (s.annualDrafts && typeof s.annualDrafts === 'object') ? s.annualDrafts : {};
  s.sound = s.sound !== false;

  const seen = new Set();
  s.tournaments.forEach(t => {
    if (!t.id || seen.has(t.id)) t.id = uid();
    seen.add(t.id);
    t.games = Array.isArray(t.games) ? t.games : [];
    t.teamIds = Array.isArray(t.teamIds) ? t.teamIds : [];
    t.finished = !!t.finished;
    if (t.bracket) advance(t.bracket);
  });
  return s;
}

/* ---------- Traer lo de la versión 1 ---------- */

const FORMAT_V1 = { ida: 'ida', idavuelta: 'vuelta', grupos: 'copa' };

function importLegacy(old) {
  if (!old || !Array.isArray(old.tournaments)) return null;

  const eventFor = new Map();
  if (old.nextEvent?.tournamentId) {
    eventFor.set(old.nextEvent.tournamentId, old.nextEvent);
  }

  const tournaments = old.tournaments.map(t => {
    const ev = eventFor.get(t.id);
    return {
      id: String(t.id ?? uid()),
      name: t.name || 'Torneo',
      createdAt: t.date || new Date().toISOString(),
      format: FORMAT_V1[t.format] || 'ida',
      teamIds: [...(t.teamIds || [])],
      finished: !!t.finished,
      finishedAt: t.finishedDate || null,
      champion: t.champion || null,
      penWinner: null,
      when: ev ? { date: ev.date || '', time: ev.time || '' } : null,
      place: ev?.place || null,
      host: ev?.hostTeam || null,
      groups: t.groups || null,
      groupsConfig: t.groupsConfig
        ? { count: t.groupsConfig.numGroups, advance: t.groupsConfig.advancePerGroup }
        : null,
      bracket: t.playoffBracket ? {
        rounds: t.playoffBracket.totalRounds,
        games: (t.playoffBracket.matches || []).map(m => ({
          id: m.id, round: m.round, pos: m.pos,
          home: m.home, away: m.away,
          hg: m.hg ?? null, ag: m.ag ?? null,
          played: !!m.played, penWinner: m.winnerOverride || null, bye: !!m.bye
        }))
      } : null,
      games: (t.matches || []).map(m => ({
        id: m.id, day: m.matchday ?? 1,
        home: m.home, away: m.away, group: m.group ?? null,
        hg: m.hg ?? null, ag: m.ag ?? null, played: !!m.played
      }))
    };
  });

  return normalize({
    v: 2,
    tournaments,
    annualCups: (old.annualCups || []).map(c => ({
      id: String(c.id ?? uid()), year: c.year, champion: c.champion
    })),
    annualDrafts: {},
    sound: old.soundOn !== false
  });
}

/* ---------- Guardar ---------- */

let timer = null;

/* Un cambio no dispara una escritura: se juntan los cambios de medio segundo
   y se manda uno solo. Cargar cinco goles seguidos ya no son cinco viajes. */
function save() {
  emit();
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); } catch {}
  if (!db) return;
  clearTimeout(timer);
  timer = setTimeout(push, 500);
}

function push() {
  if (!db) return;
  writing = true;
  db.doc(DOC_PATH).set(state)
    .catch(err => console.warn('No se pudo guardar en la nube:', err))
    .finally(() => { setTimeout(() => { writing = false; }, 300); });
}

export function update(fn) {
  fn(state);
  save();
}

/* ---------- Arrancar ---------- */

export function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) state = normalize(JSON.parse(raw));
  } catch {}
  return state;
}

export async function connect({ onSyncStart, onSyncEnd } = {}) {
  try {
    if (!window.firebase) throw new Error('SDK no disponible');
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    online = true;
  } catch (err) {
    console.warn('Sin conexión a la nube, se trabaja local:', err);
    return false;
  }

  onSyncStart?.();
  let first = true;

  db.doc(DOC_PATH).onSnapshot(async snap => {
    if (first) { onSyncEnd?.(); first = false; }

    if (snap.exists) {
      if (writing) return;              // eco de nuestra propia escritura
      state = normalize(snap.data());
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); } catch {}
      emit();
      return;
    }

    // Primera vez: traemos todo lo que había en la versión 1.
    try {
      const legacy = await db.doc(LEGACY_DOC_PATH).get();
      const brought = legacy.exists ? importLegacy(legacy.data()) : null;
      if (brought && brought.tournaments.length) {
        state = brought;
        emit();
      }
    } catch (err) {
      console.warn('No se pudo importar la versión anterior:', err);
    }
    push();
  }, err => {
    onSyncEnd?.();
    console.warn('Se cortó la sincronización:', err);
  });

  return true;
}

/* ---------- Papelera ---------- */

/* Borrar no elimina: marca. Así se puede volver atrás durante TRASH_DAYS días. */
export const tournaments = () => state.tournaments.filter(t => !t.deletedAt);
export const trashed = () =>
  state.tournaments.filter(t => t.deletedAt)
    .sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

export const trashDaysLeft = t => {
  const gone = (Date.now() - new Date(t.deletedAt).getTime()) / 86400000;
  return Math.max(0, Math.ceil(TRASH_DAYS - gone));
};

export function sendToTrash(id) {
  const t = state.tournaments.find(x => x.id === id);
  if (!t) return null;
  update(() => { t.deletedAt = new Date().toISOString(); });
  return t;
}

export function restoreFromTrash(id) {
  const t = state.tournaments.find(x => x.id === id);
  if (!t) return null;
  update(() => { delete t.deletedAt; });
  return t;
}

export function emptyTrash() {
  update(() => { state.tournaments = state.tournaments.filter(t => !t.deletedAt); });
}

/* Se ejecuta al abrir: saca lo que ya cumplió el plazo. */
export function purgeTrash() {
  const limit = Date.now() - TRASH_DAYS * 86400000;
  const before = state.tournaments.length;
  const keep = state.tournaments.filter(t =>
    !t.deletedAt || new Date(t.deletedAt).getTime() > limit);
  if (keep.length === before) return 0;
  update(() => { state.tournaments = keep; });
  return before - keep.length;
}

/* ---------- Consultas de uso común ---------- */

/* El que se está jugando ahora. */
export const liveTournament = () =>
  tournaments().find(isLive) || null;

/* Los que están programados, del más cercano al más lejano. */
export const scheduled = () =>
  tournaments().filter(isScheduled)
    .sort((a, b) => (kickoff(a)?.getTime() ?? Infinity) - (kickoff(b)?.getTime() ?? Infinity));

/* El próximo que se viene. */
export const nextTournament = () => scheduled()[0] || null;

/* El que hay que mostrar primero: el que se juega, o si no el más cercano. */
export const featured = () => liveTournament() || nextTournament();

export const lastChampion = () =>
  tournaments()
    .filter(t => t.finished && t.champion)
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))[0] || null;


