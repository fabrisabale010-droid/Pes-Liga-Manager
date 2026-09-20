import { loadLocal, connect, subscribe, onSyncStatus, featured, lastChampion, purgeTrash,
         setWriteGuard, flushSoon, stateBytes } from './core/store.js';
import { isAdmin, signIn, signOut, onAdminChange, lockRemaining,
         initAuth, signInGoogle, authMode, googleConfigured } from './core/auth.js';
import { el, say, openModal, closeModal, closeSheet, setSound, esc, nameOf } from './ui/ui.js';
import { enableTeamCards, standingsTable, groupsView, bracketView, gameRow } from './ui/parts.js';
import { register, startRouter, drawNav, repaint, go, currentSection } from './ui/router.js';
import { renderHome, stopHome } from './views/home.js';
import { renderTournament } from './views/tournament.js';
import { renderSchedule } from './views/schedule.js';
import { renderHistory } from './views/history.js';
import { renderShowcase } from './views/showcase.js';
import { renderStats } from './views/stats.js';
import { renderAwards } from './views/awards.js';
import { renderTeams } from './views/teams.js';
import { currentDay, progress, finalTable, formatName } from './domain/engine.js';

/* ---------- Vistas ---------- */

register('inicio',    v => { renderHome(v); });
register('curso',     v => { stopHome(); renderTournament(v); });
register('programar', v => { stopHome(); renderSchedule(v); });
register('historial', v => { stopHome(); renderHistory(v); });
register('vitrina',   v => { stopHome(); renderShowcase(v); });
register('estadisticas', v => { stopHome(); renderStats(v); });
register('premios',      v => { stopHome(); renderAwards(v); });
register('selecciones',  v => { stopHome(); renderTeams(v); });

/* ---------- Datos ---------- */

loadLocal();

/* El sonido es de cada celular: antes viajaba con los datos y una persona
   que lo silenciaba se lo silenciaba a todos. */
const SOUND_KEY = 'pes6_v2_sound';
let soundOn = true;
try { soundOn = localStorage.getItem(SOUND_KEY) !== '0'; } catch {}
setSound(soundOn);

/* Con cuentas reales sólo los organizadores guardan en la nube. */
if (authMode() === 'google') setWriteGuard(isAdmin);

/* Cuando otro organizador cambia algo, la pantalla se redibuja sola: así nadie
   sigue trabajando sobre una copia vieja. Si justo se está escribiendo un
   resultado, se espera a que termine para no pisarle lo que tipeó. */
let firstSyncDone = false;
let repaintPending = false;

const escribiendo = () => {
  const a = document.activeElement;
  return !!a && !!a.closest?.('#view') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
};

subscribe((s, source) => {
  if (!el('screenMode').hidden) paintScreen();

  if (source !== 'remote') return;
  if (escribiendo()) repaintPending = true; else repaint();
  if (firstSyncDone && isAdmin()) say('Otro organizador actualizó los datos');
});

document.addEventListener('focusout', () => {
  if (!repaintPending) return;
  setTimeout(() => {
    if (escribiendo()) return;
    repaintPending = false;
    repaint();
  }, 250);
});

/* Estado de guardado, siempre a la vista para no dudar de si quedó grabado. */
const SYNC_TEXT = {
  sync:   ['ti-refresh',     'Buscando cambios', 'spin'],
  saving: ['ti-cloud-up',    'Guardando…',       ''],
  error:  ['ti-cloud-off',   'Sin conexión: se guarda en este dispositivo y sube solo', 'warn']
};
let lastStatus = null;
onSyncStatus(st => {
  /* Al terminar de buscar, se redibuja: reemplaza los esqueletos de carga. */
  if (lastStatus === 'sync' && st !== 'sync') { if (escribiendo()) repaintPending = true; else repaint(); }
  lastStatus = st;

  const box = el('sync');
  const info = SYNC_TEXT[st];
  if (!info) { box.hidden = true; return; }
  box.className = `sync ${info[2]}`;
  box.innerHTML = `<i class="ti ${info[0]}" aria-hidden="true"></i> ${info[1]}`;
  box.hidden = false;
});

/* Firestore admite 1 MB por documento. Mucho antes de llegar, se avisa. */
const LIMIT_WARN = 700 * 1024;
let warnedSize = false;
function checkSize() {
  if (warnedSize || !isAdmin() || stateBytes() < LIMIT_WARN) return;
  warnedSize = true;
  say(`El historial ya pesa ${Math.round(stateBytes() / 1024)} KB de 1024 KB: hay que pasar cada torneo a su propio documento`);
}

connect({
  onSyncStart: () => {},
  onSyncEnd:   () => {
    firstSyncDone = true;
    /* Con cuentas reales, limpiar la papelera es cosa de organizadores. */
    if (authMode() !== 'google' || isAdmin()) purgeTrash();
    checkSize();
  }
}).then(ok => {
  if (ok) repaint();
  else say('Sin conexión: se guarda en este dispositivo');
});

/* Firebase ya arrancó (connect inicializa antes de su primera espera). */
initAuth();

/* ---------- Sesión de organizador ---------- */

function paintAdmin() {
  const btn = el('btnAdmin');
  const on = isAdmin();
  btn.innerHTML = `<i class="ti ti-${on ? 'lock-open' : 'lock'}"></i>`;
  btn.classList.toggle('on', on);
  btn.title = on ? 'Salir del modo organizador' : 'Entrar como organizador';
  btn.setAttribute('aria-label', btn.title);

  /* El modo organizador tiene que verse: quien lo tiene activo carga cosas. */
  const sub = document.querySelector('.brand-text small');
  if (sub) {
    sub.textContent = on ? 'Modo organizador' : 'Torneos entre amigos';
    sub.classList.toggle('on', on);
  }
}

onAdminChange(() => {
  paintAdmin(); drawNav(); repaint();
  if (isAdmin()) { flushSoon(); checkSize(); }     // lo que quedó pendiente sube ahora
});
paintAdmin();

/* Entrar con cuenta de Google (modo 'google'). */
function openGoogleSignIn() {
  const sinLista = !googleConfigured();
  openModal(`
    <i class="ti ti-shield-lock big-i" aria-hidden="true"></i>
    <h3>Modo organizador</h3>
    <p>${sinLista
      ? 'Todavía no hay organizadores cargados. Falta completar ORGANIZER_EMAILS en config.js.'
      : 'Entrá con tu cuenta de Google para cargar resultados y programar torneos.'}</p>
    <button class="btn main wide" id="google" ${sinLista ? 'disabled' : ''}>
      <i class="ti ti-brand-google" aria-hidden="true"></i>Entrar con Google
    </button>
  `, box => {
    const btn = box.querySelector('#google');
    btn.onclick = async () => {
      btn.disabled = true;
      const res = await signInGoogle();
      btn.disabled = false;
      if (res === 'ok') { closeModal(); say('Listo, ya podés cargar resultados'); }
      else if (res === 'no-autorizado') say('Esa cuenta no está en la lista de organizadores');
      else if (res === 'cancelada') return;
      else if (res === 'redirect') return;
      else say('No se pudo entrar. Probá de nuevo.');
    };
  });
}

el('btnAdmin').onclick = () => {
  if (isAdmin()) {
    signOut();
    say('Saliste del modo organizador');
    if (currentSection() === 'programar') go('inicio');
    return;
  }

  if (authMode() === 'google') return openGoogleSignIn();

  const wait = lockRemaining();
  if (wait) return say(`Esperá ${wait} segundos`);

  openModal(`
    <i class="ti ti-shield-lock big-i"></i>
    <h3>Modo organizador</h3>
    <p>Para cargar resultados y programar torneos.</p>
    <input id="pin" class="pin" type="password" inputmode="numeric" maxlength="16" placeholder="PIN" autocomplete="off">
    <button class="btn main wide" id="enter" style="margin-top:14px">Entrar</button>
  `, box => {
    const input = box.querySelector('#pin');
    input.focus();
    const send = async () => {
      const res = await signIn(input.value);
      if (res === 'ok') { closeModal(); say('Listo, ya podés cargar resultados'); }
      else if (res === 'espera') { closeModal(); say('Demasiados intentos. Probá en un minuto.'); }
      else { input.value = ''; input.focus(); say('Ese PIN no es'); }
    };
    box.querySelector('#enter').onclick = send;
    input.onkeydown = e => { if (e.key === 'Enter') send(); };
  });
};

/* ---------- Sonido ---------- */

function paintSound() {
  const btn = el('btnSound');
  btn.innerHTML = `<i class="ti ti-${soundOn ? 'volume' : 'volume-3'}" aria-hidden="true"></i>`;
  btn.setAttribute('aria-pressed', String(!soundOn));
}
el('btnSound').onclick = () => {
  soundOn = !soundOn;
  setSound(soundOn);
  try { localStorage.setItem(SOUND_KEY, soundOn ? '1' : '0'); } catch {}
  paintSound();
  say(soundOn ? 'Sonido activado' : 'Sonido en silencio');
};
paintSound();

/* ---------- Modo pantalla ---------- */

function paintScreen() {
  const t = featured() || lastChampion();
  const box = el('screenMode');
  if (!t) {
    box.innerHTML = screenShell(`<div class="empty"><i class="ti ti-device-tv"></i>
      <strong>Todavía no hay nada para mostrar</strong></div>`);
  } else {
    const p = progress(t);
    const day = currentDay(t);
    box.innerHTML = screenShell(`
      <h2>${esc(t.name)}</h2>
      <div class="sub">${t.finished
        ? `Campeón ${nameOf(t.champion)}`
        : `${p.played} de ${p.total} partidos · ${esc(formatName(t.format))}`}</div>
      ${t.format === 'copa' ? groupsView(t) + (t.bracket ? bracketView(t) : '') : standingsTable(finalTable(t))}
      ${day ? `<div class="fixture-head">Fecha ${day.day}</div>${day.games.map(m => gameRow(m)).join('')}` : ''}
    `);
  }
  box.querySelector('.exit').onclick = () => { box.hidden = true; };
}

const screenShell = inner =>
  `<button class="ico exit"><i class="ti ti-x"></i></button><div class="screen-in">${inner}</div>`;

el('btnScreen').onclick = () => {
  el('screenMode').hidden = false;
  paintScreen();
};

/* ---------- Cierres generales ---------- */

document.addEventListener('click', e => {
  if (e.target.closest('[data-close-sheet]')) closeSheet();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  closeModal(); closeSheet();
  el('screenMode').hidden = true;
});

/* "Saltar al contenido": un botón y no un enlace, porque un # cambiaría
   la sección en el router. */
el('skip').onclick = () => el('view').focus();

enableTeamCards();
startRouter();

/* ---------- Funciona sin señal ---------- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
