import { state, loadLocal, connect, subscribe, update, liveTournament, lastChampion, purgeTrash } from './core/store.js';
import { isAdmin, signIn, signOut, onAdminChange, lockRemaining } from './core/auth.js';
import { el, say, openModal, closeModal, closeSheet, setSound, esc, flag, nameOf } from './ui/ui.js';
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
setSound(state.sound);

subscribe(s => {
  setSound(s.sound);
  paintSound();
  if (!el('screenMode').hidden) paintScreen();
});

connect({
  onSyncStart: () => { el('sync').hidden = false; },
  onSyncEnd:   () => { el('sync').hidden = true; }
}).then(ok => {
  if (ok) repaint();
  else say('Sin conexión: se guarda en este dispositivo');
  purgeTrash();          // saca lo que ya cumplió los días en la papelera
});

/* ---------- Sesión de organizador ---------- */

function paintAdmin() {
  const btn = el('btnAdmin');
  const on = isAdmin();
  btn.innerHTML = `<i class="ti ti-${on ? 'lock-open' : 'lock'}"></i>`;
  btn.classList.toggle('on', on);
  btn.title = on ? 'Salir del modo organizador' : 'Entrar como organizador';
}

onAdminChange(() => { paintAdmin(); drawNav(); repaint(); });
paintAdmin();

el('btnAdmin').onclick = () => {
  if (isAdmin()) {
    signOut();
    say('Saliste del modo organizador');
    if (currentSection() === 'programar') go('inicio');
    return;
  }

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
  btn.innerHTML = `<i class="ti ti-${state.sound ? 'volume' : 'volume-3'}"></i>`;
}
el('btnSound').onclick = () => {
  update(() => { state.sound = !state.sound; });
  say(state.sound ? 'Sonido activado' : 'Sonido en silencio');
};
paintSound();

/* ---------- Modo pantalla ---------- */

function paintScreen() {
  const t = liveTournament() || lastChampion();
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

enableTeamCards();
startRouter();

/* ---------- Funciona sin señal ---------- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
