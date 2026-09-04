/* En la práctica siempre se hace todo junto: se acuerda la fecha, quiénes van,
   y ahí mismo se sortea. Así que acá es un solo paso, no dos pantallas. */

import { flag, esc, nameOf, say, longDate, whenDate } from '../ui/ui.js';
import { CORE, TEAMS } from '../domain/teams.js';
import { createTournament, formatName } from '../domain/engine.js';
import { state, update, liveTournament } from '../core/store.js';
import { MAX_TEAMS, MAX_PLAYERS } from '../config.js';
import { go } from '../ui/router.js';

const draft = {
  name: '', date: '', time: '21:00', place: '', host: '',
  teams: [], format: 'ida', groups: 2, advance: 1
};

export function renderSchedule(view) {
  const live = liveTournament();
  if (live) {
    view.innerHTML = `<section class="block"><div class="empty">
      <i class="ti ti-lock-exclamation"></i>
      <strong>Ya hay un torneo en juego</strong>
      Cerrá o cancelá «${esc(live.name)}» antes de programar el siguiente.
      <div style="margin-top:14px"><button class="btn" data-go="curso">Ir al torneo</button></div>
    </div></section>`;
    return;
  }

  view.innerHTML = `
    <section class="block">
      <h2><i class="ti ti-calendar-plus"></i>Programar torneo</h2>
      <p class="block-note">Definí cuándo, dónde y quiénes juegan. Al confirmar se sortea el fixture y arranca la cuenta regresiva.</p>

      <div class="panel">
        <div class="stack">
          <label class="field" for="nombre">Nombre del torneo</label>
          <input id="nombre" type="text" placeholder="Se arma solo con la fecha si lo dejás vacío"
                 value="${esc(draft.name)}" maxlength="60">
        </div>
        <div class="row stack">
          <div><label class="field" for="d">Día</label><input id="d" type="date" value="${draft.date}"></div>
          <div><label class="field" for="h">Hora</label><input id="h" type="time" value="${draft.time}"></div>
        </div>
        <div class="stack">
          <label class="field" for="p">Dónde se juega</label>
          <input id="p" type="text" placeholder="Casa de Fede" value="${esc(draft.place)}">
        </div>
        <div>
          <label class="field" for="host">Selección de la casa</label>
          <select id="host">
            <option value="">Ninguna</option>
            ${TEAMS.map(t => `<option value="${t.id}" ${draft.host === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
          </select>
        </div>
      </div>
    </section>

    <section class="block">
      <h2><i class="ti ti-users"></i>Quiénes juegan</h2>
      <p class="block-note">Elegí las selecciones. Hacen falta al menos dos.</p>
      <div class="picks" id="picks">
        ${CORE.map(t => card(t)).join('')}
      </div>
      <div class="stack" style="margin-top:12px">
        <label class="field" for="more">Sumar otra selección</label>
        <div class="row">
          <select id="more"></select>
          <button class="btn sm" id="addMore" style="flex:0 0 auto">Sumar</button>
        </div>
      </div>
      <div class="chips" id="chips"></div>
    </section>

    <section class="block">
      <h2><i class="ti ti-sitemap"></i>Formato</h2>
      <div class="opts stack" id="formats">
        ${['ida', 'vuelta', 'copa'].map(f =>
          `<button class="opt ${draft.format === f ? 'on' : ''}" data-format="${f}">${formatName(f)}</button>`
        ).join('')}
      </div>
      <div id="copaOpts"></div>
    </section>

    <section class="block">
      <button class="btn gold wide" id="confirm">Confirmar y sortear</button>
    </section>
  `;

  paintPicks(view);
  paintExtras(view);
  paintCopa(view);
  wire(view);
}

const card = t => `
  <label class="pick ${draft.teams.includes(t.id) ? 'on' : ''}" data-pick="${t.id}">
    ${flag(t.id)}
    <span class="abbr">${t.id}</span>
    <span class="full">${esc(t.name)}</span>
  </label>`;

function paintPicks(view) {
  view.querySelectorAll('[data-pick]').forEach(node =>
    node.classList.toggle('on', draft.teams.includes(node.dataset.pick))
  );
}

function paintExtras(view) {
  const core = new Set(CORE.map(t => t.id));
  const extras = draft.teams.filter(id => !core.has(id));

  view.querySelector('#more').innerHTML =
    `<option value="">Elegí una…</option>` +
    TEAMS.filter(t => !core.has(t.id) && !draft.teams.includes(t.id))
      .map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');

  view.querySelector('#chips').innerHTML = extras.map(id => `
    <span class="chip">${flag(id)}${esc(nameOf(id))}
      <button data-drop="${id}" aria-label="Sacar">✕</button>
    </span>`).join('');
}

function paintCopa(view) {
  const box = view.querySelector('#copaOpts');
  if (draft.format !== 'copa') { box.innerHTML = ''; return; }
  box.innerHTML = `
    <div class="row">
      <div>
        <label class="field" for="gc">Cantidad de grupos</label>
        <select id="gc">${[2, 3, 4].map(n =>
          `<option value="${n}" ${draft.groups === n ? 'selected' : ''}>${n} grupos</option>`).join('')}</select>
      </div>
      <div>
        <label class="field" for="ga">Pasan de ronda</label>
        <select id="ga">
          <option value="1" ${draft.advance === 1 ? 'selected' : ''}>El primero</option>
          <option value="2" ${draft.advance === 2 ? 'selected' : ''}>Los dos primeros</option>
        </select>
      </div>
    </div>`;
  box.querySelector('#gc').onchange = e => { draft.groups = Number(e.target.value); };
  box.querySelector('#ga').onchange = e => { draft.advance = Number(e.target.value); };
}

function wire(view) {
  view.querySelector('#nombre').oninput = e => { draft.name = e.target.value; };
  view.querySelector('#d').onchange = e => { draft.date = e.target.value; };
  view.querySelector('#h').onchange = e => { draft.time = e.target.value; };
  view.querySelector('#p').oninput  = e => { draft.place = e.target.value; };
  view.querySelector('#host').onchange = e => { draft.host = e.target.value; };

  view.querySelector('#picks').addEventListener('click', e => {
    const pick = e.target.closest('[data-pick]');
    if (!pick) return;
    e.preventDefault();
    const id = pick.dataset.pick;
    if (draft.teams.includes(id)) draft.teams = draft.teams.filter(x => x !== id);
    else if (draft.teams.length >= MAX_TEAMS) return say(`No entran más de ${MAX_TEAMS}`);
    else draft.teams.push(id);
    paintPicks(view);
    paintExtras(view);
  });

  view.querySelector('#addMore').onclick = () => {
    const sel = view.querySelector('#more');
    if (!sel.value) return;
    if (draft.teams.length >= MAX_TEAMS) return say(`No entran más de ${MAX_TEAMS}`);
    draft.teams.push(sel.value);
    paintExtras(view);
  };

  view.querySelector('#chips').addEventListener('click', e => {
    const drop = e.target.closest('[data-drop]');
    if (!drop) return;
    draft.teams = draft.teams.filter(x => x !== drop.dataset.drop);
    paintPicks(view);
    paintExtras(view);
  });

  view.querySelector('#formats').addEventListener('click', e => {
    const btn = e.target.closest('[data-format]');
    if (!btn) return;
    draft.format = btn.dataset.format;
    view.querySelectorAll('[data-format]').forEach(b => b.classList.toggle('on', b === btn));
    paintCopa(view);
  });

  view.querySelector('#confirm').onclick = () => confirm(view);
}

function confirm(view) {
  if (draft.teams.length < 2) return say('Elegí al menos dos selecciones');
  if (!draft.date) return say('Falta el día');

  if (draft.format === 'copa') {
    if (draft.teams.length < draft.groups * 2)
      return say(`Con ${draft.groups} grupos hacen falta ${draft.groups * 2} selecciones`);
    if (draft.advance > Math.floor(draft.teams.length / draft.groups))
      return say('No pueden pasar más equipos de los que tiene el grupo más chico');
  }

  const when = { date: draft.date, time: draft.time };
  const day = whenDate(when);
  const name = draft.name.trim() || `Torneo del ${day ? longDate(day) : draft.date}`;

  const t = createTournament({
    name,
    teamIds: draft.teams,
    format: draft.format,
    groups: draft.groups,
    advance: draft.advance,
    when,
    place: draft.place.trim() || null,
    host: draft.host || null
  });

  update(() => { state.tournaments.push(t); });
  draft.teams = [];
  draft.place = '';
  draft.name = '';
  say('Fixture sorteado');
  go('inicio');
}
