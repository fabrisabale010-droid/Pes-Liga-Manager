import {
  flag, esc, nameOf, cup, longDate, countdown, pad,
  startConfetti, stopConfetti, burstConfetti, cheer, crest
} from '../ui/ui.js';
import { standingsTable, gameRow, bracketView, groupsView, titlesCount } from '../ui/parts.js';
import { championCard, eventCard, compartirImagen } from '../ui/cards.js';
import { liveTournament, nextTournament, scheduled, lastChampion } from '../core/store.js';
import { currentDay, formatName, progress, finalTable, kickoff } from '../domain/engine.js';
import { CHAMPION_BEFORE_APP } from '../config.js';
import { isAdmin } from '../core/auth.js';
import { openFixtureShare } from '../ui/fixtureShare.js';

let tick = null;

/* La explosión de papelitos es para cuando se llega a Inicio, no para cada
   vez que la pantalla se redibuja porque llegó un dato de otro celular. */
let lastBurst = 0;

export function renderHome(view) {
  clearInterval(tick);
  stopConfetti();

  const live = liveTournament();
  const proximo = nextTournament();
  const pendientes = scheduled();
  const last = lastChampion();
  const championId = last ? last.champion : CHAMPION_BEFORE_APP;

  view.innerHTML = `
    ${plaque(last, championId)}
    ${proximo ? nextUp(proximo, pendientes.length) : ''}
    ${live ? live_(live) : ''}
    ${!live && !proximo ? invite() : ''}
  `;

  /* Si la pantalla se redibuja enseguida (llegan los datos de la nube al
     abrir), la explosión anterior se perdió con ella: se repite. */
  const now = Date.now();
  const cortada = now - lastBurst < 2500;
  const burst = cortada || now - lastBurst > 20000;
  if (burst) lastBurst = now;
  startConfetti(view.querySelector('.fall'), championId, { burst });

  /* Tocar la copa la vuelve a festejar. */
  const stage = view.querySelector('[data-cup]');
  if (stage) stage.onclick = () => {
    burstConfetti(view.querySelector('.fall'), championId, 80);
    stage.classList.remove('lift'); void stage.offsetWidth; stage.classList.add('lift');
    cheer();
  };

  const btn = view.querySelector('[data-share-champ]');
  if (btn) btn.onclick = () => compartirImagen(btn,
    () => championCard(last),
    `campeon-${nameOf(last.champion)}`,
    `🏆 ${nameOf(last.champion)} campeón de ${last.name}`);

  const ev = view.querySelector('[data-share-event]');
  if (ev) ev.onclick = () => compartirImagen(ev,
    () => eventCard(proximo, kickoff(proximo)),
    'proximo-torneo',
    `⚽ Próximo torneo${proximo.place ? ' en ' + proximo.place : ''}`);

  const fx = view.querySelector('[data-share-fixture]');
  if (fx) fx.onclick = () => openFixtureShare(proximo);

  const when = proximo && kickoff(proximo);
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

/* La portada: todo centrado, con la copa grande arriba. */
/* La portada: rayos de luz que giran detrás de la copa, la copa con un
   brillo que la recorre, destellos alrededor, el nombre en dorado y los
   números del campeón. Tocar la copa larga otra tanda de papelitos. */
function plaque(last, championId) {
  const titulos = titlesCount()[championId] || 0;
  const desde = last && (last.finishedAt ? new Date(last.finishedAt) : null);
  const dias = desde && !isNaN(desde) ? Math.max(0, Math.floor((Date.now() - desde) / 86400000)) : null;
  const stat = (n, label) => `<div class="champ-stat"><b data-count="${n}">${n}</b><span>${label}</span></div>`;

  return `<section class="block">
    <div class="plaque portada">
      <div class="rays" aria-hidden="true"></div>
      <div class="fall" aria-hidden="true"></div>
      <div class="plaque-in">
        <button type="button" class="cup-stage" data-cup aria-label="Festejar de nuevo">
          <span class="cup-glow" aria-hidden="true"></span>
          <span class="cup-wrap">${cup('cup')}<span class="cup-shine" aria-hidden="true"></span></span>
          ${[1, 2, 3, 4, 5, 6].map(i => `<span class="sparkle s${i}" aria-hidden="true"></span>`).join('')}
        </button>
        <div class="kicker"><i class="ti ti-crown" aria-hidden="true"></i>${last ? 'Campeón vigente' : 'Último campeón antes de la app'}</div>
        <div class="who">${esc(nameOf(championId))}</div>
        <span class="flag-xl">${crest(championId, 150)}</span>
        ${last ? `<div class="meta">${esc(last.name)}</div>` : ''}
        ${titulos || dias !== null ? `<div class="champ-stats">
          ${titulos ? stat(titulos, titulos === 1 ? 'título' : 'títulos') : ''}
          ${dias !== null ? stat(dias, dias === 1 ? 'día de reinado' : 'días de reinado') : ''}
        </div>` : ''}
        ${last ? `<div class="plaque-acciones">
          <button class="btn sm" data-share-champ>
            <i class="ti ti-share-2"></i>Compartir
          </button></div>` : ''}
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

function nextUp(t, cuantos) {
  const when = kickoff(t);

  return `<section class="block">
    <div class="matchday">
      <div class="matchday-top">
        <span class="dot wait"></span>
        ${cuantos > 1 ? `Próximo de ${cuantos} programados` : 'Fecha confirmada'}
        <span style="margin-left:auto">${esc(formatName(t.format))}</span>
      </div>
      <div class="matchday-body" style="text-align:center">
        ${t.name && when ? `<div class="matchday-nombre">${esc(t.name)}</div>` : ''}
        <div class="matchday-when">${when ? esc(longDate(when)) : esc(t.name)}</div>
        <div class="matchday-where">
          ${t.when?.time ? `${esc(t.when.time)} h` : ''}${t.when?.time && t.place ? ' · ' : ''}${t.place ? esc(t.place) : ''}
        </div>
        ${t.host ? `<div class="matchday-where">En casa de ${flag(t.host)} ${esc(nameOf(t.host))}</div>` : ''}
        <div class="matchday-who">${t.teamIds.map(id => flag(id)).join('')}</div>
        <div data-clock>${when ? clockHtml(when) : ''}</div>
        <div class="actions-center">
          <button class="btn sm main" data-share-fixture>
            <i class="ti ti-list-details" aria-hidden="true"></i>Compartir fixture
          </button>
          <button class="btn sm" data-share-event>
            <i class="ti ti-ticket" aria-hidden="true"></i>Compartir invitación
          </button>
        </div>
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
    : standingsTable(finalTable(t), { clave: 'inicio-' + t.id });

  return `<section class="block">
    <h2><i class="ti ti-list-numbers"></i>Cómo va</h2>
    <p class="block-note">${esc(t.name)} · ${p.played} de ${p.total} partidos jugados.</p>
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
