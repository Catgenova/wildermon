/**
 * Under a bridge, on foot, mounted, driving a large cart and driving a wagon: on the ground under its deck, through,
 * and out the other side, on both sides.
 *
 * Reported: "Still cant travel under bridges", driving a wagon with Monolithumps and a Wagonox. A deck is crossed on
 * from its ends; under it is the ground. But wheels were asked about the deck on every tile of it:
 *
 *   * the island refused a vehicle onto any tile a bridge covers whose deck does not carry it (`walk_share`,
 *     `deck_wheels`): under a rope bridge, under one lane of deck with a wagon, and under any bridge up a storey;
 *   * the browser took a step between two lanes of a wide deck for a step along it (`bridgeStep`), so a vehicle
 *     across under a bridge up a storey, two or three lanes wide, was refused as one driven on a walkway; and the
 *     ground floor under a storey bridge's end was refused as its end (`bridgeEndAt`);
 *   * and a vehicle on any tile of deck was drawn on the deck (`pieceOnDeck`), its driver under it.
 *
 * So, on three bridges each over its own sunken road walled in with trees -- one lane of marble over the road, a
 * rope bridge, and three lanes of marble at storey 4 -- this asks of each, on foot, mounted, in a large cart and in a
 * wagon:
 *
 *   * in the browser, a walk from the road north of the bridge to the road south of it is found, under the deck,
 *     on the ground every step (`movement`), and walked to its end on the ground, drawn under the deck on its way,
 *     wheels and all;
 *   * on the island, the same road walked a tile at a time through `rpc_move` ends on each tile on the ground;
 *
 * and that the deck is walked as before: on foot across each ground bridge from bank to bank, drawn on the deck; a
 * cart across the marble one, and not across the rope one; a wagon across neither.
 *
 * Its own island, rolled back after.
 */
import { Game } from '../../src/game/game';
import type { Bridge, BridgeKind } from '../../src/game/bridges';
import type { Creature } from '../../src/game/creatures';
import type { PathPoint } from '../../src/world/pathfinding';
import { WALL_HEIGHT } from '../../src/game/building';
import { TileType } from '../../src/world/tiles';
import { psql, ok, bad, check } from './harness';

/* ---- the ground ------------------------------------------------------------- */

const SIZE = 64;
/** The row each bridge runs along, east to west over its road. */
const Y = 32;
/** Rows the ground is laid out on: a ring of trees round them. */
const Y0 = Y - 12, Y1 = Y + 12;
const BANK = 40, ROAD = 10;
const UP = 3;
type Site = { name: string; kind: BridgeKind; rx: number; width: number; level: number };
/** Each bridge's road down the middle of three tiles, `rx`; its ends three tiles either side of it, on the banks. */
const SITES: Site[] = [
  { name: 'one lane of marble', kind: 'marble', rx: 11, width: 1, level: 0 },
  { name: 'a rope bridge', kind: 'rope', rx: 31, width: 1, level: 0 },
  { name: 'three lanes of marble at storey 4', kind: 'marble', rx: 51, width: 3, level: UP },
];
const lanesOf = (s: Site): number[] => (s.width >= 3 ? [-1, 0, 1] : [0]);
const spansOf = (s: Site): number[] => [-2, -1, 0, 1, 2].map((d) => s.rx + d);
const planOf = (s: Site, id: number): Bridge => ({
  id, kind: s.kind, ax: s.rx - 3, ay: Y, bx: s.rx + 3, by: Y, height: BANK + s.level * WALL_HEIGHT, level: s.level, width: s.width, side: 1, rise: 0,
  spans: spansOf(s).map((x) => ({ x, y: Y, needed: {}, total: {} })),
} as unknown as Bridge);
/** A corner's height: the road's three tiles low, their four corners; the banks high. */
const cornerHeight = (cx: number): number => (SITES.some((s) => cx >= s.rx - 1 && cx <= s.rx + 2) ? ROAD : BANK);
/** Trees: the ring round it all, and the road's sides, a tile of slope each, but under the deck. */
const treeAt = (x: number, y: number): boolean => {
  if (x <= 0 || x >= SIZE - 1 || y <= Y0 || y >= Y1) return true;
  return SITES.some((s) => (x === s.rx - 2 || x === s.rx + 2) && !lanesOf(s).some((o) => y === Y + o));
};

/** The road under each bridge, north of it to south of it. */
const ROUTE = (s: Site): Array<{ x: number; y: number }> => Array.from({ length: 13 }, (_, i) => ({ x: s.rx, y: Y - 6 + i }));
/** Across each ground bridge on its deck, from bank to bank. */
const ACROSS = (s: Site): Array<{ x: number; y: number }> => Array.from({ length: 11 }, (_, i) => ({ x: s.rx - 5 + i, y: Y }));

/* ---- the browser ------------------------------------------------------------ */

type Mode = 'foot' | 'mount' | 'cart' | 'wagon';
const MODES: Mode[] = ['foot', 'mount', 'cart', 'wagon'];
const SAID: Record<Mode, string> = { foot: 'on foot', mount: 'mounted', cart: 'in a large cart', wagon: 'in a wagon' };

const setup = (mode: Mode, at: { x: number; y: number }): Game => {
  const g = Game.create(5151, SIZE);
  for (let cy = Y0 - 1; cy <= Y1 + 2; cy++) for (let cx = 0; cx <= SIZE; cx++) g.world.setHeight(cx, cy, cornerHeight(cx));
  for (let y = Y0 - 1; y <= Y1 + 1; y++) for (let x = 0; x < SIZE; x++) g.world.setTile(x, y, treeAt(x, y) ? TileType.Tree : TileType.Grass, 0);
  for (const c of [...g.creatures.list.values()]) g.creatures.list.delete(c.id);
  for (const f of [...g.furniture.values()]) g.removeFurniture(f.id);
  SITES.forEach((s, i) => g.bridges.set(9200 + i, planOf(s, 9200 + i)));
  g.reindexDecks();
  g.player.x = at.x + 0.5;
  g.player.y = at.y + 0.5;
  g.player.level = 0;
  g.underDeck = false;
  const grown = g.time - 3600 * 24 * 60;
  const beast = (species: string): Creature => {
    const c = g.creatures.spawn(species, at.x + 0.5, at.y + 1.5, 'active', g.rand, grown);
    c.hunger = 1;
    c.traits = [];
    return c;
  };
  if (mode === 'mount') {
    const m = beast('orse');
    m.tacked = true;
    if (!g.mount(m)) throw new Error('no mount');
  } else if (mode === 'cart' || mode === 'wagon') {
    const v = g.addFurniture(mode === 'cart' ? 'large_cart' : 'wagon', at.x, at.y, 0, 0, 40, [], 'Pine');
    // A wagon behind Monolithumps and a Wagonox, as reported; a large cart behind a Cartling.
    const team = mode === 'wagon' ? [beast('quarra'), beast('quarra'), beast('quarra'), beast('roxxen')] : [beast('roxxen')];
    for (const c of team) if (!g.hitch(c, v)) throw new Error(`no ${c.species} in the traces`);
    v.driven = true;
  }
  return g;
};

const shown = (path: PathPoint[] | null | undefined): string => (path ?? []).map((s) => `${s.x},${s.y}${s.level ? `@${s.level}` : ''}`).join(' ');

/** A walk, as a click asks it (`moveTo`): what was planned, and where it ended after walking it, drawn under or on a deck. */
const walk = (mode: Mode, from: { x: number; y: number }, to: { x: number; y: number }) => {
  const g = setup(mode, from);
  const found = g.moveTo(to.x, to.y, false, true);
  const path = g.player.path ? [...g.player.path] : [];
  const deckDrawn: string[] = [];
  for (let i = 0; i < 1200 && g.player.path; i++) {
    g.update(1 / 20);
    const p = g.player;
    if (!g.onWalkedDeck(p.tileX, p.tileY)) continue;
    // And the wheels under the driver, drawn where the driver is (`pieceOnDeck`).
    const v = g.driving();
    const wheels = v && g.pieceOnDeck(v, p.tileX, p.tileY) === g.underNow() ? `, wheels ${g.underNow() ? 'on' : 'under'} it` : '';
    deckDrawn.push(`${g.underNow() ? 'under' : 'on'}${wheels}`);
  }
  const p = g.player;
  return { found, path, end: `${p.tileX},${p.tileY}@${p.level}`, drawn: [...new Set(deckDrawn)].join(','), g };
};

const browser = new Map<string, ReturnType<typeof walk>>();
for (const s of SITES) {
  const r = ROUTE(s);
  for (const mode of MODES) {
    const w = walk(mode, r[0], r[r.length - 1]);
    browser.set(`${s.name}|${mode}`, w);
    const under = w.path.some((t) => t.x === s.rx && t.y === Y);
    check(`in the browser ${SAID[mode]}, under ${s.name}: a walk down the road is found, under the deck, on the ground every step`,
      w.found && under && w.path.every((t) => t.level === 0), shown(w.path) || 'none');
    check(`  and walked to its end on the ground, drawn under the deck`, w.end === `${s.rx},${Y + 6}@0` && w.drawn === 'under',
      `ended ${w.end}, drawn ${w.drawn || 'nowhere on it'}`);
  }
}

// The decks themselves, as before.
for (const s of SITES.filter((x) => x.level === 0)) {
  const a = ACROSS(s);
  const foot = walk('foot', a[0], a[a.length - 1]);
  check(`in the browser on foot across ${s.name}, bank to bank: on the deck, on the ground storey, drawn on it`,
    foot.found && foot.end === `${a[a.length - 1].x},${Y}@0` && foot.drawn === 'on' && foot.path.every((t) => t.y === Y),
    `${shown(foot.path)}; ended ${foot.end}, drawn ${foot.drawn}`);
  const cart = walk('cart', a[0], a[a.length - 1]);
  const carried = s.kind !== 'rope';
  check(`in the browser a large cart ${carried ? 'is' : 'is not'} driven across ${s.name}`,
    carried ? cart.found && cart.end === `${a[a.length - 1].x},${Y}@0` : cart.end !== `${a[a.length - 1].x},${Y}@0`,
    `${shown(cart.path) || 'none'}; ended ${cart.end}`);
  const wagon = walk('wagon', a[0], a[a.length - 1]);
  check(`in the browser a wagon is not driven across ${s.name}: one lane`, wagon.end !== `${a[a.length - 1].x},${Y}@0`,
    `${shown(wagon.path) || 'none'}; ended ${wagon.end}`);
}

// And along the bank over the ground under the storey bridge's end, where a building's ground floor would be.
const endSite = SITES[2];
const BANKWAY = Array.from({ length: 9 }, (_, i) => ({ x: endSite.rx - 3, y: Y - 4 + i }));
for (const mode of ['cart', 'wagon'] as Mode[]) {
  const w = walk(mode, BANKWAY[0], BANKWAY[BANKWAY.length - 1]);
  check(`in the browser ${SAID[mode]}, along the bank under the end of ${endSite.name}: straight on, on the ground`,
    w.found && w.path.every((t) => t.x === endSite.rx - 3 && t.level === 0) && w.end === `${endSite.rx - 3},${Y + 4}@0`,
    `${shown(w.path) || 'none'}; ended ${w.end}`);
}

/* ---- the island ------------------------------------------------------------- */

const U = '7e5b0000-0000-4000-8000-0000000b41d6';
/** Every word to `rpc_move` down a way, a tile at a time, and where each left the body: `storey@x,y`. */
const moves = (k: string, way: Array<{ x: number; y: number }>): string => `
  update player set x = ${way[0].x + 0.5}, y = ${way[0].y + 0.5}, level = 0, body_at = now() - interval '1 minute',
         moved_at = now() - interval '1 minute', act = null, act_queue = '[]'::jsonb where world_id = w and uid = u;
  update placed set x = ${way[0].x}, y = ${way[0].y}, cx = ${way[0].x + 0.5}, cy = ${way[0].y + 0.5} where world_id = w and driver = u;
  update creature set from_x = ${way[0].x + 0.5}, from_y = ${way[0].y + 1.5},
         to_x = ${way[0].x + 0.5}, to_y = ${way[0].y + 1.5} where world_id = w and (rider = u or hitched_to in (select id from placed where world_id = w and driver = u));`
  + way.slice(1).map((t, i) => `
  update player set moved_at = now() - interval '1 minute', body_at = now() - interval '1 minute' where world_id = w and uid = u;
  delete from caller where uid = u;
  perform rpc_move(w, ${t.x + 0.5}, ${t.y + 0.5}, 0);
  insert into said values ('${k}:${i}', (select level || '@' || floor(x) || ',' || floor(y) from player where world_id = w and uid = u));`).join('');
/** Up on a saddled Thistlekit, or on the seat of a large cart behind a Cartling, or a wagon behind three Monolithumps and a Wagonox. */
const mode = (m: Mode): string => {
  const off = `update creature set rider = null where world_id = w and rider = u;
  delete from creature where world_id = w and keeper = u;
  delete from placed where world_id = w and driver = u;`;
  if (m === 'foot') return off;
  if (m === 'mount') {
    return `${off}
  v_m := creature_spawn(w, 'orse', 1.5, 1.5, 'active', now() - interval '60 days', u);
  update creature set rider = u, tacked = true, hunger = 1, traits = '{}' where world_id = w and id = v_m;`;
  }
  const team = m === 'wagon' ? ['quarra', 'quarra', 'quarra', 'roxxen'] : ['roxxen'];
  return `${off}
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql, driver) values (w, 'furniture', '${m === 'wagon' ? 'wagon' : 'large_cart'}', 1, 1, 1.5, 1.5, 50, u)
    returning id into v_v;
  ${team.map((sp) => `v_m := creature_spawn(w, '${sp}', 1.5, 2.5, 'active', now() - interval '60 days', u);
  update creature set hitched_to = v_v, hunger = 1, traits = '{}' where world_id = w and id = v_m;`).join('\n  ')}`;
};

const walks: Array<{ k: string; mode: Mode; way: Array<{ x: number; y: number }> }> = [];
SITES.forEach((s, i) => MODES.forEach((m) => walks.push({ k: `UNDER${i}${m}`, mode: m, way: ROUTE(s) })));
SITES.forEach((s, i) => {
  if (s.level) return;
  for (const m of ['foot', 'cart', 'wagon'] as Mode[]) walks.push({ k: `ACROSS${i}${m}`, mode: m, way: ACROSS(s) });
});
for (const m of ['cart', 'wagon'] as Mode[]) walks.push({ k: `BANK${m}`, mode: m, way: BANKWAY });

const corners: string[] = [];
for (let cy = Y0 - 1; cy <= Y1 + 2; cy++) for (let cx = 0; cx <= SIZE; cx++) if (cornerHeight(cx) !== 0) corners.push(`(${cx}, ${cy}, ${cornerHeight(cx)})`);
const trees: string[] = [];
for (let y = Y0 - 1; y <= Y1 + 1; y++) for (let x = 0; x < SIZE; x++) if (treeAt(x, y)) trees.push(`(${x}, ${y})`);
const out = psql(`begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v_b bigint; v_m int; v_v bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Under the Bridge', 5151, ${SIZE}, 4, ${Y}, true) returning id into w;
  perform land_blank(w, ${SIZE});
  perform land_set_height(w, c.x, c.y, c.h) from (values ${corners.join(', ')}) c(x, y, h);
  perform land_set_tile(w, t.x, t.y, tile_id('Tree')) from (values ${trees.join(', ')}) t(x, y);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Underpass');
  update player set x = 4.5, y = ${Y + 0.5}, level = 0, body_at = now(), swim_at = now(), seen_at = now() where world_id = w and uid = u;
  ${SITES.map((s) => `insert into bridge (world_id, kind, ax, ay, bx, by, height, made_by, level, width, side, rise)
    values (w, '${s.kind}', ${s.rx - 3}, ${Y}, ${s.rx + 3}, ${Y}, ${BANK + s.level * WALL_HEIGHT}, u, ${s.level}, ${s.width}, 1, 0) returning id into v_b;
  insert into bridge_span (world_id, bridge, n, x, y, needed, total)
    select w, v_b, i + 1, x, ${Y}, '{}', '{}' from unnest(array[${spansOf(s).join(', ')}]) with ordinality s(x, i);`).join('\n  ')}
  ${walks.map((wk) => `-- ${wk.k}
  ${mode(wk.mode)}
  ${moves(wk.k, wk.way)}`).join('\n')}
end $t$;
select k || '|' || v from said;
rollback;`);
const said = new Map(out.split('\n').filter((l) => l.includes('|')).map((l) => [l.slice(0, l.indexOf('|')), l.slice(l.indexOf('|') + 1)]));
const answered = (k: string, way: Array<{ x: number; y: number }>): string[] => way.slice(1).map((_, i) => said.get(`${k}:${i}`) ?? '-');
const wanted = (way: Array<{ x: number; y: number }>): string[] => way.slice(1).map((t) => `0@${t.x},${t.y}`);
const islandWalk = (k: string): { got: string; want: string } => {
  const wk = walks.find((x) => x.k === k)!;
  return { got: answered(k, wk.way).join(' '), want: wanted(wk.way).join(' ') };
};

SITES.forEach((s, i) => {
  for (const m of MODES) {
    const { got, want } = islandWalk(`UNDER${i}${m}`);
    check(`on the island ${SAID[m]}, under ${s.name}: every word down the road leaves the body on its tile on the ground (\`rpc_move\`)`,
      got === want, got);
  }
});
SITES.forEach((s, i) => {
  if (s.level) return;
  const foot = islandWalk(`ACROSS${i}foot`);
  check(`on the island on foot across ${s.name}, bank to bank, on the deck every word`, foot.got === foot.want, foot.got);
  const cart = islandWalk(`ACROSS${i}cart`);
  const lastCart = cart.got.split(' ').pop();
  if (s.kind === 'rope') check(`on the island a large cart is held on the bank at ${s.name}`, lastCart === `0@${s.rx - 4},${Y}`, cart.got);
  else check(`on the island a large cart is driven across ${s.name}`, cart.got === cart.want, cart.got);
  const wagon = islandWalk(`ACROSS${i}wagon`);
  check(`on the island a wagon is held on the bank at ${s.name}: one lane`, wagon.got.split(' ').pop() === `0@${s.rx - 4},${Y}`, wagon.got);
});
for (const m of ['cart', 'wagon'] as Mode[]) {
  const { got, want } = islandWalk(`BANK${m}`);
  check(`on the island ${SAID[m]}, along the bank under the end of ${endSite.name}: every word on its tile on the ground`, got === want, got);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`under a bridge on foot, mounted and on wheels, on both sides — ${ok.length} of ${ok.length}`);
