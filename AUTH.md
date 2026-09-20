# Activar cuentas reales para los organizadores

Hoy el modo organizador se protege con un PIN, y eso **no es seguridad real**:
cualquiera que abra las herramientas del navegador puede saltearlo y, como las
reglas de Firestore están abiertas, borrar todo. Con este cambio, sólo las
cuentas de Google de la lista pueden guardar. El resto puede mirar, pero no
tocar, aunque modifique el código.

La app viene con `AUTH_MODE = 'pin'`: **nada cambia hasta que hagas estos pasos,
en este orden.** Si publicás las reglas antes de tiempo, nadie va a poder guardar.

## 1. Habilitar Google en Firebase (2 minutos)

1. Consola de Firebase → tu proyecto → **Authentication** → *Comenzar*.
2. Pestaña **Sign-in method** → **Google** → *Habilitar*. Elegí un correo de
   soporte y *Guardar*.
3. Pestaña **Settings** → **Authorized domains** → *Agregar dominio*:
   `TU-USUARIO.github.io` (el de tu GitHub Pages).

## 2. Cargar los organizadores

En `js/config.js`:

```js
export const AUTH_MODE = 'google';
export const ORGANIZER_EMAILS = [
  'tu-correo@gmail.com',
  'otro-organizador@gmail.com',
];
```

Correos en minúsculas y con la cuenta de Google que van a usar en el celular.

## 3. Subir a GitHub y probar

Subí toda la carpeta. Abrí la app, tocá el candado → **Entrar con Google**.
Con cada organizador: entrar, cargar un resultado de prueba y ver que se guarda
(arriba aparece "Guardando…" y desaparece). **Todavía con las reglas viejas**,
así que si algo falla, no se perdió nada.

## 4. Publicar las reglas

1. Abrí `firestore.rules` y cambiá los correos de ejemplo por los reales.
2. Consola de Firebase → **Firestore Database** → **Reglas** → pegá todo el
   contenido → **Publicar**.

## 5. Verificar

- En una ventana de incógnito abrí la app: se ve todo, pero el candado sólo
  deja entrar a las cuentas de la lista.
- Entrá con otra cuenta de Google que no esté en la lista: dice "Esa cuenta no
  está en la lista de organizadores".

## Si algo sale mal

Volver atrás es rápido:

1. En **Reglas** poné temporalmente `allow read, write: if true;` y *Publicar*.
2. En `config.js` poné `AUTH_MODE = 'pin'` y volvé a subir.

## Cosas a tener en cuenta

- Los celulares con la versión vieja instalada siguen intentando guardar sin
  cuenta: con las reglas nuevas eso falla hasta que se actualicen (se
  actualizan solos al abrir la app un par de veces con internet).
- Las copias diarias `respaldo_v2_AAAA-MM-DD` que ya se crean quedan legibles
  sólo por organizadores.
- La sesión de Google no vence sola como el PIN de 12 horas. Para salir, el
  mismo candado.
- El `ADMIN_HASH` (PIN) deja de usarse en modo `google`.
- La clave `apiKey` de `config.js` es pública por diseño en Firebase. Lo que
  protege los datos son las reglas, no esa clave.
