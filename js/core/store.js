/* Única fuente de verdad. Las vistas leen de acá y se enteran de los cambios
   por suscripción: ninguna vista habla con Firebase directamente. */

import { firebaseConfig, DOC_PATH, LEGACY_DOC_PATH, LOCAL_KEY, TRASH_DAYS } from '../config.js';
import { uid, advance, isLive, isScheduled, kickoff, playedAt } from '../domain/engine.js';
import { merge3, clone, same } from './merge.js';
import { isAdmin } from './auth.js';

const listeners = new Set();
let db = null;
let online = false;
let writing = false;

/* La última foto que se vio de la nube. Sirve de punto de partida para
   fundir lo que cambió acá con lo que cambió otro organizador mientras tanto. */
let base = null;
let dirty = false;          // hay cambios locales que todavía no subieron
let edits = 0;              // cuenta cambios, para saber si hubo alguno durante un guardado
let retry = null;

/* Se resuelve con la primera respuesta de la nube (o enseguida si no hay nube). */
let syncedResolve;
const synced = new Promise(r => { syncedResolve = r; });
export const whenSynced = () => synced;

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
let pendingRemote = null;   // lo que llegó de la nube mientras se guardaba

/* Avisos de que el estado cambió por algo que vino de afuera (otro celular):
   las pantallas se tienen que volver a dibujar con los datos nuevos. */
const remoteListeners = new Set();
export function onRemoteChange(fn) {
  remoteListeners.add(fn);
  return () => remoteListeners.delete(fn);
}

const persist = () => {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); } catch {}
};

/* Compara dos estados sin mirar el número de revisión. */
const sameContent = (a, b) => same({ ...a, rev: 0 }, { ...b, rev: 0 });

/* Reemplaza el estado sólo si de verdad cambió algo: así las pantallas que
   tienen agarrado un torneo no se quedan apuntando a una copia vieja. */
function adopt(next) {
  if (sameContent(next, state)) { state.rev = next.rev; persist(); return; }
  state = next;
  persist();
  emit();
  remoteListeners.forEach(fn => fn(state));
}

/* Un cambio no dispara una escritura: se juntan los cambios de medio segundo
   y se manda uno solo. Cargar cinco goles seguidos ya no son cinco viajes.
   Sólo el organizador escribe en la nube: los demás nunca pueden pisar nada. */
function save() {
  emit();
  persist();
  edits++;
  if (!db || !isAdmin()) return;
  dirty = true;
  clearTimeout(timer);
  timer = setTimeout(push, 500);
}

/* Guarda fundiendo con lo que haya en la nube en ese momento. Si otro
   organizador cargó algo mientras tanto, se conservan los cambios de los dos
   en vez de que el último pise al primero. */
async function push(force = false) {
  if (!db || (!force && !isAdmin())) return;
  if (writing) { clearTimeout(timer); timer = setTimeout(push, 500); return; }

  writing = true;
  clearTimeout(retry);
  const sent = clone(state);
  const startEdits = edits;
  const ref = db.doc(DOC_PATH);

  try {
    const merged = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const remote = snap.exists ? snap.data() : null;
      const out = normalize(clone(remote && base ? merge3(base, sent, remote) : sent));
      out.rev = Math.max(remote?.rev || 0, base?.rev || 0) + 1;
      tx.set(ref, out);
      return out;
    });

    base = clone(merged);
    if (edits === startEdits) {
      dirty = false;
      adopt(normalize(clone(merged)));
    } else {
      /* Se siguió cargando mientras se guardaba: lo nuevo va encima de lo
         guardado, y el próximo guardado (ya programado) lo sube. */
      adopt(normalize(merge3(sent, clone(state), clone(merged))));
    }
  } catch (err) {
    console.warn('No se pudo guardar en la nube, se reintenta:', err);
    retry = setTimeout(() => push(force), 5000);
  } finally {
    writing = false;
    if (pendingRemote) {
      const r = pendingRemote;
      pendingRemote = null;
      applyRemote(r);
    }
  }
}

/* Llega una versión de la nube. Las más viejas que la última conocida se
   ignoran (son ecos); si hay cambios locales sin subir, se funden. */
let gotFirst = false;
function applyRemote(remote) {
  if (gotFirst && base && (remote.rev || 0) < (base.rev || 0)) return;
  if (writing) {
    if (!pendingRemote || (remote.rev || 0) >= (pendingRemote.rev || 0)) pendingRemote = remote;
    return;
  }
  const next = dirty && base ? merge3(base, clone(state), remote) : remote;
  gotFirst = true;
  base = clone(remote);
  adopt(normalize(clone(next)));
}

export function update(fn) {
  fn(state);
  save();
}

/* Si se cortó internet con cambios sin subir, se mandan al volver. */
window.addEventListener('online', () => { if (dirty) push(); });

/* ---------- Arrancar ---------- */

export function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) state = normalize(JSON.parse(raw));
  } catch {}
  /* Lo último guardado en el teléfono es lo último que se supo de la nube:
     sirve de punto de partida hasta que llegue la primera respuesta. */
  base = clone(state);
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
    syncedResolve(false);
    return false;
  }

  onSyncStart?.();
  let first = true;

  db.doc(DOC_PATH).onSnapshot(async snap => {
    if (first) { onSyncEnd?.(); first = false; }

    if (snap.exists) {
      if (snap.metadata.hasPendingWrites) return;
      applyRemote(snap.data());
      syncedResolve(true);
      return;
    }

    // Primera vez: traemos todo lo que había en la versión 1.
    try {
      const legacy = await db.doc(LEGACY_DOC_PATH).get();
      const brought = legacy.exists ? importLegacy(legacy.data()) : null;
      if (brought && brought.tournaments.length) {
        state = brought;
        emit();
        remoteListeners.forEach(fn => fn(state));
      }
    } catch (err) {
      console.warn('No se pudo importar la versión anterior:', err);
    }
    base = null;
    await push(true);
    syncedResolve(true);
  }, err => {
    onSyncEnd?.();
    syncedResolve(false);
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
    .sort((a, b) => new Date(b.finishedAt || playedAt(b)) - new Date(a.finishedAt || playedAt(a)))[0] || null;


