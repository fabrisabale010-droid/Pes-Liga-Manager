/* Todo lo que se toca a mano vive acá. Ningún otro archivo necesita edición
   para cambiar el PIN, la base de datos o los títulos históricos. */

export const firebaseConfig = {
  apiKey: "AIzaSyC4b07yuxN4LlAIUlWT_6CGNktHSmID938",
  authDomain: "pes6-liga-32801.firebaseapp.com",
  projectId: "pes6-liga-32801",
  storageBucket: "pes6-liga-32801.firebasestorage.app",
  messagingSenderId: "681957220881",
  appId: "1:681957220881:web:be1b1a60c4b3d19a4dc7b0"
};

/* La v2 escribe en su propio documento. La v1 sigue intacta en el suyo:
   si algo sale mal, se vuelve a la app anterior y no se perdió nada.
   La primera vez que abrís la v2, importa sola todo lo de la v1. */
export const DOC_PATH = 'pes6_liga/estado_v2';
export const LEGACY_DOC_PATH = 'pes6_liga/estado';
export const LOCAL_KEY = 'pes6_liga_v2';

/* SHA-256 del PIN. El actual corresponde a "2026".
   Para cambiarlo, abrí la consola del navegador y pegá:
     crypto.subtle.digest('SHA-256', new TextEncoder().encode('TU_PIN'))
       .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
*/
export const ADMIN_HASH = '158a323a7ba44870f23d96f1516dd70aa48e9a72db4ebb026b0a89e212a208ab';

/* La sesión de organizador caduca sola. */
export const ADMIN_HOURS = 12;

/* Títulos ganados antes de que existiera la app. */
export const TITLES_BEFORE_APP = { BRA:6, ITA:2, FRA:1 };

/* Último campeón previo a la app, para que Inicio nunca esté vacío. */
export const CHAMPION_BEFORE_APP = 'BRA';

/* Los torneos borrados quedan recuperables en la papelera este tiempo.
   Pasado el plazo se limpian solos la próxima vez que alguien abre la app. */
export const TRASH_DAYS = 7;

/* Escudos de las selecciones.

   USE_CRESTS enciende el sistema. Cada selección muestra su escudo si tiene
   uno cargado en js/domain/teams.js (campo crest); si no, muestra su bandera.
   Se pueden ir agregando de a uno sin tocar nada más.

   CRESTS_FROM_FOLDER es para el otro camino: si bajaste los 30 archivos con
   tools/bajar_escudos.py y subiste la carpeta, poné true y los toma de ahí
   sin necesidad de cargar ningún enlace. */
export const USE_CRESTS = true;
export const CRESTS_FROM_FOLDER = true;
export const CRESTS_PATH = './crests/';

/* Qué escudos hay realmente en la carpeta. Las que no estén acá muestran su
   bandera sin pedir un archivo que no existe.
   Cuando agregues uno nuevo, sumá su código a esta lista. */
export const CRESTS_AVAILABLE = [
  'ARG', 'BRA', 'ENG', 'ESP', 'FRA', 'GER', 'ITA', 'NED', 'POR', 'URU'
];

export const MAX_TEAMS = 16;
export const MAX_PLAYERS = 10;
