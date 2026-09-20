/* Fusión de tres puntas. Sin dependencias: se puede probar sola.

   Cuando dos organizadores cargan cosas a la vez, cada uno parte de la misma
   foto de la nube (`base`) y le hace cambios distintos (`local` y `remote`).
   En vez de que el último en guardar pise todo, se comparan las tres versiones
   y se conserva lo que cada uno cambió:

   - Si sólo uno tocó algo, se queda con su cambio.
   - Los torneos, partidos y campeonatos se identifican por su `id`, así que
     un torneo creado por uno nunca desaparece porque el otro no lo tenía.
   - Si los dos tocaron el mismo dato con valores distintos, gana `local`
     (el que está guardando ahora).
   - Si uno borró algo que el otro modificó, se conserva lo modificado:
     ante la duda, no se pierde nada. */

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export function same(a, b) {
  if (a === b) return true;
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]));
  }
  if (isObj(a)) {
    if (!isObj(b)) return false;
    const ka = Object.keys(a).filter(k => a[k] !== undefined);
    const kb = Object.keys(b).filter(k => b[k] !== undefined);
    return ka.length === kb.length && ka.every(k => same(a[k], b[k]));
  }
  return false;
}

export const clone = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/* Una lista donde todo tiene `id` se funde elemento por elemento. */
const keyed = arr => Array.isArray(arr) &&
  arr.every(x => isObj(x) && x.id !== undefined && x.id !== null);

function mergeById(base, local, remote) {
  const index = list => new Map(list.map(x => [String(x.id), x]));
  const B = index(base), L = index(local), R = index(remote);

  const order = [...L.keys()];
  R.forEach((_, id) => { if (!L.has(id)) order.push(id); });

  const out = [];
  order.forEach(id => {
    const b = B.get(id), l = L.get(id), r = R.get(id);

    if (l && r) return out.push(merge3(b, l, r));

    /* Sólo en una de las dos puntas. Si estaba en la base, la otra lo borró:
       se respeta el borrado únicamente si éste no lo tocó desde entonces. */
    const kept = l || r;
    if (!b) return out.push(kept);              // lo creó uno de los dos
    if (!same(kept, b)) out.push(kept);         // lo borraron, pero lo habían modificado
  });
  return out;
}

export function merge3(base, local, remote) {
  if (same(local, remote)) return local;
  if (same(local, base)) return remote;
  if (same(remote, base)) return local;

  /* Los dos cambiaron algo distinto. */
  if (local === undefined) return remote;
  if (remote === undefined) return local;

  if (isObj(local) && isObj(remote)) {
    const b = isObj(base) ? base : {};
    const out = {};
    new Set([...Object.keys(local), ...Object.keys(remote)]).forEach(k => {
      const v = merge3(b[k], local[k], remote[k]);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }

  if (Array.isArray(local) && Array.isArray(remote)) {
    const b = Array.isArray(base) ? base : [];
    if (keyed(local) && keyed(remote) && keyed(b)) return mergeById(b, local, remote);
  }

  return local;
}
