/* Placas para compartir. Se dibujan a medida en un lienzo, no son una foto
   de la pantalla: quedan legibles en el chat y pesan poco. */

import { nameOf, colorsOf, team } from '../domain/teams.js';
import { USE_CRESTS, CRESTS_FROM_FOLDER, CRESTS_PATH, CRESTS_AVAILABLE } from '../config.js';
import { TROPHY_SRC } from './ui.js';

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

/* Cargador de imágenes con memoria: cada archivo se pide una sola vez. */
const cache = new Map();

function cargar(url, mismoOrigen = false) {
  if (cache.has(url)) return cache.get(url);
  const p = new Promise(res => {
    const img = new Image();
    if (!mismoOrigen) img.crossOrigin = 'anonymous';   // para poder exportar
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });
  cache.set(url, p);
  return p;
}

export const cargarCopa = () => cargar(TROPHY_SRC, true);

const tieneEscudo = id => USE_CRESTS && CRESTS_FROM_FOLDER &&
  (!CRESTS_AVAILABLE?.length || CRESTS_AVAILABLE.includes(id));

/* Escudo si lo hay; si no, la bandera. Devuelve qué se consiguió para
   saber cómo dibujarlo, porque uno es cuadrado y la otra apaisada. */
export async function insignia(id) {
  const t = team(id);
  if (!t) return { tipo: 'nada', img: null };

  if (tieneEscudo(id)) {
    const img = await cargar(`${CRESTS_PATH}${id}.png`, true);
    if (img) return { tipo: 'escudo', img };
  }
  const img = await cargar(`https://flagcdn.com/w320/${t.iso}.png`);
  return img ? { tipo: 'bandera', img } : { tipo: 'nada', img: null };
}

export const insignias = ids => Promise.all(ids.map(insignia));

/* Dibuja el escudo o la bandera centrados, con la altura pedida.
   Sin ninguno de los dos, franjas con los colores de la selección. */
function marca(ctx, id, cx, cy, alto, dato) {
  if (dato?.tipo === 'escudo') {
    const lado = alto;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(dato.img, cx - lado / 2, cy - lado / 2, lado, lado);
    ctx.restore();
    return;
  }

  const ancho = alto * 1.47;
  const x = cx - ancho / 2, y = cy - alto / 2;

  ctx.save();
  redondo(ctx, x, y, ancho, alto, 10);
  ctx.clip();
  if (dato?.tipo === 'bandera') {
    ctx.drawImage(dato.img, x, y, ancho, alto);
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

/* La copa. Si por algo no carga la imagen, no se dibuja nada y listo. */
function copaImg(ctx, img, cx, cy, alto) {
  if (!img) return;
  const escala = alto / img.height;
  const ancho = img.width * escala;
  ctx.save();
  ctx.shadowColor = 'rgba(224,178,61,.5)';
  ctx.shadowBlur = 26;
  ctx.drawImage(img, cx - ancho / 2, cy, ancho, alto);
  ctx.restore();
}

const fechaLarga = iso => new Date(iso)
  .toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

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
  const [ins, copa] = await Promise.all([insignia(t.champion), cargarCopa()]);
  const c = lienzo();
  const ctx = c.getContext('2d');
  const id = t.champion;

  fondo(ctx, 'rgba(224,178,61,.24)');
  marco(ctx, 'rgba(224,178,61,.55)');

  copaImg(ctx, copa, W / 2, 120, 300);

  texto(ctx, 'CAMPEÓN', 590, { size: 30, color: ORO, weight: '700', track: 10 });

  const size = ajustar(ctx, nameOf(id).toUpperCase(), W - 220, 132, 'Rajdhani', '700');
  textoOro(ctx, nameOf(id).toUpperCase(), 712, size);

  marca(ctx, id, W / 2, 840, 230, ins);

  ctx.fillStyle = 'rgba(255,255,255,.05)';
  redondo(ctx, 100, 960, W - 200, 190, 24);
  ctx.fill();

  const nombre = ajustar(ctx, t.name, W - 280, 42, 'Inter', '600');
  texto(ctx, t.name, 1030, { size: nombre, color: TEXTO, weight: '600' });

  texto(ctx, fechaLarga(t.finishedAt || t.createdAt), 1085, { size: 30, color: TENUE });

  pie(ctx);
  return c;
}

/* Marcador de un partido: las dos banderas, los nombres y el resultado.
   Medidas pensadas para que todo entre holgado dentro del recuadro. */
const MARCO_X   = 140;              // borde izquierdo del recuadro
const MARCO_W   = W - MARCO_X * 2;
const MARCO_ALT = 300;
const BAND_W    = 130;              // ancho de bandera
const BAND_CX   = MARCO_X + 40 + BAND_W / 2;
const NOMBRE_X  = BAND_CX + BAND_W / 2 + 30;
const GOLES_X   = W - MARCO_X - 45;
const NOMBRE_MAX = GOLES_X - NOMBRE_X - 70;

function marcador(ctx, m, top, imgs) {
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  redondo(ctx, MARCO_X, top, MARCO_W, MARCO_ALT, 26);
  ctx.fill();

  const fila = (id, goles, gana, cy, img) => {
    marca(ctx, id, BAND_CX, cy, 96, img);

    ctx.fillStyle = gana ? TEXTO : TENUE;
    const size = ajustar(ctx, nameOf(id).toUpperCase(), NOMBRE_MAX, 58, 'Rajdhani', '700');
    ctx.textAlign = 'left';
    ctx.font = `700 ${size}px Rajdhani, Arial, sans-serif`;
    ctx.fillText(nameOf(id).toUpperCase(), NOMBRE_X, cy + size * .34);

    ctx.textAlign = 'right';
    ctx.font = '700 70px Rajdhani, Arial, sans-serif';
    ctx.fillText(String(goles), GOLES_X, cy + 24);
    ctx.textAlign = 'center';
  };

  fila(m.home, m.hg, m.hg >= m.ag, top + 80, imgs[0]);

  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARCO_X + 60, top + 150);
  ctx.lineTo(W - MARCO_X - 60, top + 150);
  ctx.stroke();

  fila(m.away, m.ag, m.ag >= m.hg, top + 220, imgs[1]);
}

/* ---------- Placa de récord ---------- */

export async function recordCard({ value, unit = '', holder, label, bad = false, match = null, contexto = null }) {
  const img = holder ? await insignia(holder) : null;
  const imgs = match ? await insignias([match.home, match.away]) : [null, null];
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
    marcador(ctx, match, base + 40, imgs);
    if (contexto) {
      const nom = ajustar(ctx, contexto.name, W - 260, 34, 'Inter', '600');
      texto(ctx, contexto.name, base + 400, { size: nom, color: TEXTO, weight: '600' });
      if (contexto.date) {
        texto(ctx, fechaLarga(contexto.date), base + 448, { size: 28, color: TENUE });
      }
    }
  } else if (holder) {
    marca(ctx, holder, W / 2, base + 130, 190, img);
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

/* ---------- Placa de tabla final ---------- */

export async function tableCard(t, rows) {
  const top = rows.slice(0, 8);
  const imgs = await insignias(top.map(r => r.id));

  const c = lienzo();
  const ctx = c.getContext('2d');

  fondo(ctx, 'rgba(77,141,255,.20)');
  marco(ctx, 'rgba(77,141,255,.45)');

  texto(ctx, 'TABLA FINAL', 175, { size: 28, color: LUZ, weight: '700', track: 9 });

  const nom = ajustar(ctx, t.name, W - 240, 62, 'Rajdhani', '700');
  texto(ctx, t.name, 250, { size: nom, color: TEXTO, weight: '700', font: 'Rajdhani' });
  texto(ctx, fechaLarga(t.finishedAt || t.createdAt), 300, { size: 28, color: TENUE });

  const X = 120, ANCHO = W - 240, ALTO = 104;
  let y = 370;

  top.forEach((r, i) => {
    const campeon = i === 0;

    ctx.fillStyle = campeon ? 'rgba(224,178,61,.14)' : 'rgba(255,255,255,.04)';
    redondo(ctx, X, y, ANCHO, ALTO - 12, 18);
    ctx.fill();

    if (campeon) {
      ctx.strokeStyle = 'rgba(224,178,61,.5)';
      ctx.lineWidth = 2;
      redondo(ctx, X, y, ANCHO, ALTO - 12, 18);
      ctx.stroke();
    }

    const cy = y + (ALTO - 12) / 2;

    ctx.textAlign = 'center';
    ctx.fillStyle = campeon ? ORO : TENUE;
    ctx.font = '700 38px "Space Mono", monospace';
    ctx.fillText(String(i + 1), X + 55, cy + 13);

    marca(ctx, r.id, X + 165, cy, 66, imgs[i]);

    ctx.textAlign = 'left';
    ctx.fillStyle = campeon ? ORO : TEXTO;
    const tam = ajustar(ctx, nameOf(r.id).toUpperCase(), 420, 46, 'Rajdhani', '700');
    ctx.font = `700 ${tam}px Rajdhani, Arial, sans-serif`;
    ctx.fillText(nameOf(r.id).toUpperCase(), X + 230, cy + 15);

    ctx.textAlign = 'right';
    ctx.fillStyle = campeon ? ORO : TEXTO;
    ctx.font = '700 44px "Space Mono", monospace';
    ctx.fillText(String(r.pts), X + ANCHO - 34, cy + 15);

    ctx.textAlign = 'center';
    y += ALTO;
  });

  texto(ctx, 'PUNTOS', y + 34, { size: 22, color: TENUE, weight: '600', track: 4 });

  pie(ctx);
  return c;
}

/* ---------- Placa de cara a cara ---------- */

export async function duelCard(a, b, h) {
  const [ia, ib] = await insignias([a, b]);

  const c = lienzo();
  const ctx = c.getContext('2d');

  fondo(ctx, 'rgba(77,141,255,.20)');
  marco(ctx, 'rgba(77,141,255,.45)');

  texto(ctx, 'CARA A CARA', 175, { size: 28, color: LUZ, weight: '700', track: 9 });
  texto(ctx, `${h.pj} ${h.pj === 1 ? 'partido' : 'partidos'}`, 232, { size: 32, color: TENUE });

  const lado = (id, wins, img, cx) => {
    marca(ctx, id, cx, 400, 190, img);
    ctx.fillStyle = TEXTO;
    ctx.font = '700 108px Rajdhani, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(wins), cx, 590);
    const tam = ajustar(ctx, nameOf(id).toUpperCase(), 380, 44, 'Rajdhani', '700');
    ctx.font = `700 ${tam}px Rajdhani, Arial, sans-serif`;
    ctx.fillText(nameOf(id).toUpperCase(), cx, 652);
  };

  lado(a, h.ganóA, ia, 300);
  lado(b, h.ganóB, ib, W - 300);

  ctx.fillStyle = TENUE;
  ctx.font = '700 64px Rajdhani, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('vs', W / 2, 590);

  ctx.fillStyle = 'rgba(255,255,255,.05)';
  redondo(ctx, 140, 740, W - 280, 300, 26);
  ctx.fill();

  const dato = (etiqueta, valor, yy) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = TENUE;
    ctx.font = '500 34px Inter, Arial, sans-serif';
    ctx.fillText(etiqueta, 200, yy);
    ctx.textAlign = 'right';
    ctx.fillStyle = TEXTO;
    ctx.font = '700 40px "Space Mono", monospace';
    ctx.fillText(valor, W - 200, yy);
    ctx.textAlign = 'center';
  };

  dato('Empates', String(h.empates), 830);
  dato('Goles', `${h.golesA} - ${h.golesB}`, 920);
  dato('Ganó más', h.ganóA === h.ganóB ? 'Están iguales'
      : nameOf(h.ganóA > h.ganóB ? a : b), 1010);

  pie(ctx);
  return c;
}

/* ---------- Placa de próximo torneo ---------- */

export async function eventCard(t, cuando) {
  const imgs = await insignias(t.teamIds);
  const sede = t.host ? await insignia(t.host) : null;

  const c = lienzo();
  const ctx = c.getContext('2d');

  fondo(ctx, 'rgba(77,141,255,.22)');
  marco(ctx, 'rgba(77,141,255,.45)');

  texto(ctx, 'PRÓXIMO TORNEO', 190, { size: 28, color: LUZ, weight: '700', track: 9 });

  const dia = cuando
    ? cuando.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    : t.name;
  const conMayus = dia.charAt(0).toUpperCase() + dia.slice(1);
  const tam = ajustar(ctx, conMayus, W - 200, 82, 'Rajdhani', '700');
  texto(ctx, conMayus, 310, { size: tam, color: TEXTO, weight: '700', font: 'Rajdhani' });

  if (t.when?.time) {
    texto(ctx, `${t.when.time} h`, 380, { size: 44, color: LUZ, weight: '600' });
  }

  let y = 470;
  if (t.place) {
    texto(ctx, t.place, y, { size: 40, color: TEXTO, weight: '600' });
    y += 60;
  }
  if (t.host) {
    marca(ctx, t.host, W / 2, y + 32, 108, sede);
    y += 100;
    texto(ctx, `En casa de ${nameOf(t.host)}`, y, { size: 30, color: TENUE });
    y += 40;
  }

  texto(ctx, 'JUEGAN', y + 70, { size: 24, color: TENUE, weight: '700', track: 6 });

  /* Las banderas de los participantes, en filas de a cuatro. */
  const porFila = Math.min(4, t.teamIds.length);
  const ancho = 150, sep = 40;
  let fila = 0, fy = y + 160;

  for (let i = 0; i < t.teamIds.length; i += porFila) {
    const grupo = t.teamIds.slice(i, i + porFila);
    const total = grupo.length * ancho + (grupo.length - 1) * sep;
    let fx = W / 2 - total / 2 + ancho / 2;
    grupo.forEach((id, j) => {
      marca(ctx, id, fx, fy, ancho * 0.72, imgs[i + j]);
      fx += ancho + sep;
    });
    fy += 140;
    fila++;
    if (fila >= 3) break;
  }

  pie(ctx);
  return c;
}
