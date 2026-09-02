/* Cada sección tiene su propia dirección, así el botón "atrás" del celular
   vuelve a la pantalla anterior en vez de cerrar la app. */

import { el } from './ui.js';
import { isAdmin } from '../core/auth.js';

export const SECTIONS = [
  { id:'inicio',    label:'Inicio',    icon:'ti-home' },
  { id:'curso',     label:'En juego',  icon:'ti-ball-football' },
  { id:'vitrina',   label:'Vitrina',   icon:'ti-trophy' },
  { id:'historial', label:'Historial', icon:'ti-history' },
  { id:'programar', label:'Programar', icon:'ti-calendar-plus', adminOnly:true }
];

const views = new Map();
let current = null;

export const register = (id, render) => views.set(id, render);
export const currentSection = () => current;

function allowed(id) {
  const s = SECTIONS.find(x => x.id === id);
  if (!s) return false;
  return !s.adminOnly || isAdmin();
}

export function go(id) {
  if (location.hash === `#/${id}`) { paint(); return; }
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
  const shown = SECTIONS.filter(s => !s.adminOnly || isAdmin());

  el('navWide').innerHTML = shown.map(s => `
    <button data-go="${s.id}" class="${s.id === current ? 'on' : ''}">
      <i class="ti ${s.icon}"></i>${s.label}
    </button>`).join('');

  el('navBar').innerHTML = shown.map(s => `
    <button data-go="${s.id}" class="${s.id === current ? 'on' : ''}" aria-label="${s.label}">
      <i class="ti ${s.icon}"></i><span>${s.label}</span>
    </button>`).join('');
}

export function startRouter() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-go]');
    if (btn) { e.preventDefault(); go(btn.dataset.go); }
  });
  window.addEventListener('hashchange', paint);
  paint();
}

export const repaint = paint;
