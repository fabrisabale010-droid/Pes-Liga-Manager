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

**Copa Anual.** Cierra el año enfrentando al que más puntos sumó contra el que
más torneos ganó. Si es el mismo equipo, espera en la final mientras los segundos
de cada tabla definen quién lo enfrenta. Vive en Estadísticas y sus títulos se
cuentan aparte en la Vitrina.

**Hitos.** Escalones de 25, 50, 100 y de ahí para arriba en goles, puntos,
victorias, partidos, goles recibidos y derrotas. Además muestra los que están a
quince o menos de caer, así se sabe qué mirar el próximo torneo.

**Papelera.** Borrar un torneo no lo elimina: lo manda a una papelera donde se
puede recuperar durante 7 días. Mientras tanto no aparece en ninguna tabla,
vitrina ni récord, como si no existiera. Pasado el plazo se limpia sola. El plazo
se cambia en `js/config.js` (`TRASH_DAYS`).

**Compartir por WhatsApp.** La placa del campeón y cada récord tienen un botón
que arma una imagen y abre el menú de compartir del celular. La imagen se dibuja
a medida, no es una captura: se lee bien en el chat y pesa poco. Si el celular no
permite compartir archivos, la descarga.

## Estado

La 2.0 ya cubre todo lo que hacía la anterior. Cuando la tengas probada un par
de fechas, se pueden mover los archivos a la raíz y jubilar la 1.0.

## Escudos de las selecciones

Hay dos caminos. En los dos, la selección que no tenga escudo muestra su
bandera, así que se puede ir completando de a poco.

**Uno por uno.** En `js/domain/teams.js`, en el campo `crest` de cada selección,
pegá el enlace directo a la imagen (tiene que empezar con `upload.wikimedia.org`
y terminar en `.png`). Ya están cargados Brasil, Argentina, Francia, Italia y
Holanda.

**Todos de una.** Para bajarlos al repositorio y no depender de enlaces ajenos:

1. Corré `tools/bajar_escudos.py` en tu computadora (necesita Python y Pillow:
   `pip install pillow`). Baja los 30 escudos desde Wikipedia y los deja con el
   nombre correcto.
2. Subí la carpeta `crests` que se genera dentro de `v2/`.
3. En `js/config.js` poné `CRESTS_FROM_FOLDER = true`.

Los escudos aparecen en la placa del campeón, la vitrina, la ficha de cada
selección y la Copa Anual. En tablas y fixtures se siguen usando banderas, que
a tamaño chico se leen mucho mejor.

Si a alguna selección le falta su archivo, esa muestra la bandera y el resto se
ve igual: no hace falta tenerlos todos.

Los escudos son marcas registradas de cada federación. Para un grupo de amigos
no hay problema, pero no los redistribuyas como si fueran tuyos.

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
