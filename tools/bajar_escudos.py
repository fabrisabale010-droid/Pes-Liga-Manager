#!/usr/bin/env python3
"""
Baja los escudos de las 30 selecciones desde Wikipedia.

En vez de adivinar por el nombre del archivo, lee la ficha del artículo
(el recuadro de la derecha) y toma la imagen del escudo, que es la correcta.

    pip install pillow          (opcional, deja las imágenes prolijas)
    python bajar_escudos.py

Se crea la carpeta "crests". Subila a tu repositorio dentro de v2/ y en
js/config.js poné:  export const CRESTS_FROM_FOLDER = true;

Para mirar qué encuentra en un artículo puntual:
    python bajar_escudos.py --ver GER
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

SELECCIONES = {
    'BRA': 'Selección de fútbol de Brasil',
    'ARG': 'Selección de fútbol de Argentina',
    'FRA': 'Selección de fútbol de Francia',
    'ITA': 'Selección de fútbol de Italia',
    'ENG': 'Selección de fútbol de Inglaterra',
    'ESP': 'Selección de fútbol de España',
    'GER': 'Selección de fútbol de Alemania',
    'POR': 'Selección de fútbol de Portugal',
    'NED': 'Selección de fútbol de los Países Bajos',
    'URU': 'Selección de fútbol de Uruguay',
    'MEX': 'Selección de fútbol de México',
    'COL': 'Selección de fútbol de Colombia',
    'CHI': 'Selección de fútbol de Chile',
    'PAR': 'Selección de fútbol de Paraguay',
    'ECU': 'Selección de fútbol de Ecuador',
    'PER': 'Selección de fútbol del Perú',
    'USA': 'Selección de fútbol de Estados Unidos',
    'CRO': 'Selección de fútbol de Croacia',
    'BEL': 'Selección de fútbol de Bélgica',
    'DEN': 'Selección de fútbol de Dinamarca',
    'SWE': 'Selección de fútbol de Suecia',
    'POL': 'Selección de fútbol de Polonia',
    'RUS': 'Selección de fútbol de Rusia',
    'SRB': 'Selección de fútbol de Serbia',
    'SUI': 'Selección de fútbol de Suiza',
    'AUT': 'Selección de fútbol de Austria',
    'TUR': 'Selección de fútbol de Turquía',
    'JPN': 'Selección de fútbol de Japón',
    'KOR': 'Selección de fútbol de Corea del Sur',
    'MAR': 'Selección de fútbol de Marruecos',
}

# Si alguna sale mal, poné acá el nombre exacto del archivo y listo.
#   'GER': 'DFBEagle.svg',
ELEGIDAS = {}

CARPETA = 'crests'
LADO = 256
AGENTE = 'PES6LigaManager/1.0 (proyecto personal entre amigos)'
ESPERA = 1.2
REINTENTOS = 4
WIKIS = ['es.wikipedia.org', 'en.wikipedia.org']

# Campos de la ficha donde suele estar el escudo, en orden de preferencia.
CAMPOS = ['escudo', 'imagen2', 'badge', 'logo', 'image2', 'crest', 'imagen', 'image']

# Filtro de seguridad para lo que jamás es un escudo.
NUNCA = re.compile(
    r'(flag|bandera|pictogram|trofeo|trophy|cup\b|copa|map|mapa|kit|uniform|'
    r'camiseta|stadium|estadio|wiki|commons|icon|pog\.svg|medal|medalla|'
    r'ball\.svg|pelota|question|padlock|ambox|portal)', re.I)

_ultimo = [0.0]


def pedir(url, binario=False):
    for intento in range(REINTENTOS):
        pausa = ESPERA - (time.time() - _ultimo[0])
        if pausa > 0:
            time.sleep(pausa)
        _ultimo[0] = time.time()

        req = urllib.request.Request(url, headers={'User-Agent': AGENTE})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 403, 503) and intento < REINTENTOS - 1:
                espera = 4 * (intento + 1)
                print(f'(HTTP {e.code}, esperando {espera}s) ', end='', flush=True)
                time.sleep(espera)
                continue
            raise RuntimeError(f'HTTP {e.code}') from e
        except Exception as e:
            if intento < REINTENTOS - 1:
                time.sleep(3)
                continue
            raise RuntimeError(type(e).__name__) from e
    raise RuntimeError('demasiados reintentos')


def api(wiki, params):
    params = dict(params, format='json', formatversion='2')
    return json.loads(pedir(f'https://{wiki}/w/api.php?' + urllib.parse.urlencode(params)))


def ficha(wiki, titulo):
    """Texto de la ficha del artículo (la primera sección)."""
    datos = api(wiki, {
        'action': 'query', 'titles': titulo, 'redirects': '1',
        'prop': 'revisions', 'rvprop': 'content', 'rvslots': 'main',
        'rvsection': '0',
    })
    paginas = datos.get('query', {}).get('pages', [])
    if not paginas or paginas[0].get('missing'):
        return None
    try:
        return paginas[0]['revisions'][0]['slots']['main']['content']
    except (KeyError, IndexError):
        return None


def archivo_de_ficha(texto):
    """Busca en la ficha el campo del escudo y devuelve el nombre del archivo."""
    if not texto:
        return None
    for campo in CAMPOS:
        for patron in (
            rf'\|\s*{campo}\s*=\s*\[\[\s*(?:File|Archivo|Imagen|Image)\s*:\s*([^\]\|]+)',
            rf'\|\s*{campo}\s*=\s*([^\|\n\}}]+\.(?:png|svg|jpg|jpeg))',
        ):
            m = re.search(patron, texto, re.I)
            if m:
                nombre = m.group(1).strip()
                if nombre and not NUNCA.search(nombre):
                    return nombre
    return None


def url_de(wiki, archivo):
    datos = api(wiki, {
        'action': 'query', 'titles': 'File:' + archivo,
        'prop': 'imageinfo', 'iiprop': 'url', 'iiurlwidth': str(LADO),
    })
    paginas = datos.get('query', {}).get('pages', [])
    if not paginas:
        return None
    info = paginas[0].get('imageinfo')
    if not info:
        return None
    return info[0].get('thumburl') or info[0].get('url')


def acomodar(ruta):
    try:
        from PIL import Image
    except ImportError:
        return False
    im = Image.open(ruta).convert('RGBA')
    ancho, alto = im.size
    lado = max(ancho, alto)
    lienzo = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    lienzo.paste(im, ((lado - ancho) // 2, (lado - alto) // 2), im)
    lienzo.resize((LADO, LADO), Image.LANCZOS).save(ruta, optimize=True)
    return True


def buscar(codigo, titulo):
    """Devuelve (url, nombre_o_motivo)."""
    manual = ELEGIDAS.get(codigo)
    motivo = 'no se encontró el artículo'

    for wiki in WIKIS:
        archivo = manual
        if not archivo:
            try:
                archivo = archivo_de_ficha(ficha(wiki, titulo))
            except Exception as e:
                motivo = f'error de conexión ({e})'
                continue
            if not archivo:
                motivo = f'la ficha de {wiki} no tiene escudo'
                continue
        try:
            url = url_de(wiki, archivo)
        except Exception as e:
            motivo = f'no se pudo resolver el archivo ({e})'
            continue
        if url:
            return url, archivo
        motivo = 'el archivo no existe en ' + wiki

    return None, motivo


def ver(codigo):
    titulo = SELECCIONES.get(codigo)
    if not titulo:
        print('Código desconocido:', codigo)
        return
    for wiki in WIKIS:
        print(f'\n=== {wiki} — {titulo} ===')
        try:
            texto = ficha(wiki, titulo)
        except Exception as e:
            print('  error:', e)
            continue
        if not texto:
            print('  el artículo no existe acá')
            continue
        encontrados = re.findall(
            r'\|\s*([\w]+)\s*=\s*\[?\[?\s*(?:File|Archivo|Imagen|Image)?\s*:?\s*'
            r'([^\|\n\]\}]+\.(?:png|svg|jpg|jpeg))', texto, re.I)
        if not encontrados:
            print('  la ficha no menciona ninguna imagen')
        for campo, arch in encontrados:
            marca = '  <-- se usaría' if campo.lower() in CAMPOS and not NUNCA.search(arch) else ''
            print(f'  {campo:12} = {arch.strip()}{marca}')
        print('  elegido:', archivo_de_ficha(texto))


def main():
    os.makedirs(CARPETA, exist_ok=True)
    fallaron = []
    total = len(SELECCIONES)
    print(f'Bajando {total} escudos. Tarda un par de minutos porque le pide '
          f'despacio al servidor.\n')

    for i, (codigo, titulo) in enumerate(SELECCIONES.items(), 1):
        destino = os.path.join(CARPETA, codigo + '.png')
        print(f'[{i:2}/{total}] {codigo} ', end=' ', flush=True)

        if os.path.exists(destino):
            print('ya estaba')
            continue

        url, detalle = buscar(codigo, titulo)
        if not url:
            print('NO ENCONTRADO —', detalle)
            fallaron.append(codigo)
            continue

        try:
            with open(destino, 'wb') as f:
                f.write(pedir(url, binario=True))
        except Exception as e:
            print('ERROR al bajar —', e)
            fallaron.append(codigo)
            if os.path.exists(destino):
                os.remove(destino)
            continue

        print(('listo' if acomodar(destino) else 'listo (sin recortar)'),
              '·', detalle[:46])

    print()
    print(f'Guardados en la carpeta "{CARPETA}".')
    if fallaron:
        print('Faltaron:', ', '.join(fallaron))
        print(f'    python {os.path.basename(__file__)} --ver {fallaron[0]}')
    else:
        print('Salieron las 30.')
    print()
    print('Subí la carpeta a v2/ y poné CRESTS_FROM_FOLDER = true en js/config.js')


if __name__ == '__main__':
    if sys.version_info < (3, 6):
        sys.exit('Hace falta Python 3.6 o más nuevo.')
    if '--ver' in sys.argv:
        ver(sys.argv[sys.argv.index('--ver') + 1].upper())
    else:
        main()
