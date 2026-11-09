import { ADMIN_HASH, ADMIN_HOURS } from '../config.js';

const KEY = 'pes6_v2_admin_until';
const watchers = new Set();

let fails = 0;
let lockedUntil = 0;

export function isAdmin() {
  const until = Number(localStorage.getItem(KEY) || 0);
  if (!until) return false;
  if (Date.now() > until) { localStorage.removeItem(KEY); return false; }
  return true;
}

export function onAdminChange(fn) {
  watchers.add(fn);
  return () => watchers.delete(fn);
}

const announce = () => watchers.forEach(fn => fn(isAdmin()));

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function lockRemaining() {
  return Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
}

/* Devuelve 'ok' | 'mal' | 'espera' */
export async function signIn(pin) {
  if (lockRemaining() > 0) return 'espera';
  if (!pin) return 'mal';

  if (await sha256(pin) === ADMIN_HASH) {
    fails = 0;
    localStorage.setItem(KEY, String(Date.now() + ADMIN_HOURS * 3600 * 1000));
    announce();
    return 'ok';
  }

  if (++fails >= 5) { lockedUntil = Date.now() + 60000; fails = 0; return 'espera'; }
  return 'mal';
}

export function signOut() {
  localStorage.removeItem(KEY);
  announce();
}
