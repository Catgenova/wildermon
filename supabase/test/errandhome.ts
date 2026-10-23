/**
 * An errand worker set to work far from the token walks back to it.
 *
 * Reported: "I had sent a Tinka home to work on the deed from about 300 tiles away, but it didnt move and I couldn't
 * select it". A Tinka mends, an errand trade (`worker_errand`), and one with nothing to mend stood where it was told,
 * for ever. Asked of the island: a Tinka three hundred tiles from its keeper's token, assigned there, with nothing to
 * mend, walks back to its ground a short leg at a time, so that a player beside it on the way is told of it, and
 * its keeper can still act on the wild thing beside it. And of the browser: the same Tinka, a hundred and fifty tiles off, gets home.
 *
 * The island half makes its own island and rolls it back.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { TileType } from '../../src/world/tiles';
import { HOME_LEG, HOME_SLACK, SPECIES } from '../../src/game/creatures';
import { CREATURE_ACTION_BY_ID } from '../../src/game/creatureActions';

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

const TOKEN = [16, 16] as const;
const FAR = 300;

/* ---- the island ---------------------------------------------------------- */

const U = '7e5b0000-0000-4000-8000-000000000e01';
const isle = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v_id int; v_other int; j jsonb; i int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Farwork', 182, 400, ${TOKEN[0]}, ${TOKEN[1]}, true) returning id into w;
  perform land_blank(w, 400);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 399) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Herder');
  update player set x = ${TOKEN[0] + FAR} + 0.5, y = ${TOKEN[1]} + 0.5, body_at = now(), swim_at = now() where world_id = w and uid = u;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Farstead', ${TOKEN[0]}, ${TOKEN[1]}, 10, 3, u);
  v_id := creature_spawn(w, 'tinka', ${TOKEN[0] + FAR} + 1.5, ${TOKEN[1]} + 0.5, 'active', now() - interval '60 days', u);
  v_other := creature_spawn(w, 'rabba', ${TOKEN[0] + FAR} + 2.5, ${TOKEN[1]} + 1.5, 'wild', now() - interval '60 days', null);
  j := rpc_act(w, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', v_id));
  insert into said values ('ASSIGN', coalesce(j->>'done', 'null'));
  insert into said values ('RULE', home_leg() || '|' || home_slack());
  -- A minute after, as the tick would find it: a minute's walk.
  update creature set until = now() - interval '60 seconds', settled_at = now() - interval '60 seconds',
         leg_at = now() - interval '60 seconds', leg_ends = now() - interval '60 seconds'
   where world_id = w and id = v_id;
  perform worker_settle(w, v_id);
  insert into said select 'MINUTE', to_x || '|' || to_y || '|' || sqrt((to_x - from_x) ^ 2 + (to_y - from_y) ^ 2)
    from creature where world_id = w and id = v_id;
  -- Somebody standing where it has got to is told of it, as of anything walking (rpc_creatures, leg_slack).
  update player p set x = creature_x(c), y = creature_y(c) + 1 from creature c where p.world_id = w and p.uid = u and c.world_id = w and c.id = v_id;
  insert into said values ('LIST', (select string_agg(e->>'id', ',' order by (e->>'id')::int) from jsonb_array_elements(rpc_creatures(w, 40)) e
     where (e->>'id')::int = v_id));
  insert into said values ('ME', v_id::text);
  update player set body_at = now(), x = ${TOKEN[0] + FAR} + 0.5, y = ${TOKEN[1]} + 0.5 where world_id = w and uid = u;
  -- And the rest of the way, as the ticks would find it, a few minutes at a time.
  for i in 1..8 loop
    update creature set until = now() - interval '120 seconds', leg_at = now() - interval '121 seconds', leg_ends = now() - interval '120 seconds',
           from_x = to_x, from_y = to_y
     where world_id = w and id = v_id;
    perform worker_settle(w, v_id);
  end loop;
  insert into said select 'HOME', mode || '|' || to_x || '|' || to_y || '|' || work_range(c) from creature c where world_id = w and id = v_id;
  j := rpc_act(w, 'examine_creature', jsonb_build_object('kind', 'creature', 'id', v_other));
  insert into said values ('EXAMINE', coalesce(j->>'done', 'null'));
end $t$;
select k || '=' || v from said;
rollback;
`);
const said = new Map(isle.split('\n').filter((l) => l.includes('=')).map((l) => l.split('=') as [string, string]));
check('the island walks a worker home by the numbers the browser says', said.get('RULE') === `${HOME_LEG}|${HOME_SLACK}`, said.get('RULE'));
check('on the island: a Tinka three hundred tiles off is assigned to the settlement', said.get('ASSIGN') === 'true', said.get('ASSIGN'));
{
  const [mx, my, leg] = (said.get('MINUTE') ?? '').split('|').map(Number);
  check('with nothing to mend it sets out for the token, a short leg at a time', mx < TOKEN[0] + FAR && leg <= HOME_LEG + 0.01 && Math.abs(my - TOKEN[1] - 0.5) < 3,
    said.get('MINUTE'));
  const [mode, hx, hy, range] = (said.get('HOME') ?? '').split('|');
  const home = Math.hypot(Number(hx) - TOKEN[0] - 0.5, Number(hy) - TOKEN[1] - 0.5);
  check('and gets back to its ground, to within three tiles of the token', mode === 'deed' && home <= 3 * Math.SQRT2 + 0.01, `${home.toFixed(1)} tiles from the token, range ${range}`);
}
check('on its way, a player beside it is told of it', said.get('LIST') === said.get('ME'), `${said.get('LIST')} against ${said.get('ME')}`);
check('and its keeper can still act on the wild one', said.get('EXAMINE') === 'true', said.get('EXAMINE'));

/* ---- the browser --------------------------------------------------------- */

const g = Game.create(4243);
const [hx, hy] = [40, 40];
const far = 150;
for (let y = hy - 3; y <= hy + 3; y++) for (let x = hx - 3; x <= hx + far + 3; x++) { g.world.setHeight(x, y, 4); g.world.setTile(x, y, TileType.Grass, 0); }
for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
g.deed = { name: 'Farstead', x: hx, y: hy, radius: 10, level: 3 };
g.player.x = hx + far + 0.5;
g.player.y = hy + 0.5;
const tinka = g.creatures.spawn('tinka', hx + far + 1.5, hy + 0.5, 'active');
CREATURE_ACTION_BY_ID.get('assign_deed')!.perform({ kind: 'creature', id: tinka.id }, g);
for (let i = 0; i < 20 * 600; i++) {
  g.player.stats.stamina = 1;
  tinka.hunger = 1;
  g.update(0.05);
}
const left = Math.hypot(tinka.x - hx - 0.5, tinka.y - hy - 0.5);
check('in the browser: one assigned a hundred and fifty tiles off is home inside ten minutes', tinka.mode === 'deed' && left <= SPECIES.tinka.workRange + 4,
  `${tinka.mode}, ${left.toFixed(1)} tiles from the token`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nan errand worker sent home walks there — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
