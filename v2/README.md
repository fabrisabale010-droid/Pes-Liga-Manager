# PES6 Liga Manager 2.0

Reescritura completa, hecha al lado de la 1.0 y sin tocarla.

## Publicarla

1. En tu repositorio de GitHub, creá una carpeta `v2`.
2. Subí ahí **todo el contenido de esta carpeta**, respetando los subdirectorios
   (`css/`, `js/`, `js/core/`, `js/domain/`, `js/ui/`, `js/views/`).
3. Entrá a `https://TU-USUARIO.github.io/TU-REPO/v2/`.
4. En Chrome: menú ⋮ → *Agregar a pantalla de inicio*.

La 1.0 sigue funcionando en su dirección de siempre. Cuando la 2.0 te convenza,
movés los archivos a la raíz y listo.

> **Importante:** la app usa módulos de JavaScript, así que necesita estar servida
> por internet. Si abrís `index.html` haciendo doble clic desde la computadora, no
> carga. Por GitHub Pages funciona perfecto.

## Los datos

La 2.0 escribe en un documento **separado** de Firestore (`pes6_liga/estado_v2`).
La primera vez que la abrís, importa sola todos los torneos, campeones, llaves y
la cartelera de la 1.0. A partir de ahí cada versión sigue su camino: nada de lo
que hagas en la 2.0 puede romper lo de la 1.0.

## Qué cambió

**Estructura.** De un archivo de 3.500 líneas a módulos con una responsabilidad
cada uno. Las reglas del torneo (`js/domain/engine.js`) no saben que existe una
pantalla ni una base de datos, así que se pueden probar solas — y de hecho se
probaron: fixture, empates, llaves con pases directos y penales.

**Guardado.** Antes cada gol era un viaje a la nube. Ahora los cambios se juntan
y se manda uno solo cada medio segundo.

**Identificadores.** Se terminó el contador que provocaba torneos con el mismo
número (el bug de "borro uno y desaparece otro"). Cada torneo nace con un id
único e irrepetible.

**Un solo lugar para programar.** "Cartelera" y "Nuevo torneo" eran dos pantallas
que había que mantener sincronizadas a mano, y de ahí salieron varios errores.
Ahora es un paso: fecha, sede, jugadores, formato y sorteo. La fecha vive dentro
del torneo, no al lado.

**Direcciones reales.** Cada sección tiene su URL, así el botón "atrás" del
celular vuelve a la pantalla anterior en vez de cerrar la app.

**Funciona sin señal.** La app abre aunque no haya internet y muestra lo último
que sabía.

**Sesión que caduca.** El PIN sigue con hash, pero ahora la sesión de organizador
vence a las 12 horas y hay bloqueo tras cinco intentos.

**Récords.** De 5 a 21, repartidos en "Para presumir" y "Para cargarse un rato".
Las rachas se calculan recorriendo todos los partidos en orden real, así que
cruzan torneos distintos.

**Estadísticas.** Tablas históricas de puntos, promedio y títulos, con filtro por
año, más el cara a cara entre dos selecciones.

## Qué falta para igualar a la 1.0

- Copa Anual (el cruce entre el líder de la tabla anual y el de títulos).
- Hitos de 50 / 100 / 200 goles y similares.

Hasta que estén, conviene tener las dos versiones publicadas.

## Cosas que vas a querer tocar

Todo lo editable está en `js/config.js`: el PIN, los títulos previos a la app y
el último campeón histórico. Para sumar una selección nueva, alcanza con agregar
una línea en `js/domain/teams.js`.

Los escudos oficiales ya tienen su lugar reservado: cuando consigas las imágenes,
poné la dirección en el campo `crest` de cada selección y aparecen solas.

## Seguridad, con honestidad

El PIN evita que alguien toque sin querer, pero no es una cerradura de verdad:
al no haber cuentas, cualquiera con conocimientos técnicos puede saltearlo. La
solución real es Firebase Authentication, y es el próximo paso grande.
