import { flag, esc, nameOf, crest, say, cheer } from '../ui/ui.js';
import { state, update, tournaments } from '../core/store.js';
import { years } from '../domain/stats.js';
import {
  premiosDelAnio, POLL_CATEGORIES, votosDe, totalVotos,
  votosDisponibles, ganadoresDe, resumenVotacion
} from '../domain/awards.js';
import { awardCard, pollCard, share, precargar } from '../ui/cards.js';
import { isAdmin } from '../core/auth.js';

let year = null;
let torneoElegido = null;

/* Cada celular puede votar una vez por categoría. Como no hay cuentas, esto
   se guarda en el propio teléfono: evita votar de más sin querer, aunque no
   impide que alguien muy insistente se las ingenie. */
const VOTOS_KEY = 'pes6_v2_mis_votos';

function misVotos() {
  try { return JSON.parse(localStorage.getItem(VOTOS_KEY) || '{}'); }
  catch { return {}; }
}
const miVoto = (tid, cat) => misVotos()[tid]?.[cat] || null;

function anotarVoto(tid, cat, equipo) {
  const m = misVotos();
  m[tid] = m[tid] || {};
  m[tid][cat] = equipo;
  try { localStorage.setItem(VOTOS_KEY, JSON.stringify(m)); } catch {}
}
function borrarMisVotos(tid) {
  const m = misVotos();
  delete m[tid];
  try { localStorage.setItem(VOTOS_KEY, JSON.stringify(m)); } catch {}
}

export function renderAwards(view) {
  const paint = () => {
    view.innerHTML = html();
    const sel = view.querySelector('#torneoVoto');
    if (sel) sel.onchange = e => { torneoElegido = e.target.value; paint(); };
  };

  view.addEventListener('click', async e => {
    const y = e.target.closest('[data-year]');
    if (y) { year = Number(y.dataset.year); return paint(); }

    const voto = e.target.closest('[data-voto]');
    if (voto) return votar(voto, paint);

    const limpiar = e.target.closest('[data-reset-voto]');
    if (limpiar) return reiniciar(limpiar.dataset.resetVoto, paint);

    const sp = e.target.closest('[data-share-premio]');
    if (sp) return compartirPremio(sp);

    const sv = e.target.closest('[data-share-votacion]');
    if (sv) return compartirVotacion(sv);
  });

  paint();
  precargar(tournaments().flatMap(t => t.teamIds).slice(0, 20));
}

/* ---------- Armado ---------- */

function html() {
  const ys = years();
  if (!ys.length) {
    return `<section class="block"><div class="empty">
      <i class="ti ti-award"></i><strong>Todavía no hay premios</strong>
      Se entregan solos cuando se juegue el primer torneo.
    </div></section>`;
  }
  if (year === null) year = ys[0];

  return `
    <section class="block">
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
    ${votacion()}`;
}

const enCurso = y => y === new Date().getFullYear();

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
      <div class="premio-quien">${flag(x.equipo)} <span>${esc(nameOf(x.equipo))}</span></div>
      <div class="premio-val">${esc(x.valorTexto)}</div>
      <div class="premio-pie">${esc(x.pieTexto)}</div>
    </article>`;

  return `
    ${balon ? `
      <div class="balon">
        <button class="rec-share premio-share" data-share-premio="balon:0"
                title="Compartir"><i class="ti ti-share-2"></i></button>
        <div class="balon-kicker"><i class="ti ti-award"></i> Balón de Oro ${year}${enCurso(year) ? ' · por ahora' : ''}</div>
        <div class="balon-crest">${crest(balon.equipo, 120)}</div>
        <div class="balon-nom">${esc(nameOf(balon.equipo))}</div>
        <div class="balon-puntaje">${esc(balon.valorTexto)}</div>
        <div class="balon-pie">${esc(balon.pieTexto)}</div>
        <div class="balon-como">
          Rendimiento (70) + títulos (20) + diferencia de gol (10)
        </div>
      </div>` : ''}

    <h3 style="margin:20px 0 10px">Los dorados</h3>
    <div class="premios">${resto.map(x => ficha(x, false)).join('')}</div>

    <h3 style="margin:24px 0 10px">Los papelones</h3>
    <div class="premios">${p.papelones.map(x => ficha(x, true)).join('')}</div>`;
}

/* ---------- Votación de la copa ---------- */

function torneosVotables() {
  return tournaments()
    .filter(t => t.finished)
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
}

function votacion() {
  const lista = torneosVotables();
  if (!lista.length) return '';

  const t = lista.find(x => x.id === torneoElegido) || lista[0];
  torneoElegido = t.id;

  const resumen = resumenVotacion(t);
  const cerrada = resumen.every(c => c.faltan === 0);

  return `<section class="block">
    <h2><i class="ti ti-checkbox"></i>Premios de la copa</h2>
    <p class="block-note">
      Cada uno vota una vez por categoría. Hay ${t.teamIds.length} votos por premio,
      uno por participante.
    </p>

    ${lista.length > 1 ? `<div class="stack">
      <label class="field" for="torneoVoto">Torneo</label>
      <select id="torneoVoto">
        ${lista.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
      </select>
    </div>` : `<p class="block-note"><b>${esc(t.name)}</b></p>`}

    ${resumen.map(c => categoria(t, c)).join('')}

    <div class="row" style="margin-top:16px">
      ${cerrada ? `<button class="btn sm" data-share-votacion style="flex:0 0 auto">
        <i class="ti ti-share-2"></i>Compartir los premios</button>` : ''}
      ${isAdmin() ? `<button class="btn danger sm" data-reset-voto="${t.id}" style="flex:0 0 auto">
        Reiniciar votación</button>` : ''}
    </div>
  </section>`;
}

function categoria(t, c) {
  const ganadores = c.ganadores;
  const mio = miVoto(t.id, c.id);
  const cerrada = c.faltan === 0 && !mio;   // si ya votaste, podés cambiarlo

  return `<div class="votacion">
    <div class="votacion-top">
      <div>
        <div class="votacion-nom">${esc(c.nombre)}</div>
        <div class="votacion-det">${esc(c.detalle)}</div>
      </div>
      <span class="tag ${cerrada ? 'done' : 'soon'}">
        ${cerrada ? 'cerrada' : `faltan ${c.faltan}`}
      </span>
    </div>

    ${cerrada && ganadores.length ? `
      <div class="votacion-ganador">
        ${ganadores.map(id => `<span>${flag(id)} ${esc(nameOf(id))}</span>`).join(' y ')}
      </div>` : ''}

    ${mio ? `<div class="mi-voto">
      Votaste a <b>${esc(nameOf(mio))}</b> · tocá otra para cambiar tu voto
    </div>` : ''}

    <div class="votos">
      ${t.teamIds.map(id => {
        const n = c.votos[id] || 0;
        const gana = c.faltan === 0 && ganadores.includes(id);
        return `<button class="voto ${gana ? 'gana' : ''} ${mio === id ? 'mio' : ''}"
                  ${cerrada ? 'disabled' : ''} data-voto="${t.id}:${c.id}:${id}">
          ${flag(id)}
          <span class="voto-nom">${esc(nameOf(id))}</span>
          <span class="voto-n">${n}</span>
        </button>`;
      }).join('')}
    </div>
  </div>`;
}

/* ---------- Acciones ---------- */

function votar(btn, paint) {
  const [tid, cat, equipo] = btn.dataset.voto.split(':');
  const t = tournaments().find(x => x.id === tid);
  if (!t) return;

  const previo = miVoto(tid, cat);
  if (previo === equipo) return say(`Ya votaste a ${nameOf(equipo)}`);
  if (!previo && votosDisponibles(t, cat) === 0) return say('Esa categoría ya está cerrada');

  update(() => {
    t.awards = t.awards || {};
    const votos = t.awards[cat] = t.awards[cat] || {};

    if (previo) {                       // cambiar el voto, no sumar otro
      votos[previo] = Math.max(0, (votos[previo] || 0) - 1);
      if (!votos[previo]) delete votos[previo];
    }
    votos[equipo] = (votos[equipo] || 0) + 1;
  });

  anotarVoto(tid, cat, equipo);
  cheer();
  say(previo ? `Cambiaste tu voto a ${nameOf(equipo)}` : `Votaste a ${nameOf(equipo)}`);
  paint();
}

function reiniciar(tid, paint) {
  if (!confirm('¿Borrar todos los votos de este torneo?')) return;
  const t = tournaments().find(x => x.id === tid);
  if (!t) return;
  update(() => { delete t.awards; });
  borrarMisVotos(tid);
  say('Votación reiniciada');
  paint();
}

async function compartirPremio(btn) {
  const [id, malo] = btn.dataset.sharePremio.split(':');
  const p = premiosDelAnio(year);
  if (!p) return;
  const lista = malo === '1' ? p.papelones : p.dorados;
  const premio = lista.find(x => x.id === id);
  if (!premio) return;

  btn.disabled = true;
  try {
    const res = await share(await awardCard(premio, year, malo === '1', p.enCurso),
      `premio-${premio.nombre}`,
      `${premio.nombre} ${year}: ${nameOf(premio.equipo)}`);
    if (res === 'descargada') say('No se pudo compartir: quedó en Descargas');
  } catch (err) {
    say('No se pudo compartir: ' + (err.name || err.message || 'error'));
  }
  btn.disabled = false;
}

async function compartirVotacion(btn) {
  const t = tournaments().find(x => x.id === torneoElegido);
  if (!t) return;
  btn.disabled = true;
  try {
    const res = await share(await pollCard(t, resumenVotacion(t)),
      `premios-${t.name.replace(/[^a-z0-9]+/gi, '-')}`,
      `Los premios de ${t.name}`);
    if (res === 'descargada') say('No se pudo compartir: quedó en Descargas');
  } catch (err) {
    say('No se pudo compartir: ' + (err.name || err.message || 'error'));
  }
  btn.disabled = false;
}
