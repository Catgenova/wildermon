/**
 * A poured slab is floor, for everything on it.
 *
 * Reported: "foundations not behaving as expected: i appear properly on top
 * of the foundation if i step onto it, but while riding a wagon i adhere to
 * the ground. attempting to place an altar on the foundation places it on the
 * ground underneath." And: "it would appear the water takes precedence and i
 * swim through the foundation while on foot."
 *
 *   * a wagon, its driver and anything set down on a slab are drawn on its
 *     top, as a body on foot already was, and so are others on it and their
 *     creatures (`standTop`, `footAt`);
 *   * a body on a slab poured in the sea is not swimming, in the browser
 *     (`Game.onFloor`) or on the island (`in_deep_water`);
 *   * and a slab still being poured, or one with a pool dug in it, is not
 *     floor: the water is.
 *
 * Runs against the database the suite leaves behind, in a transaction it
 * rolls back: Hoarding.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { Renderer } from '../../src/render/renderer';

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

/* ---- the browser ---- */
const SEA = -20;
const TOP = 5;
const TX = 60, TY = 60;
const game = Game.create(4242);
const w = game.world;
// A run of open sea three tiles long: a slab poured in the middle one, the sea either side.
for (let y = TY - 1; y <= TY + 2; y++) for (let x = TX - 2; x <= TX + 3; x++) w.setHeight(x, y, SEA);
const slab = game.addFoundation(TX, TY, TOP, 0);
// Drawn as the renderer draws: its own height rules, asked of this game.
const draw = Object.create(Renderer.prototype) as Record<string, (...a: unknown[]) => number> & { game: Game };
draw.game = game;
const mid = [TX + 0.5, TY + 0.5] as const;

check('a wagon on the slab, and its driver on the box, drawn on its top', draw.pieceBase({ kind: 'wagon' }, ...mid) === TOP, `${draw.pieceBase({ kind: 'wagon' }, ...mid)}`);
check('an altar set down on it, on its top', draw.pieceBase({ kind: 'altar' }, ...mid) === TOP, `${draw.pieceBase({ kind: 'altar' }, ...mid)}`);
check('somebody else and a creature standing on it, on its top', draw.footAt(...mid) === TOP, `${draw.footAt(...mid)}`);
check('and the sea beside it is the sea', draw.pieceBase({ kind: 'altar' }, TX - 0.5, TY + 0.5) < TOP);

const p = game.player;
const swims = (x: number): boolean => {
  p.x = x + 0.5; p.y = TY + 0.5; p.path = null;
  p.update(0.016, w, undefined, game.onFloor);
  return p.swimming;
};
check('on foot on the slab, standing and not swimming; in the sea beside it, swimming', !swims(TX) && swims(TX - 1), `slab ${swims(TX)}, sea ${swims(TX - 1)}`);
slab.pool = true;
const pool = swims(TX);
slab.pool = false;
slab.needed = { concrete: 10 };
const shuttered = swims(TX);
check('a pool dug in it, or a slab not yet poured, is water', pool && shuttered, `pool ${pool}, shuttered ${shuttered}`);
slab.needed = {};

/* ---- the island ---- */
const out = psql(`
begin;
create temp table said (k text, v text) on commit drop;
do $$
declare w uuid; u uuid; tx int; ty int;
begin
  select id into w from world where name = 'Hoarding';
  select uid into u from player where world_id = w order by uid limit 1;
  select size - 8, size - 8 into tx, ty from world where id = w;
  for i in -1..2 loop for j in -1..2 loop perform land_set_height(w, tx + i, ty + j, ${SEA}); end loop; end loop;
  update player set x = tx + 0.5, y = ty + 0.5, level = 0, aboard = null where world_id = w and uid = u;
  update placed set driver = null where world_id = w and driver = u;
  update creature set rider = null where world_id = w and rider = u;
  insert into said values ('sea', in_deep_water(w, u)::text);
  delete from foundation where world_id = w and x = tx and y = ty;
  insert into foundation (world_id, id, x, y, top, needed, total)
    values (w, 990001, tx, ty, ${TOP}, '{"concrete":0}', '{"concrete":40}');
  insert into said values ('slab', in_deep_water(w, u)::text);
  update foundation set needed = '{"concrete":10}' where world_id = w and id = 990001;
  insert into said values ('shuttered', in_deep_water(w, u)::text);
  update foundation set needed = '{"concrete":0}', pool = true where world_id = w and id = 990001;
  insert into said values ('pool', in_deep_water(w, u)::text);
end $$;
select string_agg(k || '=' || coalesce(v, 'null'), E'\\n' order by k) from said;
rollback;`);
const island = (k: string): string => out.split('\n').find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1) ?? 'unsaid';

check('on the island, in the open sea: swimming', island('sea') === 'true', island('sea'));
check('and on a slab poured in it: not', island('slab') === 'false', island('slab'));
check('a slab not yet poured, or with a pool dug in it, is water there too',
  island('shuttered') === 'true' && island('pool') === 'true', `shuttered ${island('shuttered')}, pool ${island('pool')}`);

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`a slab is floor for everything on it — ${ok.length} of ${ok.length}`);
