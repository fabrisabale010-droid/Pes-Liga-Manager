import { flag, esc, nameOf, crest, say, cheer, ballon, cup } from '../ui/ui.js';
import { tournaments } from '../core/store.js';
import { years } from '../domain/stats.js';
import { premiosDelAnio } from '../domain/awards.js';
import { awardCard, compartirImagen, precargar } from '../ui/cards.js';
import { isAdmin } from '../core/auth.js';
import * as Annual from '../domain/annual.js';

let year = null;
let verCuenta = false;

const enCurso = y => y === new Date().getFullYear();

export function renderAwards(view) {
  const paint = () => {
    view.innerHTML = html();
    /* Los goles de la Copa Anual se cargan con inputs, hay que engancharlos. */
    view.querySelectorAll('[data-cup]').forEach(inp => {
      inp.onchange = () => {
        const [y, cual, lado] = inp.dataset.cup.split(':');
        const d = Annual.draftOf(Number(y));
        if (!d) return;
        const g = d[cual];
        g[lado] = inp.value === '' ? null : Math.max(0, parseInt(inp.value, 10) || 0);
        g.played = g.hg !== null && g.ag !== null;
        if (g.played && g.hg !== g.ag) g.penWinner = null;
        Annual.refresh(Number(y));
        if (g.played) cheer();
        paint();
      };
    });
  };

  view.addEventListener('click', e => {
    const y = e.target.closest('[data-year]');
    if (y) { year = Number(y.dataset.year); return paint(); }

    if (e.target.closest('[data-ver-cuenta]')) {
      verCuenta = !verCuenta;
      return paint();
    }

    const sp = e.target.closest('[data-share-premio]');
    if (sp) return compartir(sp);

    if (copaAnualClicks(e, paint)) return;
  });

  paint();
  precargar(tournaments().flatMap(t => t.teamIds).slice(0, 20));
}

function html() {
  const ys = years();
  if (!ys.length) {
    return `<section class="block"><div class="empty">
      <i class="ti ti-award"></i><strong>Todavía no hay premios</strong>
      Se entregan solos cuando se juegue el primer torneo.
    </div></section>`;
  }
  if (year === null) year = ys[0];

  return `<section class="block">
    <h2><i class="ti ti-award"></i>Premios ${year}</h2>
    <p class="block-note">
      Se calculan solos con lo que pasó en la cancha. Hacen falta 3 partidos para entrar.
      ${enCurso(year) ? 'Como el año sigue, todavía pueden cambiar de dueño.' : ''}
    </p>
    ${enCurso(year) ? `<div class="provisorio">
      <i class="ti ti-hourglass"></i> Provisorio · el año todavía no terminó
    </div>` : ''}
    ${ys.length > 1 ? `<div class="opts stack">
      ${ys.map(y => `<button class="opt ${year === y ? 'on' : ''}" data-year="${y}">${y}</button>`).join('')}
    </div>` : ''}
    ${anuales()}
  </section>
  ${copaAnual()}`;
}

function anuales() {
  const p = premiosDelAnio(year);
  if (!p) {
    return `<div class="empty"><i class="ti ti-award-off"></i>
      <strong>Falta jugar más en ${year}</strong>
      Con al menos tres partidos por selección se empiezan a repartir.</div>`;
  }

  const balon = p.dorados.find(x => x.id === 'balon');
  const resto = p.dorados.filter(x => x.id !== 'balon');

  const ficha = (x, malo) => `
    <article class="premio ${malo ? 'malo' : ''}">
      <button class="rec-share premio-share" data-share-premio="${x.id}:${malo ? 1 : 0}"
              title="Compartir"><i class="ti ti-share-2"></i></button>
      <div class="premio-ico"><i class="ti ${x.icono}"></i></div>
      <div class="premio-nom">${esc(x.nombre)}</div>
      <div class="premio-quien">
        ${(x.equipos || [x.equipo]).map(id =>
          `<span class="quien">${flag(id)} ${esc(nameOf(id))}</span>`).join('')}
      </div>
      <div class="premio-val">${esc(x.valorTexto)}</div>
      <div class="premio-pie">${esc(x.pieTexto)}</div>
    </article>`;

  return `
    ${balon ? `
      <div class="balon">
        <button class="rec-share premio-share" data-share-premio="balon:0"
                title="Compartir"><i class="ti ti-share-2"></i></button>
        <div class="balon-trofeo">${ballon()}</div>
        <div class="balon-kicker">Balón de Oro ${year}${enCurso(year) ? ' · por ahora' : ''}</div>
        <div class="balon-crest">${crest(balon.equipo, 120)}</div>
        <div class="balon-nom">${(balon.equipos || [balon.equipo]).map(nameOf).map(esc).join(' y ')}</div>
        <div class="balon-puntaje">${esc(balon.valorTexto)}</div>
        <div class="balon-pie">${esc(balon.pieTexto)}</div>
        ${cuenta(balon)}
      </div>` : ''}

    <h3 style="margin:20px 0 10px">Los dorados</h3>
    <div class="premios">${resto.map(x => ficha(x, false)).join('')}</div>

    <h3 style="margin:24px 0 10px">Los papelones</h3>
    <div class="premios">${p.papelones.map(x => ficha(x, true)).join('')}</div>`;
}

/* De dónde sale el puntaje, con los números de esta selección. */
function cuenta(balon) {
  const d = balon.desglose;
  if (!d) return '';

  const linea = (nombre, parte) => `
    <div class="cuenta-fila">
      <div class="cuenta-nom">
        <b>${nombre}</b>
        <span>${esc(parte.detalle)}</span>
      </div>
      <div class="cuenta-pts">${Math.round(parte.puntos)}<i>/${parte.tope}</i></div>
    </div>`;

  return `
    <button class="cuenta-toggle" data-ver-cuenta>
      ${verCuenta ? 'Ocultar' : '¿Cómo se calcula?'}
      <i class="ti ti-chevron-${verCuenta ? 'up' : 'down'}"></i>
    </button>

    ${verCuenta ? `<div class="cuenta">
      ${linea('Rendimiento', d.rendimiento)}
      ${linea('Títulos', d.titulos)}
      ${linea('Diferencia de gol', d.diferencia)}
      <div class="cuenta-fila total">
        <div class="cuenta-nom"><b>Puntaje</b></div>
        <div class="cuenta-pts">${esc(balon.valorTexto)}</div>
      </div>
      <p class="cuenta-nota">
        Los títulos y la diferencia se comparan con el mejor del año: quien
        lidera se lleva el máximo y el resto, la parte que le corresponde.
      </p>
    </div>` : ''}`;
}

function compartir(btn) {
  const [id, malo] = btn.dataset.sharePremio.split(':');
  const p = premiosDelAnio(year);
  if (!p) return;
  const premio = (malo === '1' ? p.papelones : p.dorados).find(x => x.id === id);
  if (!premio) return;

  compartirImagen(btn, () => awardCard(premio, year, malo === '1', p.enCurso),
    `premio-${premio.nombre}`, `${premio.nombre} ${year}: ${nameOf(premio.equipo)}`);
}

/* ---------- Copa Anual ---------- */

function copaAnual() {
  const y = year;
  if (!y) return '';

  const cup2026 = Annual.cupOf(y);
  if (cup2026) {
    return `<section class="block">
      <h2>${cup()}Copa Anual ${y}</h2>
      <div class="plaque">
        <div class="plaque-in">
          ${cup('cup')}
          <div class="kicker">Campeón anual</div>
          <div class="who">${esc(nameOf(cup2026.champion))}</div>
          <span class="flag-xl">${crest(cup2026.champion, 132)}</span>
        </div>
      </div>
      ${isAdmin() ? `<div style="text-align:center;margin-top:12px">
        <button class="btn danger sm" data-cup-del="${cup2026.id}">Borrar la Copa Anual ${y}</button>
      </div>` : ''}
    </section>`;
  }

  const d = Annual.draftOf(y);
  if (d) return `<section class="block">
    <h2>${cup()}Copa Anual ${y}</h2>
    ${enCursoCopa(d, y)}
  </section>`;

  const cruce = Annual.matchup(y);
  if (!cruce) return '';

  const explica =
    cruce.kind === 'repechaje'
      ? `${flag(cruce.espera)} <b>${esc(nameOf(cruce.espera))}</b> lidera los puntos y los títulos de ${y},
         así que espera en la final. ${flag(cruce.duelo[0])} ${esc(nameOf(cruce.duelo[0]))} y
         ${flag(cruce.duelo[1])} ${esc(nameOf(cruce.duelo[1]))} definen quién lo enfrenta.`
      : cruce.kind === 'barrida'
        ? `${flag(cruce.lider)} <b>${esc(nameOf(cruce.lider))}</b> ganó todos los torneos de ${y} y además
           sumó más puntos. Lo enfrenta ${flag(cruce.rival)} <b>${esc(nameOf(cruce.rival))}</b>, el segundo en puntos.`
        : `${flag(cruce.final[0])} <b>${esc(nameOf(cruce.final[0]))}</b> sumó más puntos en ${y} y
           ${flag(cruce.final[1])} <b>${esc(nameOf(cruce.final[1]))}</b> ganó más torneos.`;

  return `<section class="block">
    <h2>${cup()}Copa Anual ${y}</h2>
    <p class="block-note">${explica}</p>
    ${isAdmin()
      ? `<button class="btn gold" data-cup-start="${y}">Armar la Copa Anual ${y}</button>`
      : `<div class="empty"><i class="ti ti-hourglass"></i>
          <strong>Falta que el organizador la arme</strong></div>`}
  </section>`;
}

function enCursoCopa(d, y) {
  const admin = isAdmin();

  const partido = (g, cual, titulo) => `
    <div class="fixture-head">${titulo}</div>
    <div class="game ${g.played ? 'done' : ''}">
      <span class="t ${Annual.winnerOf(g) === g.home ? 'win' : ''}">${flag(g.home)}<span>${esc(nameOf(g.home))}</span></span>
      <span class="mark">
        ${admin
          ? `<input class="score" type="number" min="0" inputmode="numeric" value="${g.hg ?? ''}" placeholder="–" data-cup="${y}:${cual}:hg">
             <input class="score" type="number" min="0" inputmode="numeric" value="${g.ag ?? ''}" placeholder="–" data-cup="${y}:${cual}:ag">`
          : `<span class="score" style="display:grid;place-items:center">${g.hg ?? '–'}</span>
             <span class="score" style="display:grid;place-items:center">${g.ag ?? '–'}</span>`}
      </span>
      <span class="t away ${Annual.winnerOf(g) === g.away ? 'win' : ''}">${flag(g.away)}<span>${esc(nameOf(g.away))}</span></span>
    </div>
    ${admin && g.played && g.hg === g.ag && !g.penWinner ? `
      <div class="pens">Empataron. ¿Quién pasó por penales?
        <div class="row">
          <button class="btn sm" data-cup-pen="${y}:${cual}:${g.home}">${flag(g.home)} ${esc(nameOf(g.home))}</button>
          <button class="btn sm" data-cup-pen="${y}:${cual}:${g.away}">${flag(g.away)} ${esc(nameOf(g.away))}</button>
        </div>
      </div>` : ''}`;

  const campeon = Annual.winnerOf(d.final);

  return `
    ${d.semi ? partido(d.semi, 'semi', 'Repechaje: define quién juega la final') : ''}
    ${d.stage === 'repechaje'
      ? `<p class="block-note">${flag(d.waiting)} ${esc(nameOf(d.waiting))} espera en la final.</p>`
      : partido(d.final, 'final', `Final de la Copa Anual ${y}`)}
    ${campeon && admin ? `<div style="margin-top:12px">
      <button class="btn gold" data-cup-crown="${y}">Coronar a ${esc(nameOf(campeon))}</button>
    </div>` : ''}
    ${admin ? `<div style="margin-top:10px">
      <button class="btn danger sm" data-cup-cancel="${y}">Cancelar la Copa Anual</button>
    </div>` : ''}`;
}

function copaAnualClicks(e, paint) {
  const armar = e.target.closest('[data-cup-start]');
  if (armar) { Annual.start(Number(armar.dataset.cupStart)); say('Copa Anual armada'); paint(); return true; }

  const pen = e.target.closest('[data-cup-pen]');
  if (pen) {
    const [y, cual, quien] = pen.dataset.cupPen.split(':');
    const d = Annual.draftOf(Number(y));
    if (d) { d[cual].penWinner = quien; Annual.refresh(Number(y)); cheer(); }
    paint(); return true;
  }

  const coronar = e.target.closest('[data-cup-crown]');
  if (coronar) {
    const campeon = Annual.crown(Number(coronar.dataset.cupCrown));
    if (campeon) { say(`Campeón anual: ${nameOf(campeon)}`); cheer(); }
    paint(); return true;
  }

  const cancelar = e.target.closest('[data-cup-cancel]');
  if (cancelar) { Annual.cancelDraft(Number(cancelar.dataset.cupCancel)); say('Copa Anual cancelada'); paint(); return true; }

  const borrar = e.target.closest('[data-cup-del]');
  if (borrar) {
    if (confirm('¿Borrar la Copa Anual? Se puede volver a armar.')) {
      Annual.removeCup(borrar.dataset.cupDel);
      say('Copa Anual borrada');
    }
    paint(); return true;
  }
  return false;
}
