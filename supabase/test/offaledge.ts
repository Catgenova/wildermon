/**
 * "I'm stuck" on the ground: out of a pocket no walk leaves.
 *
 * Reported: "my position may have desynced onto a cliff. Mounted or unmounted now i cant ascend or descend due to
 * grade of the cliff." A walk from where catgenova stood reached one more tile and was held short of every other.
 * `rpc_unstick` put a body on the ground floor of its tile and nothing else, so on the ground it said "On the ground
 * floor already." and there was no way off.
 *
 * A tile raised far above its neighbours, flat on top: every step off it a drop past any step, every neighbour too
 * steep to stand on. A body on it asks to be unstuck, goes to the nearest tile within `unstick_search` a walk gets
 * `unstick_reach` out from, and can walk from there; asked again it is refused, not stuck. On a saddle: refused. Up a
 * storey: the ground floor, same tile, as before. The browser's numbers are the island's.
 *
 * Runs against the database the suite leaves behind, in one transaction that is rolled back.
 */
import { execFileSync } from 'node:child_process';
import { UNSTICK_REACH, UNSTICK_SEARCH } from '../../src/game/keep';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wildermon',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};

const NELL = 'd71c4a17-0000-4000-8000-0000000000f3';
const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${NELL}'; r jsonb; v_base int; v_beast int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Ledge', 183, 64, 40, 40, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Nell');
  perform land_set_tile(w, x, y, 0) from generate_series(0, 63) x, generate_series(0, 63) y;
  v_base := land_height(w, 20, 20);
  -- Tile 20, 20 raised flat, far above the rest: its four corners.
  perform land_set_height(w, x, y, (v_base + 40 * max_step())::int) from generate_series(20, 21) x, generate_series(20, 21) y;
  update player set x = 20.5, y = 20.5, level = 0, moved_at = now() - interval '1 minute', body_at = now()
   where world_id = w and uid = u;
  insert into said values ('NUMBERS', unstick_reach() || ' ' || unstick_search());

  -- Stuck: no walk off the block.
  insert into said select 'POCKET', (o.escaped)::text || ' ' || cardinality(o.pocket) from private.walks_out(w, u, 20, 20, unstick_reach()) o;
  r := rpc_move(w, 21.4, 20.5, 0);
  insert into said values ('WALK_OFF', round((r->>'x')::numeric, 2) || ' ' || (r->>'blocked'));
  update player set x = 20.5, y = 20.5, moved_at = now() - interval '1 minute' where world_id = w and uid = u;

  -- On a saddle: refused, the step is the beast's.
  insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, health, sex, keeper, rider)
    values (w, 990001, 'orse', 'Moonhare', 'active', 20.5, 20.5, 20.5, 20.5, 90, 'female', u, u) returning id into v_beast;
  insert into said values ('MOUNTED', coalesce(rpc_unstick(w)->>'why', 'none'));
  delete from creature where id = v_beast;

  -- Unstuck: the nearest tile a walk gets out from.
  r := rpc_unstick(w);
  insert into said values ('UNSTUCK', coalesce(r->>'why', (r->>'x') || ' ' || (r->>'y') || ' ' || (r->>'level')));
  insert into said select 'BODY', x || ' ' || y || ' ' || level from player where world_id = w and uid = u;
  insert into said select 'TOLD', text from event where world_id = w and uid = u and kind = 'system' order by n desc limit 1;
  insert into said select 'FREE', (o.escaped)::text from player p, private.walks_out(w, u, floor(p.x)::int, floor(p.y)::int, unstick_reach()) o
   where p.world_id = w and p.uid = u;

  -- And walks from there.
  update player set moved_at = now() - interval '1 minute' where world_id = w and uid = u;
  r := rpc_move(w, 20.5, 17.5, 0);
  insert into said values ('WALKS', round((r->>'x')::numeric, 2) || ' ' || round((r->>'y')::numeric, 2) || ' ' || (r->>'blocked'));

  -- Asked again on open ground: not stuck.
  insert into said values ('AGAIN', coalesce(rpc_unstick(w)->>'why', 'moved'));

  -- Up a storey: the ground floor, same tile, as before.
  update player set level = 1 where world_id = w and uid = u;
  r := rpc_unstick(w);
  insert into said select 'STOREY', (r->>'level') || ' ' || x || ' ' || y || ' ' || level from player where world_id = w and uid = u;
end $t$;
select k || '=' || v from said;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const at = (k: string): string => isle.get(k) ?? '(not said)';

check('the browser\'s numbers are the island\'s', at('NUMBERS') === `${UNSTICK_REACH} ${UNSTICK_SEARCH}`, at('NUMBERS'));
check('on the raised tile no walk gets out: the pocket is the one tile', at('POCKET') === 'false 1', at('POCKET'));
check('a walk off it is held on it', at('WALK_OFF').endsWith(' true') && Number(at('WALK_OFF').split(' ')[0]) < 21, at('WALK_OFF'));
check('mounted: refused, "Riding: dismount first."', at('MOUNTED') === 'Riding: dismount first.', at('MOUNTED'));
check('unstuck: to 20, 18, the nearest tile a walk gets out from (its neighbours too steep to stand on)', at('UNSTUCK') === '20.5 18.5 0' && at('BODY') === '20.5 18.5 0',
  `${at('UNSTUCK')} / ${at('BODY')}`);
check('said: "Moved: 20, 18."', at('TOLD') === 'Moved: 20, 18.', at('TOLD'));
check('from there a walk gets out', at('FREE') === 'true', at('FREE'));
check('and the body walks on from there', at('WALKS') === '20.50 17.50 false', at('WALKS'));
check('asked again on open ground: "Not stuck: a walk gets off this ground."', at('AGAIN') === 'Not stuck: a walk gets off this ground.', at('AGAIN'));
check('up a storey: the ground floor, same tile, as before', at('STOREY') === '0 20.5 17.5 0', at('STOREY'));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nI'm stuck, on the ground — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
