/* Única fuente de verdad. Las vistas leen de acá y se enteran de los cambios
   por suscripción: ninguna vista habla con Firebase directamente. */

import { firebaseConfig, DOC_PATH, LEGACY_DOC_PATH, LOCAL_KEY, TRASH_DAYS } from '../config.js';
import { uid, advance, isLive, isScheduled, kickoff } from '../domain/engine.js';
import { merge3, same, clone } from './merge.js';

const BASE_KEY = LOCAL_KEY + '_base';

const listeners = new Set();
const statusWatchers = new Set();
let db = null;
let ref = null;

/* `base` es la última copia que sabemos que está en la nube. Con ella se
   distingue qué cambió cada organizador y se fusiona en vez de pisar. */
let base = null;
let synced = false;        // ya llegó al menos una copia real de la nube

export let state = blank();

function blank() {
  return { v: 2, tournaments: [], annualCups: [], annualDrafts: {}, sound: true };
}

/* `source` dice de dónde vino el cambio: 'local' (lo hizo este celular) o
   'remote' (lo hizo otro organizador y llegó por la nube). */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(source = 'local') {
  listeners.forEach(fn => fn(state, source));
}

/* 'local' sin nube · 'sync' buscando · 'ok' todo guardado ·
   'saving' guardando · 'error' hay cambios que todavía no subieron */
let status = 'local';
export const syncStatus = () => status;

/* Un dispositivo nuevo, sin nada guardado, mientras busca en la nube: hasta
   que llegue algo no se sabe si "no hay torneos" es cierto. */
export const isLoading = () => status === 'sync' && !state.tournaments.length;
export function onSyncStatus(fn) {
  statusWatchers.add(fn);
  return () => statusWatchers.delete(fn);
}
function setStatus(next) {
  if (next === status) return;
  status = next;
  statusWatchers.forEach(fn => fn(status));
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

    /* "Jugado" se deduce de los goles. Así, si dos organizadores cargan el
       mismo partido a la vez y la fusión mezcla campos, nunca queda un partido
       a medias marcado como jugado. */
    const fixPlayed = g => {
      if (g.bye) return;
      g.played = Number.isInteger(g.hg) && Number.isInteger(g.ag);
    };
    t.games.forEach(fixPlayed);
    if (t.bracket) {
      t.bracket.games = Array.isArray(t.bracket.games) ? t.bracket.games : [];
      t.bracket.games.forEach(fixPlayed);
      advance(t.bracket);
    }
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

/* Por qué así (y no `set(state)` a secas):
   guardar todo el documento pisaba lo que otro organizador hubiera cargado
   desde la última vez que este celular se enteró. Ahora cada guardado corre
   dentro de una transacción: se lee lo que hay en la nube, se fusiona con lo
   que cambió acá (ver merge.js) y recién ahí se escribe. Nada se sobreescribe
   a ciegas, y nada se sube antes de haber visto la copia real de la nube. */

let timer = null;
let retryTimer = null;
let retryMs = 4000;
let pushing = false;
let bytes = 0;

/* Quién puede guardar en la nube. Con cuentas reales, sólo los organizadores:
   quien mira no intenta escribir (las reglas de Firestore se lo rechazarían
   y quedaría reintentando sin parar). Lo cambia app.js con `setWriteGuard`. */
let canWrite = () => true;
export const setWriteGuard = fn => { canWrite = fn; };

/* Al iniciar sesión, lo que quedó pendiente sube en el momento. */
export const flushSoon = () => schedulePush(0);

/* Cuánto pesa lo guardado. Firestore admite 1 MB por documento. */
export const stateBytes = () => bytes;

function persist() {
  try {
    const raw = JSON.stringify(state);
    bytes = raw.length;
    localStorage.setItem(LOCAL_KEY, raw);
    if (base) localStorage.setItem(BASE_KEY, JSON.stringify(base));
  } catch {}
}

const hasPending = () => !base || !same(state, base);

/* Un cambio no dispara una escritura: se juntan los cambios de medio segundo
   y se manda uno solo. Cargar cinco goles seguidos ya no son cinco viajes. */
function save() {
  persist();
  emit('local');
  schedulePush(500);
}

function schedulePush(delay) {
  if (!db || !synced) return;               // nunca antes de ver la nube
  if (!hasPending() || !canWrite()) { setStatus('ok'); return; }
  setStatus('saving');
  clearTimeout(timer);
  timer = setTimeout(push, delay);
}

/* Una copia por día de lo que había en la nube justo antes de escribir.
   Si algún día algo sale mal, hay de dónde recuperar. Es un extra: si la base
   de datos no lo permite, se ignora y el guardado sigue igual. */
function backupOnce(remote) {
  if (!remote || !remote.tournaments?.length) return;
  const day = new Date().toISOString().slice(0, 10);
  const key = LOCAL_KEY + '_backup_day';
  try {
    if (localStorage.getItem(key) === day) return;
    localStorage.setItem(key, day);
  } catch {}
  db.doc(`${DOC_PATH.split('/')[0]}/respaldo_v2_${day}`)
    .set({ at: new Date().toISOString(), data: JSON.stringify(remote) })
    .catch(() => {});
}

async function push() {
  if (!db || !synced || !canWrite()) return;
  if (pushing) return;                      // se reprograma al terminar
  pushing = true;

  let sent = null, sentFrom = null, before = null;
  try {
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      before = snap.exists ? normalize(snap.data()) : null;
      sentFrom = clone(state);
      sent = before ? merge3(base, sentFrom, before) : sentFrom;
      tx.set(ref, sent);
    });

    /* Quedó en la nube: esa es la nueva base. Lo que se haya tocado mientras
       viajaba se conserva encima. */
    base = clone(sent);
    const merged = normalize(merge3(sentFrom, state, sent));
    const changed = !same(merged, state);
    state = merged;
    persist();
    if (changed) emit('remote');
    if (before) backupOnce(before);

    retryMs = 4000;
    pushing = false;
    if (hasPending()) schedulePush(300); else setStatus('ok');
  } catch (err) {
    pushing = false;
    console.warn('No se pudo guardar en la nube, se reintenta:', err);
    setStatus('error');
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => schedulePush(0), retryMs);
    retryMs = Math.min(retryMs * 2, 60000);
  }
}

export function update(fn) {
  fn(state);
  save();
}

/* Llegó una copia de la nube: se funde con lo que hay acá.
   Devuelve true si lo que se ve cambió. */
function absorb(remote) {
  const merged = normalize(merge3(base ?? clone(state), state, remote));
  const changed = !same(merged, state);
  state = merged;
  base = clone(remote);
  persist();
  return changed;
}

/* ---------- Arrancar ---------- */

export function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) state = normalize(JSON.parse(raw));

    /* La base guardada dice qué se vio por última vez en la nube. Sin ella
       (primera vez con esta versión) se toma lo local como ya sincronizado:
       así, ante cualquier diferencia, manda la nube y no se pisa nada. */
    const rawBase = localStorage.getItem(BASE_KEY);
    base = rawBase ? normalize(JSON.parse(rawBase)) : (raw ? clone(state) : null);
  } catch {}
  return state;
}

export async function connect({ onSyncStart, onSyncEnd } = {}) {
  try {
    if (!window.firebase) throw new Error('SDK no disponible');
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    ref = db.doc(DOC_PATH);
  } catch (err) {
    console.warn('Sin conexión a la nube, se trabaja local:', err);
    return false;
  }

  onSyncStart?.();
  setStatus('sync');
  let first = true;

  /* Sin señal, Firestore no avisa nada: se queda esperando. Pasado un rato se
     muestra como sin conexión, para que la pantalla no quede cargando. */
  setTimeout(() => { if (!synced) setStatus('error'); }, 8000);

  const listen = () => ref.onSnapshot(async snap => {
    /* Escrituras nuestras que todavía no confirmó el servidor: se espera. */
    if (snap.metadata.hasPendingWrites) return;

    /* "No existe" desde la memoria del navegador no prueba nada: sólo se
       cree que no existe cuando lo dice el servidor. */
    if (!snap.exists && snap.metadata.fromCache) return;

    if (snap.exists) {
      const changed = absorb(normalize(snap.data()));
      synced = true;
      const wasFirst = first;
      first = false;
      if (changed) emit('remote');
      if (wasFirst) onSyncEnd?.();
      schedulePush(300);            // si acá quedó algo sin subir, sube ahora
      if (!hasPending()) setStatus('ok');
      return;
    }

    // Primera vez: traemos todo lo que había en la versión 1.
    try {
      const legacy = await db.doc(LEGACY_DOC_PATH).get();
      const brought = legacy.exists ? importLegacy(legacy.data()) : null;
      if (brought && brought.tournaments.length) {
        state = brought;
        emit('remote');
      }
    } catch (err) {
      console.warn('No se pudo importar la versión anterior:', err);
    }
    base = null;                    // no hay nada en la nube todavía
    synced = true;
    if (first) { first = false; onSyncEnd?.(); }
    schedulePush(0);
  }, err => {
    if (first) { first = false; onSyncEnd?.(); }
    console.warn('Se cortó la sincronización:', err);
    setStatus('error');
    setTimeout(listen, 8000);       // vuelve a engancharse solo
  });

  /* Un listener por vez: si se corta, `listen` lo reengancha. */
  listen();
  window.addEventListener('online', () => schedulePush(0));
  window.addEventListener('focus', () => { if (synced && hasPending()) schedulePush(0); });

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


