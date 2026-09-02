import {
  flag, esc, nameOf, cup, whenDate, longDate, countdown, pad,
  startConfetti, stopConfetti
} from '../ui/ui.js';
import { standingsTable, gameRow, bracketView, groupsView } from '../ui/parts.js';
import { state, liveTournament, lastChampion } from '../core/store.js';
import { table, currentDay, formatName, progress, finalTable } from '../domain/engine.js';
import { CHAMPION_BEFORE_APP } from '../config.js';
import { isAdmin } from '../core/auth.js';

let tick = null;

export function renderHome(view) {
  clearInterval(tick);
  stopConfetti();

  const live = liveTournament();
  const last = lastChampion();
  const championId = last ? last.champion : CHAMPION_BEFORE_APP;

  view.innerHTML = `
    ${plaque(last, championId)}
    ${live ? nextUp(live) : invite()}
    ${live ? live_(live) : ''}
  `;

  startConfetti(view.querySelector('.fall'), championId);

  const when = live && whenDate(live.when);
  if (when) {
    const paint = () => {
      const slot = view.querySelector('[data-clock]');
      if (!slot) { clearInterval(tick); return; }
      slot.innerHTML = clockHtml(when);
    };
    paint();
    tick = setInterval(paint, 1000);
  }
}

/* ---------- Placa del campeón ---------- */

function plaque(last, championId) {
  return `<section class="block">
    <div class="plaque">
      <div class="fall"></div>
      <div class="plaque-in">
        <i class="ti ti-trophy cup"></i>
        <div class="kicker">${last ? 'Campeón vigente' : 'Último campeón antes de la app'}</div>
        <div class="who">${esc(nameOf(championId))}</div>
        <span class="flag-xl">${flag(championId)}</span>
        ${last ? `<div class="meta">${esc(last.name)}</div>` : ''}
      </div>
    </div>
  </section>`;
}

/* ---------- Próximo partido ---------- */

function clockHtml(when) {
  const left = countdown(when);
  if (!left) return `<div class="matchday-where" style="color:var(--grass);font-weight:600">Se juega ahora</div>`;
  const cell = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
  return `<div class="clock">
    ${cell(left.d, left.d === 1 ? 'día' : 'días')}
    ${cell(pad(left.h), 'horas')}
    ${cell(pad(left.m), 'min')}
    ${cell(pad(left.s), 'seg')}
  </div>`;
}

function nextUp(t) {
  const when = whenDate(t.when);
  const started = !when || Date.now() >= when.getTime();

  return `<section class="block">
    <div class="matchday">
      <div class="matchday-top">
        <span class="dot ${started ? '' : 'wait'}"></span>
        ${started ? 'Torneo en juego' : 'Fecha confirmada'}
        <span style="margin-left:auto">${esc(formatName(t.format))}</span>
      </div>
      <div class="matchday-body" style="text-align:center">
        <div class="matchday-when">${when ? esc(longDate(when)) : esc(t.name)}</div>
        <div class="matchday-where">
          ${t.when?.time ? `${esc(t.when.time)} h` : ''}${t.when?.time && t.place ? ' · ' : ''}${t.place ? esc(t.place) : ''}
        </div>
        ${t.host ? `<div class="matchday-where">En casa de ${flag(t.host)} ${esc(nameOf(t.host))}</div>` : ''}
        <div class="matchday-who">${t.teamIds.map(id => flag(id)).join('')}</div>
        <div data-clock>${when ? clockHtml(when) : ''}</div>
      </div>
    </div>
  </section>`;
}

function invite() {
  return `<section class="block">
    <div class="empty">
      <i class="ti ti-calendar-plus"></i>
      <strong>No hay torneo en juego</strong>
      ${isAdmin()
        ? 'Programá la próxima fecha y la app arma el fixture sola.'
        : 'Cuando el organizador confirme la próxima fecha, aparece acá.'}
      ${isAdmin() ? `<div style="margin-top:14px"><button class="btn gold" data-go="programar">Programar torneo</button></div>` : ''}
    </div>
  </section>`;
}

/* ---------- Cómo va ---------- */

function live_(t) {
  const p = progress(t);
  const day = currentDay(t);

  const board = t.format === 'copa'
    ? groupsView(t) + (t.bracket ? bracketView(t) : '')
    : standingsTable(finalTable(t));

  return `<section class="block">
    <h2><i class="ti ti-list-numbers"></i>Cómo va</h2>
    <p class="block-note">${p.played} de ${p.total} partidos jugados.</p>
    ${board}
    ${day ? `
      <div class="fixture-head">Fecha ${day.day}</div>
      ${day.games.map(m => gameRow(m)).join('')}` : ''}
    <div style="margin-top:16px">
      <button class="btn" data-go="curso">Ver el torneo completo</button>
    </div>
  </section>`;
}

export const stopHome = () => { clearInterval(tick); stopConfetti(); };
