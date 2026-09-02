import { team, nameOf, colorsOf } from '../domain/teams.js';

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

export const cup = () => '<i class="ti ti-trophy cup-i"></i>';

/* Cuando cargues escudos oficiales en teams.js, aparecen solos. */
export function crest(id, size = 28) {
  const t = team(id);
  if (!t) return '';
  if (t.crest) {
    return `<img src="${esc(t.crest)}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover">`;
  }
  return flag(id);
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
