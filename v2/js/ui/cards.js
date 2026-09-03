/* Placas para compartir. Se dibujan a medida en un lienzo, no son una foto
   de la pantalla: quedan legibles en el chat y pesan poco. */

import { nameOf, colorsOf, team } from '../domain/teams.js';

const W = 1080;
const H = 1350;                 // proporción vertical, la que mejor entra en el chat

const ORO      = '#e0b23d';
const ORO_CLARO= '#fff3cf';
const ORO_OSC  = '#a97d1f';
const NOCHE    = '#05070d';
const TRIBUNA  = '#0c1322';
const TEXTO    = '#e8edf7';
const TENUE    = '#8d9ab4';
const LUZ      = '#4d8dff';
const ROJO     = '#d6455b';
const VERDE    = '#2fa86a';

const lienzo = () => {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  return c;
};

/* ---------- Piezas de dibujo ---------- */

function fondo(ctx, tinte) {
  ctx.fillStyle = NOCHE;
  ctx.fillRect(0, 0, W, H);

  const luz = ctx.createRadialGradient(W / 2, -180, 40, W / 2, -180, 1150);
  luz.addColorStop(0, tinte);
  luz.addColorStop(1, 'rgba(5,7,13,0)');
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, W, H);
}

function marco(ctx, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  redondo(ctx, 40, 40, W - 80, H - 80, 34);
  ctx.stroke();
}

function redondo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function texto(ctx, txt, y, { size = 40, color = TEXTO, weight = '600', font = 'Inter', track = 0 }) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${font}, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (!track) { ctx.fillText(txt, W / 2, y); return; }

  const letras = [...txt];
  const ancho = letras.reduce((a, l) => a + ctx.measureText(l).width + track, -track);
  let x = W / 2 - ancho / 2;
  ctx.textAlign = 'left';
  letras.forEach(l => { ctx.fillText(l, x, y); x += ctx.measureText(l).width + track; });
  ctx.textAlign = 'center';
}

/* Texto con degradé dorado, para los nombres importantes. */
function textoOro(ctx, txt, y, size) {
  const g = ctx.createLinearGradient(0, y - size, 0, y + size * .28);
  g.addColorStop(0, ORO_CLARO);
  g.addColorStop(.55, ORO);
  g.addColorStop(1, ORO_OSC);
  texto(ctx, txt, y, { size, color: g, weight: '700', font: 'Rajdhani' });
}

/* La copa, dibujada con las mismas curvas que usa la app. */
function copa(ctx, cx, cy, alto) {
  const e = alto / 64;
  ctx.save();
  ctx.translate(cx - 24 * e, cy);
  ctx.scale(e, e);

  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, ORO_CLARO);
  g.addColorStop(.42, ORO);
  g.addColorStop(1, ORO_OSC);

  ctx.strokeStyle = g;
  ctx.lineWidth = 4.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  [
    'M24 3.6c8.2 0 14.6 6.3 14.6 14.2 0 3.4-.9 6.1-2.4 9.6-3.6 8.3-5.2 14.6-5.2 21.1 0 4.6.7 8.6 2.3 12.9H14.7c1.6-4.3 2.3-8.3 2.3-12.9 0-6.5-1.6-12.8-5.2-21.1C10.3 23.9 9.4 21.2 9.4 17.8 9.4 9.9 15.8 3.6 24 3.6Z',
    'M17.4 21.6c1.9 0 3.4-1.6 3.4-3.7 0-1.2-.3-2.2-.7-3.4-.5-1.4-.8-2.4-.8-3.3 0-1.7 1.1-3 2.7-3 2.6 0 5.2 3.9 7.3 9.1 1.3 3.2 2.7 4.8 5.3 5.2',
    'M20.4 24.2c2.4 3.8 3.6 7.1 3.6 11 0 5.3-2.1 11-6 17.6',
    'M15.6 52.8h16.8'
  ].forEach(d => ctx.stroke(new Path2D(d)));

  ctx.restore();
}

/* Bandera de verdad, traída como imagen. Si no carga (sin señal, por ejemplo)
   se dibujan franjas con los colores de la selección, que es mejor que nada. */
const cache = new Map();

function cargarBandera(iso) {
  if (cache.has(iso)) return cache.get(iso);
  const p = new Promise(res => {
    const img = new Image();
    img.crossOrigin = 'anonymous';        // hace falta para poder exportar la imagen
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = `https://flagcdn.com/w320/${iso}.png`;
  });
  cache.set(iso, p);
  return p;
}

function bandera(ctx, id, cx, cy, ancho, img) {
  const alto = ancho * .68;
  const x = cx - ancho / 2, y = cy - alto / 2;

  ctx.save();
  redondo(ctx, x, y, ancho, alto, 10);
  ctx.clip();

  if (img) {
    ctx.drawImage(img, x, y, ancho, alto);
  } else {
    const cols = colorsOf(id);
    const franja = ancho / cols.length;
    cols.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(x + i * franja, y, franja + 1, alto);
    });
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,.28)';
  ctx.lineWidth = 2;
  redondo(ctx, x, y, ancho, alto, 10);
  ctx.stroke();
}

function pie(ctx) {
  texto(ctx, 'PES6 LIGA MANAGER', H - 92, { size: 26, color: TENUE, weight: '700', track: 5 });
}

/* Corta el texto para que nunca se pase del ancho. */
function ajustar(ctx, txt, max, size, font, weight) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${font}, Arial, sans-serif`;
    if (ctx.measureText(txt).width <= max) break;
    s -= 4;
  } while (s > 24);
  return s;
}

/* ---------- Placa de campeón ---------- */

export async function championCard(t) {
  const img = await cargarBandera(team(t.champion)?.iso);
  const c = lienzo();
  const ctx = c.getContext('2d');
  const id = t.champion;

  fondo(ctx, 'rgba(224,178,61,.24)');
  marco(ctx, 'rgba(224,178,61,.55)');

  copa(ctx, W / 2, 190, 250);

  texto(ctx, 'CAMPEÓN', 590, { size: 30, color: ORO, weight: '700', track: 10 });

  const size = ajustar(ctx, nameOf(id).toUpperCase(), W - 220, 132, 'Rajdhani', '700');
  textoOro(ctx, nameOf(id).toUpperCase(), 712, size);

  bandera(ctx, id, W / 2, 830, 230, img);

  ctx.fillStyle = 'rgba(255,255,255,.05)';
  redondo(ctx, 100, 960, W - 200, 190, 24);
  ctx.fill();

  const nombre = ajustar(ctx, t.name, W - 280, 42, 'Inter', '600');
  texto(ctx, t.name, 1030, { size: nombre, color: TEXTO, weight: '600' });

  const fecha = new Date(t.finishedAt || t.createdAt)
    .toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  texto(ctx, fecha, 1085, { size: 30, color: TENUE });

  pie(ctx);
  return c;
}

/* Marcador de un partido: las dos banderas, los nombres y el resultado. */
function marcador(ctx, m, y, imgs) {
  const fila = (id, goles, gana, yy, img) => {
    ctx.save();
    bandera(ctx, id, 210, yy, 150, img);

    ctx.textAlign = 'left';
    ctx.fillStyle = gana ? TEXTO : TENUE;
    const size = ajustar(ctx, nameOf(id).toUpperCase(), 520, 62, 'Rajdhani', '700');
    ctx.font = `700 ${size}px Rajdhani, Arial, sans-serif`;
    ctx.fillText(nameOf(id).toUpperCase(), 310, yy + size * .34);

    ctx.textAlign = 'right';
    ctx.fillStyle = gana ? TEXTO : TENUE;
    ctx.font = `700 74px Rajdhani, Arial, sans-serif`;
    ctx.fillText(String(goles), W - 190, yy + 26);
    ctx.restore();
  };

  fila(m.home, m.hg, m.hg >= m.ag, y, imgs[0]);

  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(190, y + 82);
  ctx.lineTo(W - 190, y + 82);
  ctx.stroke();

  fila(m.away, m.ag, m.ag >= m.hg, y + 164, imgs[1]);
  ctx.textAlign = 'center';
}

/* ---------- Placa de récord ---------- */

export async function recordCard({ value, unit = '', holder, label, bad = false, match = null }) {
  const img = holder ? await cargarBandera(team(holder)?.iso) : null;
  const imgs = match
    ? await Promise.all([cargarBandera(team(match.home)?.iso), cargarBandera(team(match.away)?.iso)])
    : [null, null];
  const c = lienzo();
  const ctx = c.getContext('2d');
  const color = bad ? ROJO : VERDE;

  fondo(ctx, bad ? 'rgba(214,69,91,.20)' : 'rgba(47,168,106,.20)');
  marco(ctx, bad ? 'rgba(214,69,91,.5)' : 'rgba(47,168,106,.5)');

  texto(ctx, bad ? 'PARA CARGARSE' : 'RÉCORD', 210,
        { size: 30, color, weight: '700', track: 10 });

  const num = String(value) + unit;
  const size = ajustar(ctx, num, W - 240, 300, 'Rajdhani', '700');
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px Rajdhani, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(num, W / 2, 500);

  const partes = envolver(ctx, label, W - 260, 44, 'Inter', '500');
  partes.forEach((linea, i) =>
    texto(ctx, linea, 590 + i * 58, { size: 44, color: TEXTO, weight: '500' }));

  const base = 590 + partes.length * 58;

  if (match) {
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    redondo(ctx, 140, base + 40, W - 280, 290, 26);
    ctx.fill();
    marcador(ctx, match, base + 130, imgs);
  } else if (holder) {
    bandera(ctx, holder, W / 2, base + 130, 200, img);
    const nom = ajustar(ctx, nameOf(holder).toUpperCase(), W - 220, 88, 'Rajdhani', '700');
    texto(ctx, nameOf(holder).toUpperCase(), base + 300,
          { size: nom, color: TEXTO, weight: '700', font: 'Rajdhani' });
  }

  pie(ctx);
  return c;
}

function envolver(ctx, txt, max, size, font, weight) {
  ctx.font = `${weight} ${size}px ${font}, Arial, sans-serif`;
  const palabras = txt.split(' ');
  const lineas = [];
  let actual = '';
  palabras.forEach(p => {
    const prueba = actual ? actual + ' ' + p : p;
    if (ctx.measureText(prueba).width > max && actual) { lineas.push(actual); actual = p; }
    else actual = prueba;
  });
  if (actual) lineas.push(actual);
  return lineas.slice(0, 3);
}

/* ---------- Compartir ---------- */

const aBlob = canvas =>
  new Promise(res => canvas.toBlob(res, 'image/png'));

/* Abre el menú de compartir del celular con la imagen lista.
   Si el dispositivo no lo permite, la descarga. */
export async function share(canvas, nombre, texto = '') {
  const blob = await aBlob(canvas);
  if (!blob) throw new Error('No se pudo generar la imagen');

  const file = new File([blob], `${nombre}.png`, { type: 'image/png' });

  /* Algunos navegadores tienen navigator.share pero responden mal a
     canShare, así que se intenta igual y recién se descarga si falla. */
  if (navigator.share) {
    const intentos = [{ files: [file], text: texto }, { files: [file] }];
    for (const datos of intentos) {
      try {
        if (navigator.canShare && !navigator.canShare(datos)) continue;
        await navigator.share(datos);
        return 'compartida';
      } catch (e) {
        if (e.name === 'AbortError') return 'cancelada';
        // si falló, se prueba la variante siguiente
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombre}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'descargada';
}
