import { flag, esc, nameOf, say, sayUndo, cheer, thud, openSheet, closeSheet, startConfetti } from '../ui/ui.js';
import { standingsTable, gameRow, penaltyPicker, bracketView, groupsView } from '../ui/parts.js';
import { state, update, liveTournament } from '../core/store.js';
import {
  table, groupTable, currentDay, progress, formatName,
  qualifiers, buildBracket, advance, tieWinner, champion, needsDecider, finalTable
} from '../domain/engine.js';
import { isAdmin } from '../core/auth.js';
import { go } from '../ui/router.js';

export function renderTournament(view) {
  const t = liveTournament();
  if (!t) {
    view.innerHTML = `<section class="block"><div class="empty">
      <i class="ti ti-ball-football"></i>
      <strong>No hay ningún torneo en juego</strong>
      Mirá los torneos anteriores en Historial.
      <div style="margin-top:14px"><button class="btn" data-go="historial">Ver historial</button></div>
    </div></section>`;
    return;
  }

  const admin = isAdmin();
  const p = progress(t);
  const groupsDone = t.format === 'copa' && t.games.every(m => m.played);
  const decider = needsDecider(t);
  const champ = champion(t);

  view.innerHTML = `
    <section class="block">
      <h2><i class="ti ti-ball-football"></i>${esc(t.name)}</h2>
      <p class="block-note">
        ${esc(formatName(t.format))} · ${t.teamIds.length} selecciones · ${p.played} de ${p.total} partidos
      </p>
      ${t.format === 'copa' ? groupsView(t) : standingsTable(finalTable(t))}
    </section>

    ${t.format === 'copa' && !t.bracket ? copaGate(t, groupsDone, admin) : ''}
    ${t.bracket ? bracketBlock(t, admin) : ''}
    ${decider && !t.penWinner ? deciderBlock(decider, admin) : ''}

    <section class="block">
      <h2><i class="ti ti-clipboard-list"></i>Partidos</h2>
      ${fixtureBlock(t, admin)}
    </section>

    ${admin ? actions(t, champ) : ''}
  `;

  if (admin) wire(view, t);
}

/* ---------- Bloques ---------- */

function fixtureBlock(t, admin) {
  const byDay = {};
  t.games.forEach(m => (byDay[`${m.group || ''}|${m.day}`] ||= []).push(m));
  const keys = Object.keys(byDay).sort((a, b) => {
    const [ga, da] = a.split('|'), [gb, db] = b.split('|');
    return ga.localeCompare(gb) || Number(da) - Number(db);
  });
  const now = currentDay(t);

  return keys.map(k => {
    const [group, day] = k.split('|');
    const games = byDay[k];
    const live = now && games.some(m => m.id === now.games[0]?.id);
    return `<div class="fixture-head">
        ${group ? `Grupo ${group} · ` : ''}Fecha ${day}${live ? ' <span class="tag live">en juego</span>' : ''}
      </div>
      ${games.map(m => gameRow(m, { editable: admin, kind: 'g' })).join('')}`;
  }).join('');
}

function copaGate(t, ready, admin) {
  if (!ready) return '';
  const q = qualifiers(t);
  return `<section class="block">
    <h2><i class="ti ti-tournament"></i>Llaves</h2>
    <p class="block-note">
      Terminó la fase de grupos. Pasan ${q.map(x => `${nameOf(x.id)} (${x.rank}º del ${x.group})`).join(', ')}.
    </p>
    ${admin ? `<button class="btn gold" data-build-bracket>Armar las llaves</button>` : ''}
  </section>`;
}

function bracketBlock(t, admin) {
  const pend = t.bracket.games.filter(m => !m.bye && m.home && m.away && !tieWinner(m));
  return `<section class="block">
    <h2><i class="ti ti-tournament"></i>Llaves</h2>
    ${bracketView(t)}
    ${admin && pend.length ? `<div style="margin-top:10px">
      ${pend.map(m => gameRow(m, { editable: true, kind: 'b' }) + penaltyPicker(m, 'b')).join('')}
    </div>` : ''}
  </section>`;
}

function deciderBlock(ids, admin) {
  return `<section class="block">
    <h2><i class="ti ti-alert-triangle"></i>Empate en la punta</h2>
    <p class="block-note">
      ${ids.map(nameOf).join(' y ')} terminaron iguales en todo. Se define entre ellos.
    </p>
    ${admin ? `<div class="row">
      ${ids.map(id => `<button class="btn" data-title="${id}">${flag(id)} ${esc(nameOf(id))} salió campeón</button>`).join('')}
    </div>` : ''}
  </section>`;
}

function actions(t, champ) {
  return `<section class="block">
    <div class="row">
      <button class="btn gold" data-finish ${champ ? '' : 'disabled'}>Cerrar el torneo</button>
      <button class="btn danger" data-cancel>Cancelar torneo</button>
    </div>
    ${!champ ? `<p class="block-note" style="margin-top:10px">
      Cuando estén todos los resultados y haya un campeón, se habilita el cierre.
    </p>` : ''}
  </section>`;
}

/* ---------- Interacción ---------- */

function wire(view, t) {
  view.addEventListener('change', e => {
    const input = e.target.closest('[data-score]');
    if (!input) return;
    const [kind, id, side] = input.dataset.score.split(':');
    const list = kind === 'b' ? t.bracket.games : t.games;
    const m = list.find(x => String(x.id) === id);
    if (!m) return;

    const before = m.played;
    const val = input.value === '' ? null : Math.max(0, parseInt(input.value, 10) || 0);

    update(() => {
      m[side] = val;
      m.played = m.hg !== null && m.ag !== null;
      if (m.played && m.hg !== m.ag) m.penWinner = null;
      if (kind === 'b') advance(t.bracket);
    });

    if (m.played && !before) {
      Math.abs(m.hg - m.ag) >= 3 ? thud() : cheer();
    }
    go('curso');
  });

  view.addEventListener('click', e => {
    const pen = e.target.closest('[data-pen]');
    if (pen) {
      const [kind, id, who] = pen.dataset.pen.split(':');
      const list = kind === 'b' ? t.bracket.games : t.games;
      const m = list.find(x => String(x.id) === id);
      update(() => { m.penWinner = who; if (kind === 'b') advance(t.bracket); });
      cheer();
      return go('curso');
    }

    if (e.target.closest('[data-build-bracket]')) {
      update(() => { t.bracket = buildBracket(qualifiers(t).map(q => q.id)); });
      say('Llaves armadas');
      return go('curso');
    }

    const title = e.target.closest('[data-title]');
    if (title) {
      update(() => { t.penWinner = title.dataset.title; });
      return go('curso');
    }

    if (e.target.closest('[data-finish]')) return finish(t);
    if (e.target.closest('[data-cancel]')) return cancel(t);
  });
}

function finish(t) {
  const champ = champion(t);
  if (!champ) return say('Todavía falta definir al campeón');

  update(() => {
    t.finished = true;
    t.finishedAt = new Date().toISOString();
    t.champion = champ;
  });

  say(`Campeón: ${nameOf(champ)}`);
  cheer();
  go('inicio');
}

function cancel(t) {
  const copy = JSON.parse(JSON.stringify(t));
  const at = state.tournaments.indexOf(t);
  update(() => { state.tournaments.splice(at, 1); });
  sayUndo('Torneo cancelado', () => {
    update(() => { state.tournaments.splice(at, 0, copy); });
    say('Torneo restaurado');
    go('curso');
  });
  go('curso');
}
