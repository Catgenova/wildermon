/**
 * Change tile lays what was dropped.
 *
 * Reported: "drop dirt" left dirt whatever was dropped; clay or sand on dirt
 * stayed dirt. Asks of both sides that Change tile, at a corner and at your
 * feet, lays clay, sand or dirt as dropped, dirt under it included, and that
 * both are named Change tile.
 *
 * Runs against the database the suite leaves behind, in one transaction that
 * is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { Game } from '../../src/game/game';
import { TileType } from '../../src/world/tiles';

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

const ODA = '6e1b0000-0000-4000-8000-0000000000c7';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${ODA}'; clay bigint; sand bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Tiles', 169, 32, 5, 5, true) returning id into w;
  perform land_blank(w, 32);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Oda');
  for i in 4..28 loop for j in 4..20 loop perform land_set_height(w, i, j, 20); perform land_set_tile(w, i, j, ${TileType.Dirt}); end loop; end loop;
  perform land_set_tile(w, 20, 10, ${TileType.Clay});
  update player set body_at = now(), x = 10.5, y = 10.5, stats = '{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb where world_id = w and uid = u;
  perform give(w, u, 'dirt', 2, 20);
  perform give(w, u, 'clay', 2, 20);
  perform give(w, u, 'sand', 2, 20);
  select id into clay from item where world_id = w and holder_uid = u and def = 'clay' limit 1;
  select id into sand from item where world_id = w and holder_uid = u and def = 'sand' limit 1;
  insert into said values ('LABELS', (select string_agg(label, ',' order by id) from action_def where id in ('drop_dirt', 'drop_dirt_here')));
  -- Clay at your feet, on dirt.
  insert into said values ('FEET_ASK', coalesce(act_refusal(w, u, 'drop_dirt_here', jsonb_build_object('kind', 'item', 'uid', clay)), 'none'));
  perform perform_terrain(w, u, 'drop_dirt_here', jsonb_build_object('kind', 'item', 'uid', clay));
  insert into said values ('FEET', land_tile(w, 10, 10)::text);
  -- Sand on a corner of dirt.
  update player set body_at = now(), x = 14.5, y = 10.5 where world_id = w and uid = u;
  insert into said values ('SAND_ASK', coalesce(act_refusal(w, u, 'drop_dirt', jsonb_build_object('kind', 'tile', 'x', 15, 'y', 10, 'cx', 15, 'cy', 10, 'itemUid', sand)), 'none'));
  perform act_perform(w, u, 'drop_dirt', jsonb_build_object('kind', 'tile', 'x', 15, 'y', 10, 'cx', 15, 'cy', 10, 'itemUid', sand));
  insert into said values ('SAND', land_tile(w, 15, 10)::text);
  -- Dirt on a corner of clay.
  update player set body_at = now(), x = 19.5, y = 10.5 where world_id = w and uid = u;
  perform act_perform(w, u, 'drop_dirt', jsonb_build_object('kind', 'tile', 'x', 20, 'y', 10, 'cx', 20, 'cy', 10,
    'itemUid', (select id from item where world_id = w and holder_uid = u and def = 'dirt' limit 1)));
  insert into said values ('DIRT', land_tile(w, 20, 10)::text);
  -- Nothing to drop.
  delete from item where world_id = w and holder_uid = u and def in ('dirt', 'clay', 'sand');
  insert into said values ('NONE', coalesce(act_refusal(w, u, 'drop_dirt_here', jsonb_build_object('kind', 'item', 'uid', null)), 'none'));
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

check('on the island, both are named Change tile', at('LABELS') === 'Change tile,Change tile', at('LABELS'));
check('clay at your feet on dirt is allowed', at('FEET_ASK') === 'none', at('FEET_ASK'));
check('and lays clay', at('FEET') === String(TileType.Clay), `${at('FEET')}, clay is ${TileType.Clay}`);
check('sand on a corner of dirt is allowed', at('SAND_ASK') === 'none', at('SAND_ASK'));
check('and lays sand', at('SAND') === String(TileType.Sand), `${at('SAND')}, sand is ${TileType.Sand}`);
check('dirt on a corner of clay lays dirt', at('DIRT') === String(TileType.Dirt), at('DIRT'));
check('nothing to drop is refused', at('NONE') === 'Need dirt, clay or sand.', at('NONE'));

/* ---- in the browser ---------------------------------------------------------------- */

const game = Game.create(4247);
const [X, Y] = [60, 60];
for (let x = X - 2; x <= X + 14; x++) for (let y = Y - 2; y <= Y + 4; y++) { game.world.setHeight(x, y, 20); game.world.setTile(x, y, TileType.Dirt); }
game.world.setTile(X + 10, Y, TileType.Clay);
for (const f of [...game.furniture.values()]) game.removeFurniture(f.id);
game.player.x = X + 0.5;
game.player.y = Y + 0.5;
const dirt = game.inventory.add('dirt', { ql: 20 });
const clay = game.inventory.add('clay', { ql: 20 });
const sand = game.inventory.add('sand', { ql: 20 });
const here = ACTION_BY_ID.get('drop_dirt_here')!;
const onCorner = ACTION_BY_ID.get('drop_dirt')!;
check('in the browser, both are named Change tile', here.label === 'Change tile' && onCorner.label === 'Change tile', `${here.label} / ${onCorner.label}`);
const feet: Target = { kind: 'item', uid: clay.uid };
check('clay at your feet on dirt is allowed', (here.check?.(feet, game) ?? null) === null, String(here.check?.(feet, game)));
here.perform(feet, game);
check('and lays clay', game.world.getTile(X, Y) === TileType.Clay, String(game.world.getTile(X, Y)));
game.player.x = X + 4.5;
const sandAt = { kind: 'tile', x: X + 5, y: Y, cx: X + 5, cy: Y, itemUid: sand.uid } as Target;
check('sand on a corner of dirt is allowed', (onCorner.check?.(sandAt, game) ?? null) === null, String(onCorner.check?.(sandAt, game)));
onCorner.perform(sandAt, game);
check('and lays sand', game.world.getTile(X + 5, Y) === TileType.Sand, String(game.world.getTile(X + 5, Y)));
game.player.x = X + 9.5;
const dirtAt = { kind: 'tile', x: X + 10, y: Y, cx: X + 10, cy: Y, itemUid: dirt.uid } as Target;
onCorner.perform(dirtAt, game);
check('dirt on a corner of clay lays dirt', game.world.getTile(X + 10, Y) === TileType.Dirt, String(game.world.getTile(X + 10, Y)));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nchange tile — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
