import { team, nameOf, colorsOf } from '../domain/teams.js';
import { USE_CRESTS, CRESTS_FROM_FOLDER, CRESTS_PATH, CRESTS_AVAILABLE } from '../config.js';

/* ---------- Texto ---------- */

/* Recorta un texto largo para que entre en un aviso sin desarmarlo. */
export const clip = (t, max = 26) =>
  String(t).length > max ? String(t).slice(0, max - 1).trimEnd() + '…' : String(t);

export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

export const el = id => document.getElementById(id);

/* ---------- Banderas y escudos ---------- */

/* Los códigos con guión (Inglaterra) no tienen clase propia en la librería,
   así que usan el mismo SVG como fondo para verse idénticos al resto. */
export function flag(id) {
  const t = team(id);
  if (!t) return '<span class="fi fi-xx"></span>';
  if (t.iso.includes('-')) {
    return `<span class="fi-x" title="${esc(t.name)}" style="background-image:url('https://cdn.jsdelivr.net/npm/flag-icons/flags/4x3/${t.iso}.svg')"></span>`;
  }
  return `<span class="fi fi-${t.iso}" title="${esc(t.name)}"></span>`;
}

/* El trofeo de toda la app: la silueta de la copa, dibujada a mano para
   poder pintarla con degradé dorado y darle brillo propio. Sale de acá una
   sola vez, así que cambiándolo se actualiza en toda la app. */
export function cup(extra = '') {
  return `<svg class="cup-svg ${extra}" viewBox="0 0 48 64" aria-hidden="true">
    <defs>
      <linearGradient id="cupGold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#fff4d2"/>
        <stop offset="42%"  stop-color="#e8be4c"/>
        <stop offset="78%"  stop-color="#b8892a"/>
        <stop offset="100%" stop-color="#8a6318"/>
      </linearGradient>
      <linearGradient id="cupShine" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stop-color="#fff" stop-opacity=".85"/>
        <stop offset="45%"  stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <g fill="none" stroke="url(#cupGold)" stroke-width="4.6"
       stroke-linecap="round" stroke-linejoin="round">
      <path d="M24 3.6c8.2 0 14.6 6.3 14.6 14.2 0 3.4-.9 6.1-2.4 9.6
               -3.6 8.3-5.2 14.6-5.2 21.1 0 4.6.7 8.6 2.3 12.9H14.7
               c1.6-4.3 2.3-8.3 2.3-12.9 0-6.5-1.6-12.8-5.2-21.1
               C10.3 23.9 9.4 21.2 9.4 17.8 9.4 9.9 15.8 3.6 24 3.6Z"/>
      <path d="M17.4 21.6c1.9 0 3.4-1.6 3.4-3.7 0-1.2-.3-2.2-.7-3.4
               -.5-1.4-.8-2.4-.8-3.3 0-1.7 1.1-3 2.7-3 2.6 0 5.2 3.9 7.3 9.1
               1.3 3.2 2.7 4.8 5.3 5.2"/>
      <path d="M20.4 24.2c2.4 3.8 3.6 7.1 3.6 11 0 5.3-2.1 11-6 17.6"/>
      <path d="M15.6 52.8h16.8"/>
    </g>
    <path d="M24 3.6c-8.2 0-14.6 6.3-14.6 14.2 0 3.4.9 6.1 2.4 9.6"
          fill="none" stroke="url(#cupShine)" stroke-width="3"
          stroke-linecap="round"/>
  </svg>`;
}

/* Escudo de la selección. Si están apagados o falta el archivo,
   se muestra la bandera y no se rompe nada. */
export function crest(id, size = 34) {
  const t = team(id);
  if (!t) return '';

  /* Sin escudo cargado se usa la bandera directamente: así no se piden
     archivos que no existen ni parpadea una imagen rota. */
  const enCarpeta = CRESTS_FROM_FOLDER &&
    (!CRESTS_AVAILABLE?.length || CRESTS_AVAILABLE.includes(id));
  const file = !USE_CRESTS ? null
    : (t.crest || (enCarpeta ? `${CRESTS_PATH}${id}.png` : null));
  if (!file) return flag(id);

  const fallback = flag(id).replace(/"/g, '&quot;');
  return `<img src="${file}" alt="" class="crest-img" style="width:${size}px;height:${size}px"
    onerror="this.outerHTML='${fallback}'">`;
}

/* ---------- Avisos ---------- */

let toastTimer = null;

export function say(message) {
  const box = el('toast');
  box.innerHTML = `<span>${esc(message)}</span>`;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, 2400);
}

/* Aviso con salida: en vez de preguntar antes, se hace y se puede volver atrás. */
export function sayUndo(message, undo) {
  const box = el('toast');
  box.innerHTML = `<span>${esc(message)}</span>`;
  const btn = document.createElement('button');
  btn.textContent = 'Deshacer';
  btn.onclick = () => { box.hidden = true; clearTimeout(toastTimer); undo(); };
  box.appendChild(btn);
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, 6000);
}

/* ---------- Ventanas ---------- */

export function openModal(html, ready) {
  const box = el('modal');
  box.innerHTML = `<div class="modal-card">
    <button class="ico x" data-close-modal><i class="ti ti-x"></i></button>
    ${html}
  </div>`;
  box.hidden = false;
  box.querySelector('[data-close-modal]').onclick = closeModal;
  box.onclick = e => { if (e.target === box) closeModal(); };
  ready?.(box);
}

export function closeModal() {
  const box = el('modal');
  box.hidden = true;
  box.innerHTML = '';
}

export function openSheet(html, ready) {
  const box = el('sheet');
  el('sheetPanel').innerHTML = `<div class="sheet-grip"></div>${html}`;
  box.hidden = false;
  requestAnimationFrame(() => box.classList.add('open'));
  ready?.(el('sheetPanel'));
}

export function closeSheet() {
  const box = el('sheet');
  box.classList.remove('open');
  setTimeout(() => { box.hidden = true; }, 260);
}

/* ---------- Papelitos ---------- */

let rain = null;

/* Caen dentro del contenedor que se le pase, con los colores de esa bandera. */
export function startConfetti(container, teamId) {
  stopConfetti();
  if (!container) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const colors = colorsOf(teamId);
  const drop = () => {
    const bit = document.createElement('i');
    const size = 5 + Math.random() * 5;
    const round = Math.random() > .5;
    const life = 2.2 + Math.random() * 1.6;
    bit.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${round ? size : size * 1.7}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      border-radius:${round ? '50%' : '2px'};animation-duration:${life}s`;
    container.appendChild(bit);
    setTimeout(() => bit.remove(), life * 1000 + 200);
  };
  for (let i = 0; i < 9; i++) setTimeout(drop, i * 90);
  rain = setInterval(drop, 240);
}

export function stopConfetti() {
  if (rain) { clearInterval(rain); rain = null; }
}

/* ---------- Sonido y vibración ---------- */

let audio = null;
let soundOn = true;

export const setSound = on => { soundOn = on; };

function tone(freqs, step) {
  if (!soundOn) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((f, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.connect(gain); gain.connect(audio.destination);
      osc.frequency.value = f;
      osc.type = 'triangle';
      const at = audio.currentTime + i * step;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.15, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + step);
      osc.start(at); osc.stop(at + step);
    });
  } catch {}
}

const buzz = pattern => { try { navigator.vibrate?.(pattern); } catch {} };

export const cheer = () => { tone([440, 660, 880], 0.1); buzz(30); };
export const thud  = () => { tone([300, 220, 150], 0.14); buzz([40, 40, 40]); };

/* ---------- Fechas ---------- */

export function whenDate(when) {
  if (!when?.date) return null;
  const d = new Date(`${when.date}T${when.time || '00:00'}`);
  return isNaN(d) ? null : d;
}

export const longDate = d =>
  d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

export const shortDate = iso =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function countdown(target) {
  const gap = target.getTime() - Date.now();
  if (gap <= 0) return null;
  return {
    d: Math.floor(gap / 86400000),
    h: Math.floor(gap / 3600000) % 24,
    m: Math.floor(gap / 60000) % 60,
    s: Math.floor(gap / 1000) % 60
  };
}

export const pad = n => String(n).padStart(2, '0');

export { nameOf };
