/* Cada sección tiene su propia dirección, así el botón "atrás" del celular
   vuelve a la pantalla anterior en vez de cerrar la app. */

import { el, openSheet, closeSheet } from './ui.js';
import { isAdmin } from '../core/auth.js';

/* El orden cuenta una historia: lo que pasa ahora, lo que ya pasó, y el
   palmarés. En el celular entran cuatro abajo; el resto va en "Más".
   `bar` marca las que van en la barra del celular. */
const SECTIONS = [
  // Lo que está pasando
  { id:'inicio',       label:'Inicio',       icon:'ti-home',          bar:true },
  { id:'curso',        label:'En juego',     icon:'ti-ball-football', bar:true },
  { id:'programar',    label:'Programar',    icon:'ti-calendar-plus', adminOnly:true },

  // Lo que ya pasó
  { id:'historial',    label:'Historial',    icon:'ti-history',       bar:true },

  // El palmarés
  { id:'vitrina',      label:'Vitrina',      icon:'ti-trophy',        bar:true },
  { id:'premios',      label:'Premios',      icon:'ti-award' },
  { id:'selecciones',  label:'Selecciones',  icon:'ti-shield' },
  { id:'estadisticas', label:'Estadísticas', icon:'ti-chart-bar' }
];

const views = new Map();
let current = null;

export const register = (id, render) => views.set(id, render);
export const currentSection = () => current;

const visible = () => SECTIONS.filter(s => !s.adminOnly || isAdmin());

function allowed(id) {
  const s = SECTIONS.find(x => x.id === id);
  return !!s && (!s.adminOnly || isAdmin());
}

export function go(id) {
  if (location.hash === `#/${id}`) return paint();
  location.hash = `#/${id}`;
}

/* La dirección es #/seccion o #/seccion/detalle (por ejemplo un torneo
   del historial): el detalle le llega a la vista como segundo dato. */
function paint() {
  const [first, ...rest] = (location.hash || '').replace('#/', '').split('/');
  let id = first || 'inicio';
  let param = rest.length ? decodeURIComponent(rest.join('/')) : null;
  if (!allowed(id)) { id = 'inicio'; param = null; }

  /* Al quedarse en la misma sección (por ejemplo al cargar un gol y repintar
     la tabla) se conserva la posición: si no, la página salta al principio. */
  const sigueIgual = current === id;
  const alturaAntes = window.scrollY;
  const antes = SECTIONS.findIndex(s => s.id === current);
  const ahora = SECTIONS.findIndex(s => s.id === id);
  current = id;

  /* Cambio de sección con la transición nativa del navegador (View
     Transitions): la pantalla nueva entra desde el lado hacia el que se fue
     en el menú. Donde no existe, o con "reducir movimiento", un fundido. */
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nativa = !sigueIgual && antes >= 0 && !calm && typeof document.startViewTransition === 'function';
  document.documentElement.dataset.navDir = ahora < antes ? 'back' : 'fwd';

  const render = () => draw(id, param, sigueIgual, alturaAntes, nativa);
  if (nativa) document.startViewTransition(render);
  else render();
}

function draw(id, param, sigueIgual, alturaAntes, nativa) {
  /* Contenedor nuevo en cada render: los listeners que engancha cada vista
     mueren con el anterior y no se heredan marcas de estado. */
  const old = el('view');
  const view = document.createElement('main');
  view.id = 'view';
  view.tabIndex = -1;
  old.replaceWith(view);

  /* Al cambiar de sección la pantalla entra con un fundido corto; al
     redibujar la misma (por ejemplo al cargar un gol) no se anima nada. */
  if (!sigueIgual && !nativa) view.classList.add('enter');

  /* Las tarjetas entran escalonadas sólo al llegar a la sección; después
     se saca la marca para que redibujar (buscar, filtrar) no las repita. */
  if (!sigueIgual) {
    view.classList.add('stagger');
    setTimeout(() => view.classList.remove('stagger'), 900);
  }

  views.get(id)?.(view, param);
  view.focus({ preventScroll: true });

  if (sigueIgual) {
    /* Se espera al dibujado para que la página ya tenga su altura final. */
    requestAnimationFrame(() => window.scrollTo(0, alturaAntes));
  } else {
    window.scrollTo(0, 0);
  }

  drawNav();
}

export function drawNav() {
  const shown = visible();

  el('navWide').innerHTML = shown.map(s => `
    <button data-go="${s.id}" class="${s.id === current ? 'on' : ''}">
      <i class="ti ${s.icon}"></i>${s.label}
    </button>`).join('');

  /* En el celular entran cuatro; el resto vive detrás de "Más". */
  const bar = shown.filter(s => s.bar);
  const rest = shown.filter(s => !s.bar);
  const restOn = rest.some(s => s.id === current);

  el('navBar').innerHTML = bar.map(s => `
    <button data-go="${s.id}" class="${s.id === current ? 'on' : ''}" aria-label="${s.label}">
      <i class="ti ${s.icon}"></i><span>${s.label}</span>
    </button>`).join('') + (rest.length ? `
    <button id="navMore" class="${restOn ? 'on' : ''}" aria-label="Más secciones">
      <i class="ti ti-dots"></i><span>Más</span>
    </button>` : '');

  const more = el('navMore');
  if (more) more.onclick = () => openSheet(
    rest.map(s => `<button class="item ${s.id === current ? 'on' : ''}" data-go="${s.id}">
      <i class="ti ${s.icon}"></i>${s.label}</button>`).join('')
  );
}

export function startRouter() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-go]');
    if (!btn) return;
    e.preventDefault();
    closeSheet();
    go(btn.dataset.go);
  });
  window.addEventListener('hashchange', paint);
  paint();
}

export const repaint = paint;
