import { flag, esc, nameOf, say, sayUndo, cheer, thud, askConfirm, clip } from '../ui/ui.js';
import { standingsTable, gameRow, penaltyPicker, bracketView, groupsView, fixtureView, skeleton } from '../ui/parts.js';
import { update, tournaments, liveTournament, nextTournament, sendToTrash, restoreFromTrash, isLoading } from '../core/store.js';
import {
  progress, formatName, kickoff,
  qualifiers, buildBracket, advance, tieWinner, champion, needsDecider, finalTable
} from '../domain/engine.js';
import { isAdmin } from '../core/auth.js';
import { go } from '../ui/router.js';
import { openFixtureShare } from '../ui/fixtureShare.js';
import { openQuickScore, pendingToday } from './quickScore.js';

export function renderTournament(view) {
  if (isLoading()) { view.innerHTML = skeleton(); return; }

  /* Si no hay ninguno en juego, se muestra el próximo programado: así se puede
     mirar el fixture antes de tiempo, o arrancar antes si se juntan temprano. */
  const jugando = liveTournament();
  const t = jugando || nextTournament();

  if (!t) {
    view.innerHTML = `<section class="block"><div class="empty">
      <i class="ti ti-ball-football"></i>
      <strong>No hay ningún torneo en juego</strong>
      Mirá los torneos anteriores en Historial.
      <div style="margin-top:14px"><button class="btn" data-go="historial">Ver historial</button></div>
    </div></section>`;
    return;
  }

  const porJugarse = !jugando;
  const arranca = kickoff(t);

  const admin = isAdmin();
  const p = progress(t);
  const groupsDone = t.format === 'copa' && t.games.every(m => m.played);
  const decider = needsDecider(t);
  const champ = champion(t);
  const quick = pendingToday(t);

  view.innerHTML = `
    <section class="block">
      <h2><i class="ti ti-ball-football"></i>${esc(t.name)}</h2>
      <p class="block-note">
        ${esc(formatName(t.format))} · ${t.teamIds.length} selecciones · ${p.played} de ${p.total} partidos
      </p>
      ${porJugarse ? `<div class="aviso">
        <i class="ti ti-clock"></i>
        <div>Todavía no empezó${arranca ? `: se juega el ${arranca.toLocaleDateString('es-AR',
          { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}.
          El fixture ya está sorteado${admin ? ' y podés cargar resultados cuando arranquen' : ''}.</div>
      </div>` : ''}
      ${t.format === 'copa' ? groupsView(t) : standingsTable(finalTable(t))}
    </section>

    ${t.format === 'copa' && !t.bracket ? copaGate(t, groupsDone, admin) : ''}
    ${t.bracket ? bracketBlock(t, admin) : ''}
    ${decider && !t.penWinner ? deciderBlock(decider, admin) : ''}

    <section class="block">
      <div class="block-bar">
        <h2><i class="ti ti-clipboard-list"></i>Partidos</h2>
        <button class="btn sm" data-share-fixture>
          <i class="ti ti-share-2" aria-hidden="true"></i>Compartir fixture
        </button>
      </div>
      ${admin && quick ? `<button class="btn main wide quick-cta" data-quick>
        <i class="ti ti-bolt" aria-hidden="true"></i>Cargar resultados de la Fecha ${quick.day}
        <small>${quick.ids.length} ${quick.ids.length === 1 ? 'partido' : 'partidos'} · con botones grandes</small>
      </button>` : ''}
      ${fixtureView(t, { editable: admin })}
    </section>

    ${admin ? actions(t, champ) : ''}
  `;

  view.querySelector('[data-share-fixture]').onclick = () => openFixtureShare(t);
  if (admin) {
    wire(view, t.id);
    const q = view.querySelector('[data-quick]');
    if (q) q.onclick = () => openQuickScore(t.id);
  }

  /* Tras cargar un marcador la pantalla se redibuja: el cursor vuelve solo al
     casillero siguiente, así se puede seguir tipeando sin tocar nada. */
  if (pendingFocus) {
    const next = view.querySelector(`[data-score="${pendingFocus}"]`);
    pendingFocus = null;
    if (next) {
      next.focus({ preventScroll: true });
      next.select?.();
      requestAnimationFrame(() => requestAnimationFrame(() => next.scrollIntoView({ block: 'center', behavior: 'smooth' })));
    }
  }
}

let pendingFocus = null;

/* ---------- Bloques ---------- */

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

/* Los manejadores buscan el torneo por id cada vez que se toca algo, en vez de
   guardar el objeto de cuando se dibujó la pantalla. Si otro organizador
   cambió datos mientras tanto, se trabaja siempre sobre lo último. */
function wire(view, tid) {
  const current = () => tournaments().find(x => x.id === tid) || null;
  const gone = () => { say('Este torneo ya no está'); go('inicio'); };

  /* Escribir un dígito y seguir: al tipear un número de una cifra se guarda
     solo y el cursor pasa al próximo casillero vacío. Si el gol fue de dos
     cifras basta con seguir escribiendo antes de que pase medio segundo. */
  let advance = false;
  let advanceTimer = null;
  const inputs = () => [...view.querySelectorAll('[data-score]')];
  const nextEmpty = from => inputs().slice(inputs().indexOf(from) + 1).find(i => i.value === '');

  view.addEventListener('focusin', e => {
    if (e.target.matches?.('[data-score]')) e.target.select?.();
  });

  view.addEventListener('input', e => {
    const inp = e.target.closest?.('[data-score]');
    if (!inp) return;
    clearTimeout(advanceTimer);
    if (!/^\d$/.test(inp.value)) return;
    advanceTimer = setTimeout(() => {
      if (!inp.isConnected) return;
      advance = true;
      inp.blur();                 // dispara "change" en el acto y guarda
      advance = false;
    }, 450);
  });

  view.addEventListener('keydown', e => {
    const inp = e.target.closest?.('[data-score]');
    if (!inp || e.key !== 'Enter') return;
    e.preventDefault();
    clearTimeout(advanceTimer);
    if (inp.value !== inp.defaultValue) {
      advance = true;
      inp.blur();
      advance = false;
    } else {
      const n = nextEmpty(inp);
      n?.focus(); n?.select?.();
    }
  });

  view.addEventListener('change', e => {
    const input = e.target.closest('[data-score]');
    if (!input) return;
    const t = current();
    if (!t) return gone();

    /* Sólo si el guardado lo pidió el avance automático: si la persona tocó
       otro casillero a mano, el cursor se queda donde ella lo puso. */
    const wantFocus = advance ? (nextEmpty(input)?.dataset.score ?? null) : null;

    const [kind, id, side] = input.dataset.score.split(':');
    const list = kind === 'b' ? t.bracket?.games : t.games;
    const m = list?.find(x => String(x.id) === id);
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
    pendingFocus = wantFocus;
    go('curso');
  });

  view.addEventListener('click', e => {
    const pen = e.target.closest('[data-pen]');
    if (pen) {
      const t = current();
      if (!t) return gone();
      const [kind, id, who] = pen.dataset.pen.split(':');
      const list = kind === 'b' ? t.bracket?.games : t.games;
      const m = list?.find(x => String(x.id) === id);
      if (!m) return;
      update(() => { m.penWinner = who; if (kind === 'b') advance(t.bracket); });
      cheer();
      return go('curso');
    }

    if (e.target.closest('[data-build-bracket]')) {
      const t = current();
      if (!t) return gone();
      update(() => { t.bracket = buildBracket(qualifiers(t).map(q => q.id)); });
      say('Llaves armadas');
      return go('curso');
    }

    const title = e.target.closest('[data-title]');
    if (title) {
      const t = current();
      if (!t) return gone();
      update(() => { t.penWinner = title.dataset.title; });
      return go('curso');
    }

    if (e.target.closest('[data-finish]')) {
      const t = current();
      return t ? finish(t) : gone();
    }
    if (e.target.closest('[data-cancel]')) {
      const t = current();
      return t ? askCancel(t) : gone();
    }
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

/* Cancelar es lo más fácil de tocar por error y lo más caro de perder: si ya
   hay resultados cargados, primero se pregunta. Igual va a la papelera. */
function askCancel(t) {
  const p = progress(t);
  if (!p.played) return cancel(t);

  askConfirm({
    title: '¿Cancelar el torneo?',
    text: `«${clip(t.name, 40)}» ya tiene ${p.played} ${p.played === 1 ? 'partido cargado' : 'partidos cargados'}. ` +
          'Sale de la lista y queda 7 días en la papelera del Historial.',
    yes: 'Sí, cancelar',
    no: 'Seguir jugando'
  }).then(ok => { if (ok) cancel(t); });
}

function cancel(t) {
  sendToTrash(t.id);
  sayUndo('Torneo cancelado', () => {
    restoreFromTrash(t.id);
    say('Torneo restaurado');
    go('curso');
  });
  go('curso');
}
