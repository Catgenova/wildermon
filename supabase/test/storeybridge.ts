/**
 * A bridge up a storey is walked across on its storey and under on the ground, every lane of it, on both sides.
 *
 * Reported: "Bridge is completed, but walking on it is bugged. Impossible to walk on or under, seems to be an odd
 * mixture of the two." Asked: "Tie the movement on the bridge made on a storey to the storey movement", "Ensure players
 * can walk across and under fluidly". A marble bridge three lanes wide, both ends on storey 4 of the same building.
 *
 *   * Up a storey a body stands only where something is under it at that storey. The island counted a bridge's middle
 *     lane and its two end tiles (`frame_stands`); the browser every lane (`standsUp`). On an outer lane the island let
 *     you down to the ground and the browser kept you on the deck.
 *   * Under or on: the browser went by how you stepped onto a tile of deck (`underAfter`), so walking in on the ground
 *     floor from under the end of a deck up a storey drew you on the deck while you walked the ground.
 *   * A pinned storey's click on its deck walked to the floor beside it: only a building's floor was somewhere to stop
 *     (`standable`).
 *
 * So this asks, of the same bridge on both sides:
 *
 *   * at storey 4 every lane's end, deck and far end holds a body, and storey 3 holds nobody there;
 *   * a walk at storey 4 from each lane's end along it and off the far end stays on storey 4, every step;
 *   * a walk on the ground in under the deck from its end, along it and out the side is on the ground, and drawn under it;
 *   * the browser draws a body on storey 4 on the deck, and one on the ground under it, whichever way it came;
 *   * and a click on the deck with storey 4 pinned ends a walk on the deck.
 *
 * Runs against the database the suite leaves behind: Faraway, and Ivar on it.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { deckTiles, endTiles, type Bridge } from '../../src/game/bridges';
import { TileType } from '../../src/world/tiles';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wurm',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

/** Storey 4, as the island and the browser count storeys: the ground is nought. */
const UP = 3;
const AX = 30, BX = 36, Y = 40, HEIGHT = 100;
const SPANS = Array.from({ length: BX - AX - 1 }, (_, i) => AX + 1 + i);
const plan = {
  id: 9100, kind: 'marble', ax: AX, ay: Y, bx: BX, by: Y, height: HEIGHT, level: UP, width: 3, side: 1, rise: 0,
  spans: SPANS.map((x) => ({ x, y: Y, needed: {}, total: {} })),
} as unknown as Bridge;
/** Every lane's walk at storey 4: its end, along its deck, off its far end. */
const lanes = [-1, 0, 1].map((o) => [{ x: AX, y: Y + o }, ...SPANS.map((x) => ({ x, y: Y + o })), { x: BX, y: Y + o }]);
/** On the ground: in from beside the end, under the deck along the middle lane, and out the side. */
const under = [{ x: AX - 1, y: Y }, { x: AX, y: Y }, ...SPANS.map((x) => ({ x, y: Y })), { x: BX - 1, y: Y + 2 }];
/** The tiles asked whether they hold a body: the bridge and a tile round it. */
const box: Array<{ x: number; y: number }> = [];
for (let y = Y - 2; y <= Y + 2; y++) for (let x = AX - 1; x <= BX + 1; x++) box.push({ x, y });
const covered = new Set([...deckTiles(plan), ...endTiles(plan)].map((t) => `${t.x},${t.y}`));

/* ---- the browser ------------------------------------------------------------ */

const g = Game.create(4242);
for (let y = Y - 4; y <= Y + 5; y++) {
  for (let x = AX - 4; x <= BX + 5; x++) {
    g.world.setHeight(x, y, 10);
    if (g.world.inBounds(x, y)) g.world.setTile(x, y, TileType.Grass, 0);
  }
}
g.bridges.set(plan.id, plan);
g.reindexDecks();
const holds = (l: number): string => box.filter((t) => g.footing(t.x, t.y, l) === l).map((t) => `${t.x},${t.y}`).sort().join(' ');
const walk = (path: Array<{ x: number; y: number }>, level: number): string => {
  const out: Array<number | null> = [];
  let l: number | null = level;
  for (let i = 1; i < path.length && l !== null; i++) {
    l = g.stepRule(path[i - 1].x, path[i - 1].y, l, path[i].x, path[i].y);
    out.push(l);
  }
  return out.join(',');
};
const upWalks = lanes.map((p) => walk(p, UP));
const groundWalk = walk(under, 0);
/** Under or on, a step at a time down a path at a storey, as the player's own `underDeck` is kept. */
const drawn = (path: Array<{ x: number; y: number }>, level: number): string => {
  g.player.level = level;
  g.underDeck = false;
  const out: string[] = [];
  for (let i = 1; i < path.length; i++) {
    g.underDeck = g.underAfter(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y, g.underDeck, level);
    g.player.x = path[i].x + 0.5;
    g.player.y = path[i].y + 0.5;
    if (g.onWalkedDeck(path[i].x, path[i].y)) out.push(g.underNow() ? 'under' : 'on');
  }
  return [...new Set(out)].join(',');
};
const drawnUp = lanes.map((p) => drawn(p, UP));
const drawnUnder = drawn(under, 0);
// And put down on a tile of deck on the ground floor, with nothing said of how it got there: under it.
g.player.level = 0;
g.underDeck = false;
g.player.x = SPANS[2] + 0.5;
g.player.y = Y + 1.5;
const putDown = g.underNow();
const walkEnd = (g as unknown as { walkEnd(x: number, y: number, l: number): boolean }).walkEnd.bind(g);
const clickEnds = lanes.flat().filter((t) => !walkEnd(t.x, t.y, UP)).map((t) => `${t.x},${t.y}`);

check('in the browser: at storey 4 every lane\'s ends and deck hold a body, and nothing else round it',
  holds(UP) === [...covered].sort().join(' '), holds(UP));
check('and storey 3 holds nobody there', holds(UP - 1) === '', holds(UP - 1));
check('a walk at storey 4 along each lane, end to end, stays on storey 4 every step',
  upWalks.every((w) => w.split(',').every((l) => l === String(UP))), upWalks.join(' / '));
check('a walk on the ground in from beside the end, under the deck and out the side is on the ground every step',
  groundWalk.split(',').every((l) => l === '0'), groundWalk);
check('drawn on the deck walking it at storey 4, every lane', drawnUp.every((d) => d === 'on'), drawnUp.join(' / '));
check('drawn under it walking under it on the ground, in from under its end', drawnUnder === 'under', drawnUnder);
check('and under it put down on a tile of it on the ground, however it got there', putDown);
check('with storey 4 pinned, a click on any tile of the deck ends a walk on the deck', clickEnds.length === 0, clickEnds.join(' '));

/* ---- the island ------------------------------------------------------------- */

const W = `(select id from world where name = 'Faraway')`;
const IVAR = `(select uid from player where world_id = ${W} and name = 'Ivar')`;
/** The tiles of the box that hold a body at a storey on the island (`frame_stands`), as the browser lists them. */
const holdsSql = (l: number): string => `select string_agg(t.x || ',' || t.y, ' ' order by t.x || ',' || t.y)
  from (values ${box.map((t) => `(${t.x}, ${t.y})`).join(', ')}) t(x, y) where frame_stands(w, t.x, t.y, ${l})`;
const out = psql(`begin;
create temp table said (k text, v text);
do $$
declare w uuid := ${W}; u uuid := ${IVAR}; v_b bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  insert into bridge (world_id, kind, ax, ay, bx, by, height, made_by, level, width, side, rise)
    values (w, 'marble', ${AX}, ${Y}, ${BX}, ${Y}, ${HEIGHT}, u, ${UP}, 3, 1, 0) returning id into v_b;
  insert into bridge_span (world_id, bridge, n, x, y, needed, total)
    select w, v_b, i + 1, x, ${Y}, '{}', '{}' from unnest(array[${SPANS.join(', ')}]) with ordinality s(x, i);
  insert into said select 'HOLDS', coalesce((${holdsSql(UP)}), '');
  insert into said select 'HOLDS_BELOW', coalesce((${holdsSql(UP - 1)}), '');
  ${lanes.map((p, k) => `
  update player set x = ${p[0].x + 0.5}, y = ${p[0].y + 0.5}, level = ${UP}, body_at = now() - interval '1 minute',
         moved_at = now() - interval '1 minute', act = null, act_queue = '[]'::jsonb where world_id = w and uid = u;`
  + p.slice(1).map((t, i) => `
  update player set moved_at = now() - interval '1 minute', body_at = now() - interval '1 minute' where world_id = w and uid = u;
  perform rpc_move(w, ${t.x + 0.5}, ${t.y + 0.5}, ${UP});
  insert into said values ('MOVE${k}:${i}', (select level || '@' || floor(x) || ',' || floor(y) from player where world_id = w and uid = u));`).join('')).join('\n')}
end $$;
select k || '|' || v from said;
rollback;`);
const said = new Map(out.split('\n').filter((l) => l.includes('|')).map((l) => [l.slice(0, l.indexOf('|')), l.slice(l.indexOf('|') + 1)]));
const islandMoves = lanes.map((p, k) => p.slice(1).map((_, i) => said.get(`MOVE${k}:${i}`) ?? '-').join(' '));
const wanted = lanes.map((p) => p.slice(1).map((t) => `${UP}@${t.x},${t.y}`).join(' '));

check('on the island: at storey 4 the same tiles hold a body, every lane\'s ends and deck', said.get('HOLDS') === [...covered].sort().join(' '),
  `island ${said.get('HOLDS')}`);
check('and storey 3 holds nobody there', (said.get('HOLDS_BELOW') ?? '') === '', said.get('HOLDS_BELOW'));
check('a walk at storey 4 along each lane, end to end, is let through on storey 4 every step (`rpc_move`)',
  islandMoves.every((m, k) => m === wanted[k]), islandMoves.join(' / '));

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a bridge up a storey is walked across and under, every lane, on both sides — ${ok.length} of ${ok.length}`);
