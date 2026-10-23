/**
 * Dirt dropped on a kelp bed makes a dirt floor.
 *
 * Asked: "allow dropping dirt on a kelp tile to change it to a dirt tile". A
 * spadeful raised the corner and left the kelp where it was, because kelp was
 * not on the list of ground a spadeful buries (`BURYABLE`, the island's
 * `buryable`). This asks, of both sides, that dirt dropped at your feet and
 * dirt dropped on a corner each turn a kelp tile to dirt, under water.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { Game } from '../../src/game/game';
import { BURYABLE, TileType } from '../../src/world/tiles';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
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

/* ---- on the island --------------------------------------------------------------- */

const MIRA = '6e1b0000-0000-4000-8000-0000000000a1';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${MIRA}';
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Kelp', 168, 32, 5, 5, true) returning id into w;
  perform land_blank(w, 32);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  -- A shelf of sea floor, ten under the surface, with kelp on two of its tiles.
  for i in 8..15 loop for j in 8..13 loop perform land_set_height(w, i, j, -10); end loop; end loop;
  perform land_set_tile(w, 10, 10, ${TileType.Kelp});
  perform land_set_tile(w, 13, 10, ${TileType.Kelp});
  insert into said values ('WET', has_water(w, 10, 10)::text || ',' || has_water(w, 13, 10)::text);
  update player set body_at = now(), x = 10.5, y = 10.5, stats = '{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb where world_id = w and uid = u;
  perform give(w, u, 'dirt', 2, 20);
  -- At your feet.
  perform perform_terrain(w, u, 'drop_dirt_here', jsonb_build_object('kind', 'item', 'uid', null));
  insert into said values ('FEET', land_tile(w, 10, 10)::text);
  -- And on a corner of the other, from beside it.
  update player set body_at = now(), x = 12.5, y = 10.5 where world_id = w and uid = u;
  insert into said values ('ASK', coalesce(act_refusal(w, u, 'drop_dirt', jsonb_build_object('kind', 'tile', 'x', 13, 'y', 10, 'cx', 13, 'cy', 10)), 'none'));
  perform act_perform(w, u, 'drop_dirt', jsonb_build_object('kind', 'tile', 'x', 13, 'y', 10, 'cx', 13, 'cy', 10));
  insert into said values ('CORNER', land_tile(w, 13, 10)::text);
  insert into said values ('LISTED', exists (select 1 from buryable where tile = ${TileType.Kelp})::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

check('on the island, the kelp is under water', at('WET') === 'true,true', at('WET'));
check('the island lists kelp as ground a spadeful buries', at('LISTED') === 'true', at('LISTED'));
check('dirt dropped at your feet on kelp makes it dirt', at('FEET') === String(TileType.Dirt), `${at('FEET')}, dirt is ${TileType.Dirt}`);
check('and dirt dropped on its corner does the same', at('ASK') === 'none' && at('CORNER') === String(TileType.Dirt), `${at('ASK')} / ${at('CORNER')}`);

/* ---- in the browser ---------------------------------------------------------------- */

const game = Game.create(4246);
const [X, Y] = [60, 60];
for (let x = X - 2; x <= X + 6; x++) for (let y = Y - 2; y <= Y + 4; y++) game.world.setHeight(x, y, -10);
game.world.setTile(X, Y, TileType.Kelp);
game.world.setTile(X + 3, Y, TileType.Kelp);
for (const f of [...game.furniture.values()]) game.removeFurniture(f.id);
game.player.x = X + 0.5;
game.player.y = Y + 0.5;
const dirt = game.inventory.add('dirt', { ql: 20 });
game.inventory.add('dirt', { ql: 20 });
check('in the browser, kelp is ground a spadeful buries', BURYABLE.has(TileType.Kelp));
check('the kelp is under water', game.world.hasWater(X, Y) && game.world.hasWater(X + 3, Y));
const here = ACTION_BY_ID.get('drop_dirt_here');
const feet: Target = { kind: 'item', uid: dirt.uid };
check('dropping dirt at your feet over kelp is allowed', (here?.check?.(feet, game) ?? null) === null, String(here?.check?.(feet, game)));
here?.perform(feet, game);
check('and makes it dirt', game.world.getTile(X, Y) === TileType.Dirt, String(game.world.getTile(X, Y)));
game.player.x = X + 2.5;
const corner = { kind: 'tile', x: X + 3, y: Y, cx: X + 3, cy: Y } as Target;
const onCorner = ACTION_BY_ID.get('drop_dirt');
check('dropping dirt on a kelp tile\'s corner is allowed', (onCorner?.check?.(corner, game) ?? null) === null, String(onCorner?.check?.(corner, game)));
onCorner?.perform(corner, game);
check('and makes it dirt too', game.world.getTile(X + 3, Y) === TileType.Dirt, String(game.world.getTile(X + 3, Y)));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\ndirt on a kelp bed — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
