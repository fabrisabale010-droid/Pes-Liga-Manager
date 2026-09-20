import { ADMIN_HASH, ADMIN_HOURS, AUTH_MODE, ORGANIZER_EMAILS } from '../config.js';

const KEY = 'pes6_v2_admin_until';
const watchers = new Set();

let fails = 0;
let lockedUntil = 0;

/* Modo 'google': quién está firmado, según Firebase Authentication. */
let googleUser = null;

export const authMode = () => AUTH_MODE;

const norm = s => String(s || '').trim().toLowerCase();
const listed = user =>
  !!user && ORGANIZER_EMAILS.map(norm).includes(norm(user.email));

/* La lista vacía no habilita a nadie: si falta configurarla, mejor cerrado. */
export const googleConfigured = () => ORGANIZER_EMAILS.length > 0;

export function isAdmin() {
  if (AUTH_MODE === 'google') return listed(googleUser);

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

/* Misma versión que los otros dos scripts de Firebase de index.html. */
const AUTH_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js';

const loadScript = src => new Promise((ok, fail) => {
  const s = document.createElement('script');
  s.src = src;
  s.onload = ok;
  s.onerror = fail;
  document.head.appendChild(s);
});

/* Se llama una vez, después de que Firebase arrancó. En modo 'pin' no hace
   nada, ni siquiera baja el SDK de autenticación. */
export async function initAuth() {
  if (AUTH_MODE !== 'google' || !window.firebase) return;
  try {
    if (!firebase.auth) await loadScript(AUTH_SDK);
    firebase.auth().onAuthStateChanged(user => {
      googleUser = user;
      announce();
    });
  } catch (err) {
    console.warn('El SDK de autenticación no cargó: no se puede entrar como organizador.', err);
  }
}

/* ---------- Modo 'google' ---------- */

/* Devuelve 'ok' | 'cancelada' | 'no-autorizado' | 'sin-lista' | 'redirect' | 'error' */
export async function signInGoogle() {
  if (!googleConfigured()) return 'sin-lista';

  const auth = firebase.auth();
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    await auth.signInWithPopup(provider);
  } catch (e) {
    const code = e?.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'cancelada';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      /* Algunos celulares bloquean la ventanita: se prueba con redirección. */
      try { await auth.signInWithRedirect(provider); return 'redirect'; } catch { return 'error'; }
    }
    console.warn('No se pudo entrar con Google:', e);
    return 'error';
  }

  if (!listed(auth.currentUser)) {
    await auth.signOut();          // una cuenta que no es de organizador no queda abierta
    return 'no-autorizado';
  }
  return 'ok';
}

/* ---------- Modo 'pin' ---------- */

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
  if (AUTH_MODE === 'google') {
    firebase.auth().signOut().catch(() => {});      // onAuthStateChanged avisa
    return;
  }
  localStorage.removeItem(KEY);
  announce();
}
