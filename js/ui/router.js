/* Cada sección tiene su propia dirección, así el botón "atrás" del celular
   vuelve a la pantalla anterior en vez de cerrar la app. */

import { el, openSheet, closeSheet } from './ui.js';
import { isAdmin } from '../core/auth.js';

export const SECTIONS = [
  { id:'inicio',       label:'Inicio',        icon:'ti-home',          bar:true },
  { id:'curso',        label:'En juego',      icon:'ti-ball-football', bar:true },
  { id:'vitrina',      label:'Vitrina',       icon:'ti-trophy',        bar:true },
  { id:'historial',    label:'Historial',     icon:'ti-history',       bar:true },
  { id:'estadisticas', label:'Estadísticas',  icon:'ti-chart-bar' },
  { id:'premios',      label:'Premios',       icon:'ti-award' },
  { id:'programar',    label:'Programar',     icon:'ti-calendar-plus', adminOnly:true }
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

function paint() {
  let id = (location.hash || '').replace('#/', '') || 'inicio';
  if (!allowed(id)) id = 'inicio';
  current = id;

  /* Contenedor nuevo en cada render: los listeners que engancha cada vista
     mueren con el anterior y no se heredan marcas de estado. */
  const old = el('view');
  const view = document.createElement('main');
  view.id = 'view';
  view.tabIndex = -1;
  old.replaceWith(view);

  views.get(id)?.(view);
  view.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
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
