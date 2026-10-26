/**
 * Every job says how it ended, and every line it says reaches the log.
 *
 * Reported: "Sometimes an action completes or fails with no description in
 * the event log." Two halves, each with its own causes.
 *
 * The island (`20261026180000_every_job_says_how_it_ended.sql`):
 *
 *   * every action in `action_def`, with its job due and its go come round,
 *     against a tile in reach, the same tile with nothing in the pack, a tile
 *     out of reach, a thing in the pack, a thing that is gone, a wildermon
 *     that is gone, a piece that is gone and a person: every go says
 *     something to whoever did it -- what it did, or why nothing came of it;
 *   * a run whose tool goes says why, after the job's label, with the goes
 *     left; a run with no wind left says so; a thing to eat that is gone
 *     before its go says so;
 *   * a go whose performer says nothing says "<Label>: nothing done.";
 *   * a job in the queue that cannot be done when its turn comes says why;
 *   * stop and walking off say what was put down, and what was lined up;
 *   * a refusal is told and answered alike; a call that raises tells nothing,
 *     because it rolled back, and says why only in its error (the browser's
 *     half says it);
 *   * a plan over an area hushes its pieces and is told once, and nothing
 *     after it in the same call is hushed;
 *   * and coming ashore says where the island's lines stood (`saidTo`).
 *
 * And every go asked again before it is done (`20261026180100_every_go_asked_again.sql`):
 *
 *   * every go but a fight on a job its refusal now refuses is not done, and
 *     tells that refusal word for word, after the job's label, with the goes
 *     left: the shovel gone, no wind, walked out of reach, the thing gone;
 *   * a perk's reach is asked as `rpc_act` asks it (a Fisher's Long Cast);
 *   * and a storey job keeps the storey it was asked on, written into its
 *     target where it names none, the same on both sides.
 *
 * The browser (`src/net/heardlines.ts`, `Island`):
 *
 *   * a line is said the first time its number is heard, by any road, in
 *     any order: a line to the island heard before a line of yours numbered
 *     under it no longer steps over it, on Realtime or on the beat;
 *   * the beat asks from a floor that moves up only past lines heard
 *     `SAID_LAG_MS` before an answered beat, so a line that comes late is
 *     still read;
 *   * the same words twice are two lines; the same line twice is one;
 *   * an ask the island raised on says why in the log; a refused one arms
 *     the beat at once;
 *   * and stop leaves its line to the island.
 *
 * The island half makes its own island and rolls it back.
 */
import { execFileSync } from 'node:child_process';
import { HeardLines, SAID_LAG_MS } from '../../src/net/heardlines';
import { Island, refusedSaid, type PlayerRow } from '../../src/net/island';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, ACTIONS } from '../../src/game/actions';
import { keepJobLevel, STOREY_JOBS } from '../../src/game/building';
import type { Target } from '../../src/game/actions';

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

/* ---- the island ----------------------------------------------------------- */

const A = '7e5b0000-0000-4000-8000-0000000e0001';
const B = '7e5b0000-0000-4000-8000-0000000e0002';

const out = psql(`
begin;
select setseed(0.4242) \\g /dev/null
create temp table said (k text, v text);
create temp table swept (action text, target text, why text, lines int, said text);
do $t$
declare w uuid; a uuid := '${A}'; b uuid := '${B}'; r jsonb; m bigint; d record; t jsonb; ts jsonb[]; why text;
        v_lines int; v_said text; v_msg text; v_tool bigint; v_any bigint; v_food bigint; v_pk text; v_n int;
        v_h double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Eventlog', 61, 16, 8, 8, true) returning id into w;
  perform land_blank(w, 16);
  perform land_set_height(w, i, j, 100) from generate_series(0, 16) i, generate_series(0, 16) j;
  perform land_set_tile(w, i, j, 0) from generate_series(0, 15) i, generate_series(0, 15) j;
  perform set_config('request.jwt.claims', json_build_object('sub', b)::text, true);
  perform rpc_join(w, 'Birch');
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  m := (select coalesce(max(n), 0) from event where world_id = w);
  r := rpc_join(w, 'Alder');
  -- Coming ashore says where the lines stood, its own included.
  insert into said values ('SAIDTO', ((r->>'saidTo')::bigint = (select max(n) from event where world_id = w) and (r->>'saidTo')::bigint > m)::text);
  update player set x = 8.5, y = 8.5 where world_id = w and uid = a;
  update player set x = 9.5, y = 8.5 where world_id = w and uid = b;
  select min(id) into v_any from item where world_id = w and holder_uid = a;

  -- Every action, every way its go can find it.
  for d in select * from action_def order by id loop
    select min(id) into v_tool from item where world_id = w and holder_uid = a and def = coalesce(d.tool, '');
    ts := array[
      '{"kind":"tile","x":8,"y":8,"cx":8,"cy":8}'::jsonb,
      '{"kind":"tile","x":8,"y":8,"cx":8,"cy":8,"empty":true}'::jsonb,
      '{"kind":"tile","x":14,"y":14,"cx":14,"cy":14}'::jsonb,
      jsonb_build_object('kind', 'item', 'id', coalesce(v_tool, v_any), 'uid', coalesce(v_tool, v_any)),
      '{"kind":"item","id":999999999,"uid":999999999}'::jsonb,
      '{"kind":"creature","id":999999999}'::jsonb,
      '{"kind":"furniture","id":999999999}'::jsonb,
      jsonb_build_object('kind', 'person', 'uid', b)];
    foreach t in array ts loop
      begin
        if t ? 'empty' then delete from item where world_id = w and holder_uid = a; t := t - 'empty'; end if;
        update player set stats = jsonb_set(coalesce(stats, '{}'::jsonb), '{stamina}', '1'), body_at = now(),
               act = d.id, act_target = t, act_started = now() - interval '100 seconds', act_ends = now() - interval '1 second',
               act_left = 1, act_goes = 1, act_queue = '[]'::jsonb
         where world_id = w and uid = a;
        why := act_refusal(w, a, d.id, t);
        m := (select coalesce(max(n), 0) from event where world_id = w);
        perform settle(w, a);
        select count(*), string_agg(kind || ':' || text, ' | ' order by n) into v_lines, v_said
          from event where world_id = w and n > m and (uid = a or uid is null);
        raise exception using errcode = 'WE001', message = coalesce(why, ''), detail = v_lines || chr(31) || coalesce(v_said, '');
      exception when sqlstate 'WE001' then
        get stacked diagnostics v_msg = pg_exception_detail;
        insert into swept values (d.id, t->>'kind' || coalesce(':' || (t->>'id'), '') || coalesce(':' || (t->>'x'), ''),
          nullif(sqlerrm, ''), split_part(v_msg, chr(31), 1)::int, split_part(v_msg, chr(31), 2));
      end;
    end loop;
  end loop;

  -- A run of five digs whose shovel goes after the first.
  delete from event where world_id = w and uid = a;
  update player set stats = jsonb_set(stats, '{stamina}', '1'), act = 'dig', act_target = '{"kind":"tile","x":8,"y":8,"cx":8,"cy":8}',
         act_started = now() - interval '100 seconds', act_ends = now() - interval '1 second', act_left = 5, act_goes = 5, act_queue = '[]'
   where world_id = w and uid = a;
  perform settle(w, a);
  insert into said values ('RUN1', (select string_agg(text, ' | ' order by n) from event where world_id = w and uid = a));
  insert into said values ('RUNLEFT', (select act_left::text from player where world_id = w and uid = a));
  delete from item where world_id = w and holder_uid = a and def = 'shovel';
  delete from event where world_id = w and uid = a;
  update player set act_ends = now() - interval '1 second' where world_id = w and uid = a;
  v_h := land_height(w, 8, 8);
  perform settle(w, a);
  insert into said values ('RUN2', (select string_agg(text, ' | ' order by n) from event where world_id = w and uid = a));
  insert into said values ('RUN2DUG', (land_height(w, 8, 8) <> v_h)::text);
  insert into said values ('RUN2ACT', coalesce((select act from player where world_id = w and uid = a), 'none'));
  insert into item (world_id, holder, holder_uid, def, ql, issued) values (w, 'player', a, 'shovel', 20, true);

  -- No wind left before the go.
  delete from event where world_id = w and uid = a;
  update player set stats = jsonb_set(stats, '{stamina}', '0'), body_at = now(), act = 'dig',
         act_target = '{"kind":"tile","x":8,"y":8,"cx":8,"cy":8}', act_ends = now() - interval '1 second', act_left = 3, act_goes = 3
   where world_id = w and uid = a;
  v_h := land_height(w, 8, 8);
  perform settle(w, a);
  insert into said values ('WIND', (select string_agg(text, ' | ' order by n) from event where world_id = w and uid = a));
  insert into said values ('WINDDUG', (land_height(w, 8, 8) <> v_h)::text);
  update player set stats = jsonb_set(stats, '{stamina}', '1'), body_at = now() where world_id = w and uid = a;

  -- A loaf asked for, and eaten by somebody else before the go.
  insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', a, 'bread', 30, 1) returning id into v_food;
  delete from event where world_id = w and uid = a;
  update player set act = 'eat', act_target = jsonb_build_object('kind', 'item', 'uid', v_food, 'id', v_food),
         act_ends = now() - interval '1 second', act_left = 1, act_goes = 1, act_queue = '[]'
   where world_id = w and uid = a;
  delete from item where id = v_food;
  perform settle(w, a);
  insert into said values ('GONE', (select string_agg(text, ' | ' order by n) from event where world_id = w and uid = a));

  -- A go whose performer says nothing: Set level here, its performer stood down for this one call.
  v_pk := pg_get_functiondef('perform_ground'::regproc);
  execute 'create or replace function public.perform_ground(p_world uuid, p_uid uuid, p_action text, p_target jsonb) returns void language plpgsql as $f$ begin return; end $f$';
  delete from event where world_id = w and uid = a;
  update player set act = 'take_level', act_target = '{"kind":"tile","x":8,"y":8,"cx":8,"cy":8}',
         act_ends = now() - interval '1 second', act_left = 1, act_goes = 1, act_queue = '[]'
   where world_id = w and uid = a;
  perform settle(w, a);
  insert into said values ('UNSAID', (select string_agg(text, ' | ' order by n) from event where world_id = w and uid = a));
  execute v_pk;

  -- A job in hand and one behind it that cannot be done when its turn comes.
  delete from event where world_id = w and uid = a;
  update player set act = 'dig', act_target = '{"kind":"tile","x":8,"y":8,"cx":8,"cy":8}',
         act_ends = now() - interval '1 second', act_left = 1, act_goes = 1,
         act_queue = '[{"action":"dig","target":{"kind":"tile","x":14,"y":14,"cx":14,"cy":14},"goes":1}]'
   where world_id = w and uid = a;
  perform settle(w, a);
  insert into said values ('QUEUE', (select string_agg(text, ' | ' order by n) from event where world_id = w and uid = a));

  -- Stop, with two lined up; and walking off, with two lined up.
  for v_n in 1..2 loop
    delete from event where world_id = w and uid = a;
    update player set act = 'dig', act_target = '{"kind":"tile","x":8,"y":8,"cx":8,"cy":8}',
           act_started = now(), act_ends = now() + interval '1 hour', act_left = 1, act_goes = 1,
           act_queue = '[{"action":"dig","target":{"kind":"tile","x":8,"y":8,"cx":8,"cy":8},"goes":1},
                         {"action":"dig","target":{"kind":"tile","x":8,"y":8,"cx":8,"cy":8},"goes":1}]'
     where world_id = w and uid = a;
    if v_n = 1 then perform rpc_cancel(w); else perform rpc_hold(w); end if;
    insert into said values (case v_n when 1 then 'STOP' else 'HOLD' end,
      (select string_agg(text, ' | ' order by n) from event where world_id = w and uid = a));
  end loop;
  update player set act = null, act_target = null, act_started = null, act_ends = null, act_left = null, act_goes = null,
         act_queue = '[]' where world_id = w and uid = a;

  -- A refusal, told and answered alike.
  delete from event where world_id = w and uid = a;
  r := rpc_act(w, 'dig', '{"kind":"tile","x":14,"y":14,"cx":14,"cy":14}', 1);
  insert into said values ('REFUSED', (r->>'why') || '#' || (select string_agg(text, ' | ' order by n) from event where world_id = w and uid = a));

  -- A call that raises: rolled back, line and all, and its error is the only word of it.
  m := (select coalesce(max(n), 0) from event where world_id = w);
  begin
    perform rpc_act(w, 'dig', '{"kind":"nowhere","x":8,"y":8}', 1);
    insert into said values ('RAISED', 'no error');
  exception when others then
    insert into said values ('RAISED', sqlerrm || '#' || (select count(*) from event where world_id = w and n > m));
  end;

  -- A run of three digs, and the body walks out of reach of its corner before the go.
  delete from event where world_id = w and uid = a;
  update player set x = 13.5, y = 13.5, stats = jsonb_set(stats, '{stamina}', '1'), body_at = now(), act = 'dig',
         act_target = '{"kind":"tile","x":8,"y":8,"cx":8,"cy":8}', act_ends = now() - interval '1 second', act_left = 3, act_goes = 3,
         act_queue = '[]'
   where world_id = w and uid = a;
  v_h := land_height(w, 8, 8);
  perform settle(w, a);
  insert into said values ('WALK', (select string_agg(text, ' | ' order by n) from event where world_id = w and uid = a)
    || '#' || (land_height(w, 8, 8) <> v_h)::text);
  update player set x = 8.5, y = 8.5, act = null, act_target = null, act_left = null, act_goes = null where world_id = w and uid = a;

  -- A perk's reach is asked again as it was asked: a Fisher's Long Cast, five tiles out over a pond.
  perform land_set_height(w, i, j, -30) from generate_series(13, 16) i, generate_series(0, 16) j;
  perform give(w, a, 'fishing_rod', 1, 40);
  insert into said values ('CASTNO', coalesce(act_refusal(w, a, 'fish', '{"kind":"tile","x":13,"y":8}'), 'ALLOWED'));
  update player set craft_class = 'fisher' where world_id = w and uid = a;
  insert into player_node (world_id, uid, node) values (w, a, 'fisher_long_cast');
  perform class_fold(w, a);
  delete from event where world_id = w and uid = a;
  update player set act = 'fish', act_target = '{"kind":"tile","x":13,"y":8}', act_ends = now() - interval '1 second',
         act_left = 1, act_goes = 1, act_queue = '[]'
   where world_id = w and uid = a;
  perform settle(w, a);
  insert into said values ('CASTYES', coalesce(act_refusal(w, a, 'fish', '{"kind":"tile","x":13,"y":8}'), 'ALLOWED') || '#'
    || (select string_agg(text, ' | ' order by n) from event where world_id = w and uid = a));
  perform land_set_height(w, i, j, 100) from generate_series(13, 16) i, generate_series(0, 16) j;

  -- A storey job keeps the storey it is asked on: written in where the target names none.
  insert into building (world_id, id, name, levels, work_level, planned_by) values (w, 501, 'Twostorey', 2, 0, a);
  insert into building_tile (world_id, building, x, y) values (w, 501, 4, 4);
  insert into said select 'KEPT', string_agg(coalesce((private.keep_job_level(w, k.act, k.t)->>'level'), '-'), ',' order by k.o)
    from (values (1, 'plan_wall', '{"kind":"tile","x":4,"y":4,"side":"n"}'::jsonb),
                 (2, 'plan_wall', '{"kind":"tile","x":4,"y":4,"side":"n","level":1}'::jsonb),
                 (3, 'plan_wall', '{"kind":"tile","x":4,"y":4,"side":"n","terrace":true}'::jsonb),
                 (4, 'plan_floor', '{"kind":"tile","x":4,"y":4,"floorKind":"roof"}'::jsonb),
                 (5, 'dig', '{"kind":"tile","x":4,"y":4,"cx":4,"cy":4}'::jsonb),
                 (6, 'plan_wall', '{"kind":"tile","x":9,"y":9,"side":"n"}'::jsonb)) k(o, act, t);
  update building set work_level = 1 where world_id = w and id = 501;
  insert into said select 'KEPTUP', private.keep_job_level(w, 'build_floor', '{"kind":"tile","x":4,"y":4}')->>'level';
  insert into said select 'STOREYJOBS', string_agg(id, ',' order by id) from action_def where private.storey_job(id);
  delete from building_tile where world_id = w and building = 501;
  delete from building where world_id = w and id = 501;

  -- A plan over an area: its pieces hushed, the lot told once, and nothing after it hushed.
  update player set act = null, act_queue = '[]' where world_id = w and uid = a;
  perform act_perform(w, a, 'found_settlement', '{"kind":"tile","x":8,"y":8,"cx":8,"cy":8,"name":"Eventstead"}');
  update player set x = 11.5, y = 11.5 where world_id = w and uid = a;
  perform land_set_tile(w, 11, 11, tile_id('Packed dirt'));
  perform land_set_tile(w, 12, 11, tile_id('Packed dirt'));
  m := (select coalesce(max(n), 0) from event where world_id = w);
  r := rpc_plan_area(w, '[{"action":"plan_building","target":{"kind":"tile","x":11,"y":11,"name":"Annex"}},
                          {"action":"add_to_building","target":{"kind":"tile","x":12,"y":11}}]'::jsonb);
  perform tell(w, a, 'After the plan.', 'info');
  insert into said values ('AREA', (r->>'planned') || '#' || private.hushed()::text || '#'
    || (select string_agg(text, ' | ' order by n) from event where world_id = w and n > m and uid = a));
end $t$;
select 'SWEPT|' || count(*) || '|' || count(distinct action) || '|' || count(*) filter (where lines = 0)
       || '|' || count(*) filter (where why is not null) || '|' || count(*) filter (where why is null) from swept;
select 'SILENT|' || action || ' on ' || target || ' (' || coalesce(why, 'allowed') || ')' from swept where lines = 0 order by 1 limit 40;
select 'REFUSALTOLD|' || count(*) filter (where why is not null and position(why in said) > 0) || '|' || count(*) filter (where why is not null) from swept;
select 'FAULTED|' || count(*) from swept where said like '%Island error%';
select 'UNASKED|' || (select count(*) from swept where why is not null and position(why in said) = 0 and not is_fight(action))
  || '|' || coalesce((select string_agg(action || ' on ' || target || ': ' || said, '; ') from (select * from swept
       where why is not null and position(why in said) = 0 and not is_fight(action) limit 10) z), '');
select 'SAMPLE|' || action || ' on ' || target || ': ' || said from swept
 where (action, target) in (('dig', 'tile:8'), ('dig', 'tile:14'), ('eat', 'item:999999999'), ('make_planks', 'tile:8'));
select k || '|' || coalesce(v, '') from said;
rollback;
`);

const field = (k: string): string => out.split('\n').find((l) => l.startsWith(`${k}|`))?.slice(k.length + 1) ?? '';
const fields = (k: string): string[] => out.split('\n').filter((l) => l.startsWith(`${k}|`)).map((l) => l.slice(k.length + 1));

const [cases, actions, silent, refused, allowed] = field('SWEPT').split('|').map(Number);
const silentOnes = fields('SILENT');
check('every action, its go come round, against a tile, an empty pack, a tile out of reach, a thing held, and a thing, a wildermon, a piece gone, and a person: every go says something to whoever did it',
  cases > 0 && actions > 600 && silent === 0,
  `${cases} goes over ${actions} actions, ${refused} of them on a job that would be refused by then and ${allowed} not; ${silent} said nothing; ${field('FAULTED')} an island error${silentOnes.length ? `: ${silentOnes.join('; ')}` : ''}`);
const [toldWhy, refusedAll] = field('REFUSALTOLD').split('|').map(Number);
check('a go on a job that would be refused by then says something, and most often the refusal itself',
  refusedAll > 0 && toldWhy > 0, `${toldWhy} of ${refusedAll} carry the refusal word for word`);
for (const s of fields('SAMPLE')) check(`for instance, ${s.slice(0, s.indexOf(': '))}`, s.length > 0, s.slice(s.indexOf(': ') + 2));

check('a run of five digs: the first go is dug, or fails, and says so, and the run goes on',
  /Dug: dirt, QL |Dig failed\./.test(field('RUN1')) && field('RUNLEFT') === '4', `"${field('RUN1')}", left ${field('RUNLEFT')}`);
const [unasked, unaskedOnes] = field('UNASKED').split('|');
check('every go but a fight is asked again before it is done: a go its job would be refused for is told that refusal, word for word',
  unasked === '0', `${unasked} not${unaskedOnes ? `: ${unaskedOnes}` : ''}`);
check('its shovel gone before the second go: not dug, and the run stops on "Dig: Need a shovel. Left: 4.", the job put down',
  field('RUN2') === 'Dig: Need a shovel. Left: 4.' && field('RUN2DUG') === 'false' && field('RUN2ACT') === 'none',
  `"${field('RUN2')}", dug ${field('RUN2DUG')}, in hand ${field('RUN2ACT')}`);
check('no wind left before the go: not dug, and "Dig: Too exhausted. Rest. Left: 3."',
  field('WIND') === 'Dig: Too exhausted. Rest. Left: 3.' && field('WINDDUG') === 'false', `"${field('WIND')}", dug ${field('WINDDUG')}`);
const [walked, walkDug] = field('WALK').split('#');
check('walked out of reach before the go: not dug, and "Dig: You are too far away from that. Left: 3."',
  walked === 'Dig: You are too far away from that. Left: 3.' && walkDug === 'false', `"${walked}", dug ${walkDug}`);
check('a thing to eat gone before the go: "Eat: It is gone. Left: 1."', field('GONE') === 'Eat: It is gone. Left: 1.', `"${field('GONE')}"`);
const [castYes, castSaid] = field('CASTYES').split('#');
check('a perk\'s reach is asked again as it was asked: a cast five tiles out is refused without Long Cast, and with it allowed and cast at its go',
  field('CASTNO') === 'You are too far away from that.' && castYes === 'ALLOWED' && !!castSaid && !castSaid.includes('too far'),
  `without "${field('CASTNO')}"; with "${castYes}", told "${castSaid}"`);
check('a storey job keeps the storey it is asked on: written in where the target names none, the one named kept, a terrace, a roof, another job and a tile off any building left alone',
  field('KEPT') === '0,1,-,-,-,-' && field('KEPTUP') === '1', `${field('KEPT')}; at work level 1: ${field('KEPTUP')}`);
check('a go whose performer says nothing: "Set level here: nothing done."', field('UNSAID') === 'Set level here: nothing done.', `"${field('UNSAID')}"`);
check('a job in the queue that cannot be done when its turn comes: said',
  /Dug: dirt, QL |Dig failed\./.test(field('QUEUE')) && field('QUEUE').endsWith(' | You are too far away from that.'), `"${field('QUEUE')}"`);
check('stop says what it put down and what it cleared: "Stopped digging. Queue cleared: 2 actions."',
  field('STOP') === 'Stopped digging. Queue cleared: 2 actions.', `"${field('STOP')}"`);
check('walking off says what it put down and what waits: "Stopped digging. Queue held: 3."',
  field('HOLD') === 'Stopped digging. Queue held: 3.', `"${field('HOLD')}"`);
const [why, told] = field('REFUSED').split('#');
check('a refusal is told and answered in the same words', !!why && told === why, `answered "${why}", told "${told}"`);
const [raised, raisedTold] = field('RAISED').split('#');
check('a call that raises tells nothing (it rolled back) and says why in its error, for the browser to say',
  /^Bad request: /.test(raised ?? '') && raisedTold === '0', `"${raised}", ${raisedTold} lines`);
const [planned, hushed, areaSaid] = field('AREA').split('#');
check('a plan over an area: its pieces hushed and told once, and a line after it in the same call is told',
  planned === '2' && hushed === 'false' && areaSaid === 'Planned: 2 tiles. | After the plan.', `planned ${planned}, hushed after ${hushed}, told "${areaSaid}"`);
check('coming ashore says where the island\'s lines stood, its own included', field('SAIDTO') === 'true', field('SAIDTO'));

/* ---- the browser: a storey job keeps its storey, as the island has it ----- */

{
  const g = Game.create(4242, 64);
  const b = g.buildings.create('Twostorey', 4, 4);
  b.levels = 2;
  b.workLevel = 0;
  const kept = ([
    ['plan_wall', { kind: 'tile', x: 4, y: 4, side: 'n' }],
    ['plan_wall', { kind: 'tile', x: 4, y: 4, side: 'n', level: 1 }],
    ['plan_wall', { kind: 'tile', x: 4, y: 4, side: 'n', terrace: true }],
    ['plan_floor', { kind: 'tile', x: 4, y: 4, floorKind: 'roof' }],
    ['dig', { kind: 'tile', x: 4, y: 4, cx: 4, cy: 4 }],
    ['plan_wall', { kind: 'tile', x: 9, y: 9, side: 'n' }],
  ] as unknown as Array<[string, { kind: string; level?: number }]>).map(([id, t]) => {
    const l = keepJobLevel(g.buildings, id, t).level;
    return l === undefined ? '-' : String(l);
  }).join(',');
  b.workLevel = 1;
  const up = keepJobLevel(g.buildings, 'build_floor', { kind: 'tile', x: 4, y: 4 } as { kind: string; level?: number }).level;
  check('and in the browser the same, case for case (`keepJobLevel`)', kept === field('KEPT') && String(up) === field('KEPTUP'),
    `browser ${kept}; ${up}, island ${field('KEPT')}; ${field('KEPTUP')}`);
  const mine = ACTIONS.map((a) => a.id).filter((id) => STOREY_JOBS.has(id)).sort().join(',');
  check('the storey jobs are the same jobs on both sides (`STOREY_JOBS`, `private.storey_job`)', mine === field('STOREYJOBS'),
    `browser ${mine}; island ${field('STOREYJOBS')}`);
}

/* ---- the browser: lines by number -------------------------------------- */

{
  let clock = 0;
  const h = new HeardLines(() => clock);
  h.from(100);
  const heard: number[] = [];
  const hear = (n: number): void => {
    if (h.first(n)) heard.push(n);
  };
  hear(102); // a line to the island, on its own topic
  hear(101); // and yours, numbered under it, on yours, after it
  hear(102); // the island's again, from a channel being rebuilt
  hear(100); // and one from before you came ashore
  check('a line is heard the first time its number comes, in whatever order, and only then',
    heard.join(',') === '102,101', heard.join(','));
  check('the beat asks from the floor, not from the highest heard', h.floor === 100 && h.top === 102, `floor ${h.floor}, top ${h.top}`);
  h.settled(clock);
  check(`a beat that answers straight away leaves the floor where it was: a line under one just heard may still be on its way`,
    h.floor === 100, `floor ${h.floor}`);
  clock += SAID_LAG_MS + 1;
  hear(105);
  h.settled(clock);
  check(`a beat ${SAID_LAG_MS / 1000} s after a line moves the floor up to it, and not past what has just been heard`,
    h.floor === 102 && !h.first(101) && h.first(104), `floor ${h.floor}`);
  h.mark(110);
  check('the island\'s mark on a first beat moves the floor up to it', h.floor === 110 && !h.first(105), `floor ${h.floor}`);
}

/* ---- the browser: the island's answers ---------------------------------- */

type Said = { text: string; kind: string };
const logged: Said[] = [];
let settleSaid: Array<{ n: number; text: string; kind: string }> = [];
let saidAsked: number[] = [];
let actAnswer: () => Response = () => json({ started: true, seconds: 3, ends: new Date(Date.now() + 3000).toISOString() });
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const raise = (message: string): Response => json({ code: 'P0001', message, details: null, hint: null }, 400);
let doorAnswer: (door: string) => Response | null = () => null;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const args = (init?.body ? JSON.parse(String(init.body)) : {}) as Record<string, unknown>;
  const door = /\/rest\/v1\/rpc\/(\w+)/.exec(url)?.[1] ?? '';
  const answer = doorAnswer(door);
  if (answer) return answer;
  if (door === 'rpc_settle') {
    saidAsked.push(Number(args.p_said));
    return json({ settled: 0, said: settleSaid.filter((l) => l.n > Number(args.p_said)) });
  }
  if (door === 'rpc_act') return actAnswer();
  return json({});
}) as typeof fetch;

const ashore = (): { isle: Island; beats: number[] } => {
  const isle = new Island({ say: (text: string, kind: string) => logged.push({ text, kind }) } as never);
  isle.info = { id: 'w', name: 'w', seed: 1, size: 64, spawn_x: 0, spawn_y: 0, ready: true, epoch: '2026-01-01T00:00:00Z' };
  isle.uid = 'u-alder';
  isle.me = { world_id: 'w', uid: 'u-alder', name: 'Alder', x: 8, y: 8, level: 0, act: null, act_ends: null } as PlayerRow;
  const inside = isle as unknown as Record<string, unknown>;
  const beats: number[] = [];
  for (const still of ['reconcile', 'refreshMobs', 'refreshGround', 'refreshSprings', 'keepFog', 'keepGuide', 'watch', 'catchUpQuietly', 'refreshPack', 'refreshForaged']) {
    inside[still] = () => Promise.resolve();
  }
  inside.armBeat = (s: number) => beats.push(s);
  (inside.lines as HeardLines).from(100);
  return { isle, beats };
};
const inside = (isle: Island): Record<string, (...a: unknown[]) => unknown> => isle as unknown as Record<string, (...a: unknown[]) => unknown>;
const texts = (): string => logged.map((l) => l.text).join(' | ');

{
  const { isle } = ashore();
  logged.length = 0;
  saidAsked = [];
  // A line to the island on its topic, and then yours under it never comes down your own.
  inside(isle).heardLines({ lines: [{ n: 102, uid: null, text: 'Birch logged on.', kind: 'presence' }] });
  settleSaid = [{ n: 101, text: 'Dug: dirt, QL 12.', kind: 'event' }, { n: 102, text: 'Birch logged on.', kind: 'presence' }];
  await inside(isle).pulse();
  check('a line of yours stepped over by a line to the island heard first comes with the next beat, which asks from under it',
    texts() === 'Birch logged on. | Dug: dirt, QL 12.' && saidAsked[0] === 100, `${texts()}; asked from ${saidAsked.join(',')}`);
  await inside(isle).pulse();
  check('and the next beat asks from the same floor and says nothing twice',
    saidAsked[1] === 100 && logged.length === 2, `asked from ${saidAsked.join(',')}; ${texts()}`);
}
{
  const { isle } = ashore();
  logged.length = 0;
  inside(isle).heardLines({ lines: [{ n: 104, uid: 'u-alder', text: 'Dug: dirt, QL 12.', kind: 'event' }] });
  inside(isle).heardLines({ lines: [{ n: 103, uid: 'u-alder', text: 'Need a shovel.', kind: 'error' }] });
  inside(isle).heardLines({ lines: [{ n: 105, uid: 'u-alder', text: 'Dug: dirt, QL 12.', kind: 'event' }] });
  inside(isle).hearLine({ n: 104, uid: 'u-alder', text: 'Dug: dirt, QL 12.', kind: 'event' });
  check('on Realtime too: a line that comes after one numbered above it is said, the same words twice are two lines, the same line twice is one',
    texts() === 'Dug: dirt, QL 12. | Need a shovel. | Dug: dirt, QL 12.', texts());
}
{
  const { isle, beats } = ashore();
  logged.length = 0;
  actAnswer = () => raise('Too many requests: wait 2 s.');
  const r = await isle.act('dig', { kind: 'tile', x: 8, y: 8, cx: 8, cy: 8 });
  check('an ask the island raised on says why in the log, in the island\'s words',
    !r.started && logged.length === 1 && logged[0].text === 'Not done: Too many requests: wait 2 s.' && logged[0].kind === 'error', texts());
  logged.length = 0;
  beats.length = 0;
  actAnswer = () => json({ started: false, why: 'Need a shovel.' });
  await isle.act('dig', { kind: 'tile', x: 8, y: 8, cx: 8, cy: 8 });
  check('a refused ask is not said twice here (the island tells it) and the beat goes at once to read it',
    logged.length === 0 && beats.includes(0.5), `beats ${beats.join(',')}; ${texts()}`);
  beats.length = 0;
  actAnswer = () => json({});
  await isle.act('dig', { kind: 'tile', x: 8, y: 8, cx: 8, cy: 8 });
  check('an ask sent again whose first answer was lost (answered {}) arms the beat too', beats.includes(0.5), `beats ${beats.join(',')}`);
  logged.length = 0;
  settleSaid = [];
  doorAnswer = (door) => (door === 'rpc_plan_area' || door === 'rpc_cancel' ? raise('Bad request: rpc_plan_area p_asks: plans of tiles only.') : null);
  await isle.planArea([{ action: 'plan_wall', target: {} }]);
  await isle.stop();
  doorAnswer = () => null;
  check('a plan over an area and a stop the island raised on say why',
    logged.length === 2 && logged.every((l) => l.text === 'Not done: Bad request: rpc_plan_area p_asks: plans of tiles only.'), texts());
  check('and a call that never reached the island says that', refusedSaid('TypeError: Failed to fetch') === 'Not sent: no answer from the island.',
    refusedSaid('TypeError: Failed to fetch'));
}

/* ---- the browser: stop leaves its line to the island -------------------- */

{
  const g = Game.create(4242, 64);
  const def = ACTION_BY_ID.get('dig');
  const t = { kind: 'tile', x: 8, y: 8, cx: 8, cy: 8 } as Target;
  if (def) {
    let stops = 0;
    g.stop = () => {
      stops++;
    };
    g.action = { def, target: t, state: 'performing', elapsed: 1, duration: 3 };
    g.queue.push({ def, target: t }, { def, target: t });
    const before = g.log.length;
    g.cancelAction();
    const lines = g.log.slice(before).map((e) => e.text);
    check('stopping on an island tells the island and says nothing of its own: the island says what it really put down',
      stops === 1 && lines.length === 0 && g.action === null && g.queue.length === 0, `${stops} stop, lines ${JSON.stringify(lines)}`);
  } else check('stopping on an island tells the island', false, 'no dig');
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`every job says how it ended, and the log hears it — ${ok.length} of ${ok.length}`);
process.exit(0);
