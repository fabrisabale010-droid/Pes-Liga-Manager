import { flag, esc, nameOf, crest, cup, say } from '../ui/ui.js';
import { TEAMS } from '../domain/teams.js';
import {
  perfil, seleccionesConHistoria, comparar, quienGana, FILAS_COMPARACION
} from '../domain/profile.js';
import { profileCard, compareCard, share, precargar } from '../ui/cards.js';

let abierta = null;
let duoA = null, duoB = null;

export function renderTeams(view) {
  const paint = () => {
    view.innerHTML = html();
    const a = view.querySelector('#cmpA');
    const b = view.querySelector('#cmpB');
    if (a) a.onchange = e => { duoA = e.target.value; paint(); };
    if (b) b.onchange = e => { duoB = e.target.value; paint(); };
  };

  view.addEventListener('click', e => {
    const ficha = e.target.closest('[data-abrir]');
    if (ficha) {
      abierta = abierta === ficha.dataset.abrir ? null : ficha.dataset.abrir;
      return paint();
    }
    const sp = e.target.closest('[data-share-perfil]');
    if (sp) return compartirPerfil(sp);

    const sc = e.target.closest('[data-share-comparacion]');
    if (sc) return compartirComparacion(sc);

    const swap = e.target.closest('[data-swap]');
    if (swap) { [duoA, duoB] = [duoB, duoA]; return paint(); }
  });

  paint();
  precargar(seleccionesConHistoria().map(x => x.id));
}

/* ---------- Armado ---------- */

function html() {
  const lista = seleccionesConHistoria();
  if (!lista.length) {
    return `<section class="block"><div class="empty">
      <i class="ti ti-shield"></i><strong>Todavía no hay historia</strong>
      Cuando se juegue el primer torneo, cada selección arma su palmarés.
    </div></section>`;
  }

  if (!duoA) duoA = lista[0].id;
  if (!duoB) duoB = (lista[1] || lista[0]).id;

  return `
    <section class="block">
      <h2><i class="ti ti-shield"></i>Selecciones</h2>
      <p class="block-note">El palmarés completo de cada una. Tocá para ver todo lo que ganó.</p>
      <div class="fichas">${lista.map(fila).join('')}</div>
    </section>
    ${comparador(lista)}`;
}

function fila(x) {
  const p = perfil(x.id);
  const open = abierta === x.id;

  return `<article class="ficha ${open ? 'open' : ''}">
    <div class="ficha-top" data-abrir="${x.id}">
      <span class="ficha-escudo">${crest(x.id, 54)}</span>
      <div class="ficha-nom">
        <strong>${esc(p.nombre)}</strong>
        <span>${p.stats.pj} ${p.stats.pj === 1 ? 'partido' : 'partidos'} · ${p.stats.pts} puntos</span>
      </div>
      <span class="ficha-titulos">${p.titulos.total}${cup()}</span>
      <i class="ti ti-chevron-down chev"></i>
    </div>

    <div class="ficha-body">
      ${titulos(p)}
      ${premios(p)}
      ${numeros(p)}
      <div style="margin-top:14px">
        <button class="btn sm" data-share-perfil="${x.id}">
          <i class="ti ti-share-2"></i>Compartir el palmarés
        </button>
      </div>
    </div>
  </article>`;
}

function titulos(p) {
  const t = p.titulos;
  if (!t.total) {
    return `<p class="block-note" style="margin:12px 0 0">Todavía sin títulos.</p>`;
  }
  const linea = (n, texto) => n
    ? `<div class="pal-item"><b>${n}</b><span>${texto}</span></div>` : '';

  return `<div class="pal-grupo">
    <div class="pal-titulo">Títulos</div>
    <div class="pal-lista">
      ${linea(t.liga, t.liga === 1 ? 'liga' : 'ligas')}
      ${linea(t.copa, t.copa === 1 ? 'copa' : 'copas')}
      ${linea(t.anual, t.anual === 1 ? 'Copa Anual' : 'Copas Anuales')}
      ${linea(t.previos, 'previos a la app')}
    </div>
  </div>`;
}

function premios(p) {
  const { dorados, papelones } = p.premios;
  if (!dorados.length && !papelones.length) return '';

  const chips = (lista, malo) => lista.map(x => `
    <span class="pal-premio ${malo ? 'malo' : ''}">
      <i class="ti ${x.icono}"></i>${esc(x.nombre)}
      <b>${x.year}${x.enCurso ? '*' : ''}</b>
    </span>`).join('');

  return `
    ${dorados.length ? `<div class="pal-grupo">
      <div class="pal-titulo">Premios ganados</div>
      <div class="pal-premios">${chips(dorados, false)}</div>
    </div>` : ''}
    ${papelones.length ? `<div class="pal-grupo">
      <div class="pal-titulo">Papelones</div>
      <div class="pal-premios">${chips(papelones, true)}</div>
    </div>` : ''}
    ${[...dorados, ...papelones].some(x => x.enCurso)
      ? `<p class="pal-nota">* el año todavía no terminó, puede cambiar</p>` : ''}`;
}

function numeros(p) {
  const s = p.stats;
  const dato = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
  return `<div class="pal-grupo">
    <div class="pal-titulo">Los números</div>
    <div class="grid-2">
      ${dato(s.pg, 'ganados')}
      ${dato(s.pp, 'perdidos')}
      ${dato(s.gf, 'goles a favor')}
      ${dato(s.gc, 'goles en contra')}
      ${dato(Math.round(p.efectividad * 100) + '%', 'efectividad')}
      ${dato(s.torneos, 'torneos jugados')}
      ${dato(s.rachaG, 'mejor racha')}
      ${dato(s.podios, 'veces en el podio')}
    </div>
  </div>`;
}

/* ---------- Comparador ---------- */

function comparador(lista) {
  const opciones = sel => TEAMS
    .filter(t => lista.some(x => x.id === t.id))
    .map(t => `<option value="${t.id}" ${sel === t.id ? 'selected' : ''}>${esc(t.name)}</option>`)
    .join('');

  const bloque = `
    <div class="row stack">
      <div><label class="field" for="cmpA">Una</label><select id="cmpA">${opciones(duoA)}</select></div>
      <div style="flex:0 0 auto;align-self:end">
        <button class="btn sm" data-swap title="Dar vuelta"><i class="ti ti-arrows-exchange"></i></button>
      </div>
      <div><label class="field" for="cmpB">La otra</label><select id="cmpB">${opciones(duoB)}</select></div>
    </div>`;

  if (duoA === duoB) {
    return `<section class="block">
      <h2><i class="ti ti-scale"></i>Comparar</h2>
      ${bloque}
      <div class="empty"><i class="ti ti-arrows-shuffle"></i>
        <strong>Elegí dos selecciones distintas</strong></div>
    </section>`;
  }

  const c = comparar(duoA, duoB);

  return `<section class="block">
    <h2><i class="ti ti-scale"></i>Comparar</h2>
    ${bloque}

    <div class="cmp-head">
      <div>${crest(c.a.id, 72)}<span>${esc(c.a.nombre)}</span></div>
      <div class="cmp-vs">vs</div>
      <div>${crest(c.b.id, 72)}<span>${esc(c.b.nombre)}</span></div>
    </div>

    ${c.duelo.pj ? `<div class="cmp-duelo">
      Se cruzaron ${c.duelo.pj} ${c.duelo.pj === 1 ? 'vez' : 'veces'}:
      <b>${c.duelo.ganóA}</b> - <b>${c.duelo.empates}</b> - <b>${c.duelo.ganóB}</b>
    </div>` : `<div class="cmp-duelo">Nunca se enfrentaron.</div>`}

    <div class="cmp-tabla">
      ${FILAS_COMPARACION.map(f => {
        const va = f.valor(c.a), vb = f.valor(c.b);
        const gana = quienGana(va, vb, f.menos);
        const ta = f.texto ? f.texto(c.a) : va;
        const tb = f.texto ? f.texto(c.b) : vb;
        return `<div class="cmp-fila">
          <span class="cmp-v ${gana === 1 ? 'gana' : ''}">${ta}</span>
          <span class="cmp-l">${f.label}</span>
          <span class="cmp-v ${gana === 2 ? 'gana' : ''}">${tb}</span>
        </div>`;
      }).join('')}
    </div>

    <div style="margin-top:14px">
      <button class="btn sm" data-share-comparacion>
        <i class="ti ti-share-2"></i>Compartir la comparación
      </button>
    </div>
  </section>`;
}

/* ---------- Compartir ---------- */

async function compartirPerfil(btn) {
  const id = btn.dataset.sharePerfil;
  btn.disabled = true;
  try {
    const p = perfil(id);
    const res = await share(await profileCard(p), `palmares-${p.nombre}`,
      `${p.nombre}: ${p.titulos.total} ${p.titulos.total === 1 ? 'título' : 'títulos'}`);
    if (res === 'descargada') say('No se pudo compartir: quedó en Descargas');
  } catch (err) {
    say('No se pudo compartir: ' + (err.name || err.message || 'error'));
  }
  btn.disabled = false;
}

async function compartirComparacion(btn) {
  if (duoA === duoB) return;
  btn.disabled = true;
  try {
    const c = comparar(duoA, duoB);
    const filas = FILAS_COMPARACION.map(f => ({
      label: f.label,
      a: f.texto ? f.texto(c.a) : f.valor(c.a),
      b: f.texto ? f.texto(c.b) : f.valor(c.b),
      gana: quienGana(f.valor(c.a), f.valor(c.b), f.menos)
    }));
    const res = await share(await compareCard(c, filas), `${nameOf(duoA)}-vs-${nameOf(duoB)}`,
      `${nameOf(duoA)} vs ${nameOf(duoB)}`);
    if (res === 'descargada') say('No se pudo compartir: quedó en Descargas');
  } catch (err) {
    say('No se pudo compartir: ' + (err.name || err.message || 'error'));
  }
  btn.disabled = false;
}
