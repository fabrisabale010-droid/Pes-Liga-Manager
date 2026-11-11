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
    return `<span class="fi-x" title="${esc(t.name)}" style="background-image:url('https://cdn.jsdelivr.net/npm/flag-icons@7.6.0/flags/4x3/${t.iso}.svg')"></span>`;
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

  /* Caen hasta el fondo de la placa, sea cual sea su alto: en escritorio es
     bastante más alta que en el celular y antes se quedaban por la mitad. */
  const alto = () => Math.max(260, container.offsetHeight || 0) + 40;

  const papel = () => {
    const bit = document.createElement('i');
    const ancho = 6 + Math.random() * 5;
    const largo = ancho * (1 + Math.random() * .4);      // casi cuadrados
    const vida = 2.6 + Math.random() * 2.2;

    /* Cada papelito gira sobre un eje distinto: así tumbean en el aire y
       por momentos se ven de canto, como papel de verdad. */
    bit.style.cssText = `
      left:${Math.random() * 100}%;
      width:${ancho}px; height:${largo}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      border-radius:1px;
      --caida:${alto()}px;
      --giro:${540 + Math.random() * 720}deg;
      --vaiven:${8 + Math.random() * 16}px;
      --ejex:${(Math.random() * 2 - 1).toFixed(2)};
      --ejey:${(0.4 + Math.random() * 0.6).toFixed(2)};
      --ejez:${(Math.random() * 2 - 1).toFixed(2)};
      animation-duration:${vida}s;
      animation-delay:-${Math.random() * 0.6}s`;

    container.appendChild(bit);
    setTimeout(() => bit.remove(), vida * 1000 + 300);
  };

  /* Arranca con una lluvia pareja y después sigue cayendo sin parar. */
  for (let i = 0; i < 34; i++) setTimeout(papel, i * 45);
  rain = setInterval(papel, 110);
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

/* ---------- Aspecto ---------- */

/* Dos temas con el mismo diseño: el claro (fondo gris y tarjetas blancas,
   el de siempre de los sitios de competición) y el oscuro, todo en marino.
   La elección queda guardada en el teléfono. La clave cambió con el
   rediseño, así que todos arrancan una vez en el claro. */
const TEMA_KEY = 'pes6_v3_tema';
const TEMAS = ['liga', 'oscuro'];

export function temaActual() {
  try { return localStorage.getItem(TEMA_KEY) || 'liga'; }
  catch { return 'liga'; }
}

export function aplicarTema(nombre) {
  const tema = TEMAS.includes(nombre) ? nombre : 'liga';
  document.documentElement.setAttribute('data-theme', tema);

  /* La barra del navegador acompaña a la barra marino de arriba. */
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = '#001b59';

  try { localStorage.setItem(TEMA_KEY, tema); } catch {}
  return tema;
}

export function alternarTema() {
  const siguiente = temaActual() === 'oscuro' ? 'liga' : 'oscuro';
  aplicarTema(siguiente);
  return siguiente;
}
