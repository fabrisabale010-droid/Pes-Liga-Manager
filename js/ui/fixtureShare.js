/* Compartir el fixture de un torneo: como imagen (una o varias, listas para
   WhatsApp) o como texto. Sirve para el que viene y para los ya jugados: en
   ese caso salen los resultados. */

import { openModal, closeModal, say, esc } from './ui.js';
import { fixtureCards, fixtureText, compartirImagen } from './cards.js';
import { isLive } from '../domain/engine.js';

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = texto;
    area.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    area.remove();
    return ok;
  }
}

/* `recien: true` es para cuando se acaba de sortear: la ventana lo celebra y
   ofrece mandarlo al grupo en el momento, que es cuando más se quiere. */
export function openFixtureShare(t, { recien = false } = {}) {
  /* Las imágenes se arman mientras la persona elige. Al tocar "imagen" ya
     están listas: el navegador exige compartir enseguida después del toque,
     y bajar las banderas en ese momento puede hacerle cancelar el envío. */
  const pronta = fixtureCards(t);
  pronta.catch(() => {});

  const enJuego = !t.finished && isLive(t);
  const nota = t.finished ? 'Sale con los resultados.'
    : enJuego ? 'Sale con los resultados hasta ahora.'
    : 'Sale con todas las fechas y quiénes juegan.';

  const link = location.href.split('#')[0] + (t.finished ? '#/historial' : '#/curso');
  const texto = fixtureText(t, link);
  const archivo = `fixture-${t.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'torneo'}`;

  openModal(`
    <i class="ti ${recien ? 'ti-circle-check' : 'ti-share-2'} big-i" aria-hidden="true"
       ${recien ? 'style="color:var(--grass)"' : ''}></i>
    <h3>${recien ? 'Fixture sorteado' : 'Compartir fixture'}</h3>
    <p>${esc(t.name)}. ${recien ? '¿Se lo mandás al grupo?' : nota}</p>
    <div class="share-prev" data-prev aria-live="polite">
      <span><i class="ti ti-loader-2 spin" aria-hidden="true"></i> Preparando imagen…</span>
    </div>
    <div class="share-opts">
      <button class="btn main wide" data-img disabled><i class="ti ti-photo" aria-hidden="true"></i>Enviar como imagen</button>
      <button class="btn wide" data-text><i class="ti ti-message-2" aria-hidden="true"></i>Enviar como texto</button>
      <button class="btn wide" data-copy><i class="ti ti-copy" aria-hidden="true"></i>Copiar texto</button>
      ${recien ? `<button class="btn wide ghost" data-later>Ahora no</button>` : ''}
    </div>
  `, box => {
    const later = box.querySelector('[data-later]');
    if (later) later.onclick = closeModal;

    const prev = box.querySelector('[data-prev]');
    const imgBtn = box.querySelector('[data-img]');

    pronta.then(paginas => {
      prev.innerHTML = `<img alt="Vista previa del fixture" src="${paginas[0].toDataURL('image/jpeg', .8)}">
        ${paginas.length > 1 ? `<small>${paginas.length} imágenes, salen juntas</small>` : ''}`;
      imgBtn.disabled = false;
    }).catch(() => {
      prev.innerHTML = '<span>No se pudo armar la imagen. Probá con el texto.</span>';
    });

    imgBtn.onclick = async () => {
      await compartirImagen(imgBtn, () => pronta, archivo, `⚽ ${t.name}`);
      closeModal();
    };

    box.querySelector('[data-text]').onclick = async () => {
      if (navigator.share) {
        try { await navigator.share({ text: texto }); closeModal(); return; }
        catch (e) { if (e.name === 'AbortError') return; }
      }
      say(await copiar(texto) ? 'Texto copiado, pegalo en el grupo' : 'No se pudo copiar');
    };

    box.querySelector('[data-copy]').onclick = async () => {
      say(await copiar(texto) ? 'Texto copiado, pegalo en el grupo' : 'No se pudo copiar');
    };
  });
}
