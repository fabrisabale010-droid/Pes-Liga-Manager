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

/* El trofeo de toda la app. Para cambiarlo, reemplazá FWC.png y listo:
   sale de acá una sola vez y se actualiza en todos lados. */
export const TROPHY_SRC = './FWC.png';       // la copa de los campeones
export const BALLON_SRC = './BDO.png';       // el balón de oro anual

export function cup(extra = '') {
  return `<img src="${TROPHY_SRC}" alt="" class="cup-img ${extra}">`;
}

export function ballon(extra = '') {
  return `<img src="${BALLON_SRC}" alt="" class="cup-img ballon-img ${extra}">`;
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

  /* La bandera de respaldo viaja escapada en un atributo y se lee al fallar:
     meterla dentro del onerror rompía con las banderas que llevan comillas. */
  return `<img src="${file}" alt="" class="crest-img" style="width:${size}px;height:${size}px"
    data-fb="${esc(flag(id))}" onerror="this.outerHTML=this.dataset.fb">`;
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

/* Pregunta antes de algo que no se puede deshacer. Devuelve una promesa:
   true si confirma, false si se arrepiente. Reemplaza al confirm() del
   navegador, que rompe el estilo y en el celular se ve como un error. */
export function askConfirm({ title, text, yes = 'Aceptar', no = 'Volver', danger = true }) {
  return new Promise(resolve => {
    openModal(`
      <i class="ti ti-alert-triangle big-i" style="color:var(--red)" aria-hidden="true"></i>
      <h3>${esc(title)}</h3>
      <p>${esc(text)}</p>
      <div class="row">
        <button class="btn" data-no>${esc(no)}</button>
        <button class="btn ${danger ? 'danger' : 'main'}" data-yes>${esc(yes)}</button>
      </div>
    `, box => {
      box.querySelector('[data-no]').onclick = () => { closeModal(); resolve(false); };
      box.querySelector('[data-yes]').onclick = () => { closeModal(); resolve(true); };
    });
  });
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
