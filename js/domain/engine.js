/* Reglas puras del torneo. Nada de acá toca la pantalla ni la base de datos,
   así que se puede razonar y probar sin abrir la app. */

import { nameOf } from './teams.js';

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const newGame = (id, day, home, away, group = null) => ({
  id, day, home, away, group,
  hg: null, ag: null, played: false
});

/* ---------- Fixture ---------- */

/* Método del círculo: todos contra todos, sin repetir fecha. */
function circle(ids) {
  const list = [...ids];
  if (list.length % 2) list.push(null);
  const n = list.length;
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i], b = list[n - 1 - i];
      if (a && b) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop());
  }
  return rounds;
}

export function leagueFixture(ids, double) {
  const rounds = circle(shuffle(ids));
  const games = [];
  let id = 1;
  rounds.forEach((pairs, i) =>
    pairs.forEach(([h, a]) => games.push(newGame(id++, i + 1, h, a)))
  );
  if (double) {
    rounds.forEach((pairs, i) =>
      pairs.forEach(([h, a]) => games.push(newGame(id++, rounds.length + i + 1, a, h)))
    );
  }
  return games;
}

export function makeGroups(ids, count) {
  const mixed = shuffle(ids);
  const groups = Array.from({ length: count }, (_, i) => ({
    label: String.fromCharCode(65 + i),
    teamIds: []
  }));
  mixed.forEach((id, i) => groups[i % count].teamIds.push(id));
  return groups;
}

export function groupFixture(groups) {
  const games = [];
  let id = 1;
  groups.forEach(g => {
    circle(g.teamIds).forEach((pairs, i) =>
      pairs.forEach(([h, a]) => games.push(newGame(id++, i + 1, h, a, g.label)))
    );
  });
  return games;
}

/* ---------- Tabla ---------- */

export function table(ids, games) {
  const rows = new Map(ids.map(id => [id, {
    id, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0
  }]));

  games.forEach(m => {
    if (!m.played) return;
    const h = rows.get(m.home), a = rows.get(m.away);
    if (!h || !a) return;
    h.pj++; a.pj++;
    h.gf += m.hg; h.gc += m.ag;
    a.gf += m.ag; a.gc += m.hg;
    if (m.hg > m.ag) { h.pg++; a.pp++; h.pts += 3; }
    else if (m.hg < m.ag) { a.pg++; h.pp++; a.pts += 3; }
    else { h.pe++; a.pe++; h.pts++; a.pts++; }
  });

  return [...rows.values()]
    .map(r => ({ ...r, dg: r.gf - r.gc }))
    .sort((x, y) =>
      y.pts - x.pts ||
      y.dg - x.dg ||
      y.gf - x.gf ||
      nameOf(x.id).localeCompare(nameOf(y.id))
    );
}

export const groupTable = (t, label) =>
  table(
    t.groups.find(g => g.label === label).teamIds,
    t.games.filter(m => m.group === label)
  );

export function progress(t) {
  const all = allGames(t);
  const played = all.filter(m => m.played).length;
  return { played, total: all.length, pct: all.length ? Math.round(played / all.length * 100) : 0 };
}

const allGames = t => [
  ...t.games,
  ...(t.bracket ? t.bracket.games.filter(m => !m.bye) : [])
];

/* La fecha que se está jugando: la primera con algún partido sin cargar. */
export function currentDay(t) {
  const days = [...new Set(t.games.map(m => m.day))].sort((a, b) => a - b);
  for (const day of days) {
    const games = t.games.filter(m => m.day === day);
    if (games.some(m => !m.played)) return { day, games };
  }
  return null;
}

/* ---------- Llaves ---------- */

function seedOrder(size) {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    const next = [];
    order.forEach(x => { next.push(x); next.push(n + 1 - x); });
    order = next;
  }
  return order;
}

export function qualifiers(t) {
  const perGroup = t.groupsConfig.advance;
  const out = [];
  t.groups.forEach(g => {
    groupTable(t, g.label).slice(0, perGroup).forEach((row, i) => {
      out.push({ id: row.id, rank: i + 1, group: g.label, pts: row.pts, dg: row.dg, gf: row.gf });
    });
  });
  return out.sort((a, b) =>
    a.rank - b.rank || b.pts - a.pts || b.dg - a.dg || b.gf - a.gf
  );
}

export function buildBracket(seedIds) {
  let size = 1;
  while (size < seedIds.length) size *= 2;
  const slots = seedOrder(size).map(pos => seedIds[pos - 1] ?? null);
  const games = [];
  let id = 1;
  for (let i = 0; i < size; i += 2) {
    const home = slots[i], away = slots[i + 1];
    games.push({
      id: id++, round: 1, pos: i / 2, home, away,
      hg: null, ag: null, played: false, penWinner: null,
      bye: !(home && away)
    });
  }
  return advance({ games, rounds: Math.round(Math.log2(size)) });
}

export function tieWinner(m) {
  if (m.bye) return m.home || m.away;
  if (m.penWinner) return m.penWinner;
  if (m.played && m.hg !== m.ag) return m.hg > m.ag ? m.home : m.away;
  return null;
}

export function advance(bracket) {
  for (let r = 1; r < bracket.rounds; r++) {
    const cur = bracket.games.filter(m => m.round === r).sort((a, b) => a.pos - b.pos);
    if (!cur.length) break;
    const winners = cur.map(tieWinner);
    if (winners.some(w => !w)) break;

    for (let i = 0; i < winners.length; i += 2) {
      const pos = i / 2;
      let next = bracket.games.find(m => m.round === r + 1 && m.pos === pos);
      if (!next) {
        next = {
          id: Math.max(0, ...bracket.games.map(m => m.id)) + 1,
          round: r + 1, pos,
          home: winners[i], away: winners[i + 1] ?? null,
          hg: null, ag: null, played: false, penWinner: null,
          bye: !(winners[i] && winners[i + 1])
        };
        bracket.games.push(next);
      } else if (!next.played && !next.penWinner) {
        next.home = winners[i];
        next.away = winners[i + 1] ?? null;
        next.bye = !(next.home && next.away);
      }
    }
  }
  return bracket;
}

export function roundName(round, total) {
  const left = total - round;
  if (left === 0) return 'Final';
  if (left === 1) return 'Semifinal';
  if (left === 2) return 'Cuartos de final';
  if (left === 3) return 'Octavos de final';
  return `Ronda ${round}`;
}

/* ---------- Quién ganó ---------- */

/* Devuelve el campeón si el torneo ya está definido, o null si falta algo. */
export function champion(t) {
  if (t.format === 'copa') {
    if (!t.bracket) return null;
    const final = t.bracket.games.find(m => m.round === t.bracket.rounds);
    return final ? tieWinner(final) : null;
  }
  if (t.games.some(m => !m.played)) return null;
  const rows = table(t.teamIds, t.games);
  if (rows.length < 2) return rows[0]?.id ?? null;
  const tied = rows[0].pts === rows[1].pts &&
               rows[0].dg === rows[1].dg &&
               rows[0].gf === rows[1].gf;
  if (tied) return t.penWinner ?? null;
  return rows[0].id;
}

/* Empate exacto en la punta: hace falta definir a mano. */
export function needsDecider(t) {
  if (t.format === 'copa' || t.games.some(m => !m.played)) return null;
  const rows = table(t.teamIds, t.games);
  if (rows.length < 2) return null;
  const top = rows.filter(r =>
    r.pts === rows[0].pts && r.dg === rows[0].dg && r.gf === rows[0].gf
  );
  return top.length > 1 ? top.map(r => r.id) : null;
}

/* Orden final que se muestra: para copa manda la llave, no los puntos. */
export function finalTable(t) {
  if (t.format !== 'copa' || !t.bracket) {
    const rows = table(t.teamIds, t.games);
    const champ = champion(t);
    if (champ && rows.length && rows[0].id !== champ) {
      const i = rows.findIndex(r => r.id === champ);
      if (i > 0) rows.unshift(rows.splice(i, 1)[0]);
    }
    return rows;
  }
  const rows = table(t.teamIds, t.games);
  const rank = new Map();
  t.bracket.games.forEach(m => {
    const w = tieWinner(m);
    if (!w || m.bye) return;
    const loser = w === m.home ? m.away : m.home;
    if (loser) rank.set(loser, m.round);
  });
  const champ = champion(t);
  if (champ) rank.set(champ, 99);
  return rows.sort((a, b) =>
    (rank.get(b.id) ?? -1) - (rank.get(a.id) ?? -1) ||
    b.pts - a.pts || b.dg - a.dg
  );
}

/* ---------- Crear ---------- */

export function createTournament({ name, teamIds, format, groups, advance: adv, when, place, host }) {
  const base = {
    id: uid(),
    name,
    createdAt: new Date().toISOString(),
    format,                 // 'ida' | 'vuelta' | 'copa'
    teamIds: [...teamIds],
    finished: false,
    finishedAt: null,
    champion: null,
    penWinner: null,
    when: when || null,     // { date, time }
    place: place || null,
    host: host || null,
    groups: null,
    groupsConfig: null,
    bracket: null,
    games: []
  };

  if (format === 'copa') {
    base.groups = makeGroups(teamIds, groups);
    base.groupsConfig = { count: groups, advance: adv };
    base.games = groupFixture(base.groups);
  } else {
    base.games = leagueFixture(teamIds, format === 'vuelta');
  }
  return base;
}

export const formatName = f =>
  f === 'ida' ? 'Todos contra todos' :
  f === 'vuelta' ? 'Ida y vuelta' : 'Grupos y llaves';
