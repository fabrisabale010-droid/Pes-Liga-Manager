/* Carga rápida de resultados. Una hoja desde abajo, con botones grandes para
   sumar goles con el pulgar, que recorre los partidos que faltan de la fecha
   actual: se guarda uno y aparece el siguiente. Pensada para usarla mientras
   se juega ("gol de Brasil": un toque), sin apuntarle a casilleros chicos. */

import { flag, esc, nameOf, openSheet, closeSheet, el, say, cheer, thud } from '../ui/ui.js';
import { update, tournaments } from '../core/store.js';
import { currentDay } from '../domain/engine.js';
import { go } from '../ui/router.js';

const MAX = 99;

export function pendingToday(t) {
  const day = currentDay(t);
  return day ? { day: day.day, ids: day.games.filter(m => !m.played).map(m => m.id) } : null;
}

export function openQuickScore(tid) {
  const first = tournaments().find(x => x.id === tid);
  const plan = first && pendingToday(first);
  if (!plan || !plan.ids.length) return say('No queda ningún partido por cargar en esta fecha');

  let step = 0;
  let home = 0, away = 0;
  const total = plan.ids.length;

  const game = () => tournaments().find(x => x.id === tid)?.games.find(g => g.id === plan.ids[step]);

  const side = (which, id) => `
    <div class="qs-side">
      <div class="qs-team">${flag(id)}<span>${esc(nameOf(id))}</span></div>
      <div class="qs-step">
        <button class="qs-btn" data-dec="${which}" aria-label="Restar un gol a ${esc(nameOf(id))}"
                ${(which === 'h' ? home : away) === 0 ? 'disabled' : ''}>−</button>
        <output class="qs-num" aria-live="polite">${which === 'h' ? home : away}</output>
        <button class="qs-btn plus" data-inc="${which}" aria-label="Sumar un gol a ${esc(nameOf(id))}">+</button>
      </div>
    </div>`;

  const body = () => {
    const g = game();
    return `
      <div class="qs">
        <div class="qs-head">
          <div>
            <strong>Fecha ${plan.day}</strong>
            <span>Partido ${step + 1} de ${total}</span>
          </div>
          <button class="ico" data-close-sheet aria-label="Cerrar"><i class="ti ti-x" aria-hidden="true"></i></button>
        </div>
        ${side('h', g.home)}
        <div class="qs-vs" aria-hidden="true">contra</div>
        ${side('a', g.away)}
        <div class="row qs-actions">
          <button class="btn" data-skip>${step + 1 < total ? 'Saltar' : 'Cerrar'}</button>
          <button class="btn main" data-save>${step + 1 < total ? 'Guardar y seguir' : 'Guardar'}</button>
        </div>
      </div>`;
  };

  const wire = panel => {
    panel.onclick = e => {
      const inc = e.target.closest('[data-inc]');
      const dec = e.target.closest('[data-dec]');
      if (inc) { inc.dataset.inc === 'h' ? home = Math.min(MAX, home + 1) : away = Math.min(MAX, away + 1); return draw(); }
      if (dec) { dec.dataset.dec === 'h' ? home = Math.max(0, home - 1) : away = Math.max(0, away - 1); return draw(); }
      if (e.target.closest('[data-skip]')) return next(false);
      if (e.target.closest('[data-save]')) return next(true);
    };
  };

  const draw = () => {
    const panel = el('sheetPanel');
    panel.innerHTML = `<div class="sheet-grip"></div>${body()}`;
    wire(panel);
    panel.querySelector('[data-save]')?.focus({ preventScroll: true });
  };

  const next = save => {
    const g = game();
    if (save && g && g.played) {
      say('Ese partido ya lo cargó otro organizador');   // no se le pisa el resultado
    } else if (save && g) {
      update(() => { g.hg = home; g.ag = away; g.played = true; });
      Math.abs(home - away) >= 3 ? thud() : cheer();
      go('curso');                                   // la tabla de atrás se actualiza
    }
    home = 0; away = 0;
    step++;
    if (step >= total) {
      closeSheet();
      say(save ? 'Fecha completa' : 'Listo');
      return;
    }
    draw();
  };

  openSheet(body(), wire);
}
