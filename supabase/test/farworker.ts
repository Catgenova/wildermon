/**
 * A deed worker off its ground walks home with nobody beside it.
 *
 * Reported: "I had sent a Tinka home to work on the deed from about 300 tiles away, but it didnt move". It walked
 * home only while its keeper stood near it: the clock settles what is within forty tiles of somebody awake
 * (`creature_sweep`), and once its keeper went home the Tinka stood a hundred and sixty-six tiles out, idle, for good.
 * Asked of the island, with the keeper at the token and the Tinka three hundred tiles off:
 *
 *   * the sweep round the keeper does not reach it, which is what left it standing;
 *   * `worker_sweep` does, and walks it a leg nearer home;
 *   * the clock runs `worker_sweep` every round;
 *   * a worker on its ground is not one of them, and nor is one whose keeper is away.
 *
 * It makes its own island and rolls it back.
 */
import { execFileSync } from 'node:child_process';
import { HOME_LEG } from '../../src/game/creatures';

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
const U = '7e5b0000-0000-4000-8000-000000000f01';

const isle = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v_far int; v_home int; j jsonb; v_n int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Farwork', 183, 400, ${TOKEN[0]}, ${TOKEN[1]}, true) returning id into w;
  perform land_blank(w, 400);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 399) x, generate_series(0, 39) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Herder');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Farstead', ${TOKEN[0]}, ${TOKEN[1]}, 10, 3, u);
  -- Set to work from three hundred tiles off, with its keeper beside it.
  update player set x = ${TOKEN[0] + FAR} + 0.5, y = ${TOKEN[1]} + 0.5, body_at = now(), swim_at = now(), seen_at = now()
   where world_id = w and uid = u;
  v_far := creature_spawn(w, 'tinka', ${TOKEN[0] + FAR} + 1.5, ${TOKEN[1]} + 0.5, 'active', now() - interval '30 days', u);
  j := rpc_act(w, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', v_far));
  insert into said values ('ASSIGN', coalesce(j->>'done', 'null'));
  -- And one set to work at home.
  update player set x = ${TOKEN[0]} + 0.5, y = ${TOKEN[1]} + 1.5 where world_id = w and uid = u;
  v_home := creature_spawn(w, 'tinka', ${TOKEN[0]} + 1.5, ${TOKEN[1]} + 0.5, 'active', now() - interval '30 days', u);
  j := rpc_act(w, 'assign_deed', jsonb_build_object('kind', 'creature', 'id', v_home));
  -- Its keeper is home now, and both are due.
  update creature set until = now() - interval '60 seconds', settled_at = now() - interval '60 seconds',
         leg_at = now() - interval '60 seconds', leg_ends = now() - interval '60 seconds', phase = 'idle'
   where world_id = w and id in (v_far, v_home);
  insert into said select 'FROM', to_x::text from creature where world_id = w and id = v_far;
  -- The sweep round the keeper, as the clock runs it.
  v_n := creature_sweep(w, ${TOKEN[0]}, ${TOKEN[1]}, 40, null, stir_slack());
  insert into said select 'NEAR', to_x::text from creature where world_id = w and id = v_far;
  -- Away, it is not walked.
  update player set away = true where world_id = w and uid = u;
  update creature set until = now() - interval '60 seconds' where world_id = w and id in (v_far, v_home);
  insert into said values ('AWAY', worker_sweep(w)::text);
  update player set away = false, seen_at = now() where world_id = w and uid = u;
  update creature set until = now() - interval '60 seconds' where world_id = w and id in (v_far, v_home);
  insert into said values ('SWEPT', worker_sweep(w)::text);
  insert into said select 'TO', to_x || '|' || to_y || '|' || sqrt((to_x - from_x) ^ 2 + (to_y - from_y) ^ 2)
    from creature where world_id = w and id = v_far;
  insert into said values ('TICK', (position('worker_sweep(w.id, v_deadline)' in pg_get_functiondef('world_tick'::regproc)) > 0)::text);
end $t$;
select k || '=' || v from said;
rollback;
`);
const said = new Map(isle.split('\n').filter((l) => l.includes('=')).map((l) => l.split('=') as [string, string]));

check('a Tinka three hundred tiles off is assigned to the settlement', said.get('ASSIGN') === 'true', said.get('ASSIGN'));
check('the sweep round its keeper at home does not reach it, which is what left it standing',
  said.get('NEAR') === said.get('FROM'), `${said.get('FROM')} then ${said.get('NEAR')}`);
check('nor is it walked while its keeper is away', said.get('AWAY') === '0', said.get('AWAY'));
check('the workers\' sweep settles it, and only it: the one at home is left to the sweeps round the players', said.get('SWEPT') === '1', said.get('SWEPT'));
{
  const [tx, ty, leg] = (said.get('TO') ?? '').split('|').map(Number);
  check('and it walks a leg nearer home', tx < Number(said.get('FROM')) && leg <= HOME_LEG + 0.01 && leg > 0 && Math.abs(ty - TOKEN[1] - 0.5) < 3, said.get('TO'));
}
check('the clock runs the workers\' sweep every round', said.get('TICK') === 'true', said.get('TICK'));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\na worker far from anybody still walks home — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
