/**
 * A body lies where it fell, and a heavy blow is marked as one (`src/game/fell.ts`, `src/sculpt/anim/clips/down-ko.ts`,
 * `src/sculpt/anim/clips/stumble.ts`; 20261120000032_a_body_lies_where_it_fell.sql).
 *
 * Asked for: a body whose health reaches nought falls and lies there until it respawns or gets up, seen by its player and
 * by everybody watching; and a heavy blow drawn as a stumble back. What this asks of the island:
 *
 *   * a death writes where the body fell on its row (`player.fell`: x, y, storey and the death's instant), on a storey
 *     too, while the body wakes on the spawn as before; the beat says it (`rpc_settle`), as the browser reads it
 *     (`fellIn`), and the roster can read it off the row (`PEOPLE_COLUMNS`); the browser draws it lain there
 *     (`lyingAt`) while it is on the spawn;
 *   * it goes when the offer of where to wake goes: a pick of a stone, a stay, a step off the spawn (the beat after);
 *   * a blow that lands is not heavy (`player.hurt_heavy` false); an ogre's heavy blow that lands is, said in its line
 *     as the browser reads it (`heavyOf`), and the beat says it.
 *
 * Runs against the database the suite leaves behind; rolled back.
 */
import { fellIn, lyingAt } from '../../src/game/fell';
import { heavyOf } from '../../src/game/fight';
import { psql, check, finish } from './harness';

const N = 1024;
const SPAWN = 5;
const ME = '5e5b0000-0000-4000-8000-0000000000f1';
const FALL = { x: 400.5, y: 650.25 };

const out = psql(`
begin;
create temp table said (k text, v text);
create function pg_temp.as_(u uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  delete from caller where uid = u;
end $f$;
create function pg_temp.die(w uuid, u uuid, lv int) returns void language plpgsql as $f$
begin
  update player set x = ${FALL.x}, y = ${FALL.y}, level = lv, aboard = null where world_id = w and uid = u;
  perform player_die(w, u);
end $f$;
create function pg_temp.beat(w uuid, u uuid) returns jsonb language plpgsql as $f$
begin
  perform pg_temp.as_(u);
  return rpc_settle(null, w, null, false, null);
end $f$;
do $t$
declare w uuid; me uuid := '${ME}'; j jsonb; b record; v_px double precision; v_py double precision; v_ogre int; v_h double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Fallow', 4249, ${N}, ${SPAWN}, ${SPAWN}, true) returning id into w;
  perform land_blank(w, ${N});
  update land_corner set heights = decode(repeat('0a00', ${N + 1}), 'hex') where world_id = w;
  perform pg_temp.as_(me); perform rpc_join(w, 'Feallan');

  -- Never died: nothing.
  insert into said values ('LIVE', coalesce((select fell::text from player where world_id = w and uid = me), 'null'));
  -- A death on the ground: on the spawn, the fall on the row and on the beat.
  perform pg_temp.die(w, me, 0);
  insert into said values ('ROW', (select x || ',' || y || ',' || level || '|' || fell::text || '|' || ((fell->>'at')::timestamptz = now())::text from player where world_id = w and uid = me));
  j := pg_temp.beat(w, me);
  insert into said values ('BEAT', coalesce(j->'fell', 'null'::jsonb)::text);
  insert into said values ('BEAT_AGAIN', coalesce(pg_temp.beat(w, me)->'fell', 'null'::jsonb)::text);
  -- Stay: gone.
  perform pg_temp.as_(me);
  perform rpc_respawn(w, 'stay');
  insert into said values ('STAY', coalesce((select fell::text from player where world_id = w and uid = me), 'null'));
  -- A death a storey up, then a stone picked: gone.
  perform pg_temp.die(w, me, 1);
  insert into said values ('UP', (select (fell->>'level') || ',' || level from player where world_id = w and uid = me));
  perform pg_temp.as_(me);
  perform rpc_respawn(w, 'crownstone');
  insert into said values ('STONE', coalesce((select fell::text from player where world_id = w and uid = me), 'null'));
  -- A death, then a step off the spawn: gone on the next beat.
  perform pg_temp.die(w, me, 0);
  update player set x = ${SPAWN + 1.5} where world_id = w and uid = me;
  -- (the beat that finds it off answers from the row as it was; the row and the beats after, none)
  j := pg_temp.beat(w, me);
  insert into said values ('STEPPED', coalesce((select fell::text from player where world_id = w and uid = me), 'null') || '|'
    || coalesce(pg_temp.beat(w, me)->'fell', 'null'::jsonb)::text);

  -- Blows, on the biggest island with land, off its beach.
  select p.world_id, p.uid, wd.size, wd.spawn_x, wd.spawn_y into b
    from player p join world wd on wd.id = p.world_id
   where exists (select 1 from land_tile t where t.world_id = wd.id) and wd.id <> w
   order by wd.size desc, p.world_id, p.uid limit 1;
  v_px := case when b.spawn_x + peace_reach() + 6 < b.size then b.spawn_x + peace_reach() + 6.5 else b.spawn_x - peace_reach() - 5.5 end;
  v_py := b.spawn_y + 0.5;
  update player set body_at = now(), x = v_px - 60 where world_id = b.world_id and uid <> b.uid and (x - v_px) ^ 2 + (y - v_py) ^ 2 < 60 ^ 2;
  update player set act = null, act_target = null, act_ends = null, act_left = null, act_goes = null, act_queue = '[]'::jsonb,
         equipped = '{}'::jsonb, fight_stance = 'balanced', fight_back = false, moved_at = now() - interval '1 minute',
         x = v_px, y = v_py, level = 0, wounds = '[]'::jsonb, away = false, blessings = '{}'::jsonb, combat_class = null, class_mul = null,
         hurt_heavy = true, played = greatest(played, death_grace()),
         stats = (coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1, 'aegis', 0)) - 'hurtBy'
    where world_id = b.world_id and uid = b.uid;
  delete from player_node where world_id = b.world_id and uid = b.uid;
  delete from faith_zone where world_id = b.world_id;
  insert into skill (world_id, uid, id, value) values (b.world_id, b.uid, 'body_control', dodge_from())
    on conflict (world_id, uid, id) do update set value = excluded.value;
  -- A plain blow that lands: not heavy.
  perform hurt_player(b.world_id, b.uid, 0.05, 'Something is on you', 'cut');
  insert into said values ('PLAIN', (select (hurt_at = now())::text || '|' || hurt_heavy from player where world_id = b.world_id and uid = b.uid));
  -- An ogre beside you, its heavy blow drawn back for and coming down now.
  update creature set hunting = null, brawl = null where world_id = b.world_id and hunting = b.uid;
  v_ogre := creature_spawn(b.world_id, 'ogre', v_px + 0.7, v_py, 'wild', now() - interval '2 hours');
  update creature set health = 50000, traits = '{}', hunting = b.uid, hunt_x = v_px + 0.7, hunt_y = v_py, fight_blows = 0,
      windup_at = now() - interval '1 second', from_x = v_px + 0.7, from_y = v_py, to_x = v_px + 0.7, to_y = v_py, leg_at = now(), leg_ends = now(),
      until = now() - interval '1 second', settled_at = now() - interval '1 second'
    where world_id = b.world_id and id = v_ogre;
  update player set hurt_at = null, hurt_heavy = false, wounds = '[]'::jsonb, stats = jsonb_set(stats, '{health}', '1') where world_id = b.world_id and uid = b.uid;
  delete from event where uid = b.uid;
  perform creature_settle(b.world_id, v_ogre);
  select (stats->>'health')::double precision into v_h from player where world_id = b.world_id and uid = b.uid;
  insert into said values ('HEAVY', (select coalesce((hurt_at = now())::text, 'null') || '|' || hurt_heavy || '|' || (fell is not null)::text from player where world_id = b.world_id and uid = b.uid)
    || '|' || coalesce((select text from event where uid = b.uid and kind = 'fight' and text like '%heavy blow lands%' order by n desc limit 1), 'unsaid'));
  j := pg_temp.beat(b.world_id, b.uid);
  insert into said values ('HEAVY_BEAT', coalesce(j->>'hurt_heavy', 'unsaid'));
end $t$;
select k || '=' || v from said order by k;
rollback;
`);

const said = new Map<string, string>();
for (const line of out.split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) said.set(line.slice(0, i), line.slice(i + 1));
}
const get = (k: string): string => said.get(k) ?? 'MISSING';
const SPAWN_AT = `${SPAWN + 0.5},${SPAWN + 0.5}`;

check('never died: no fall on the row', get('LIVE') === 'null', get('LIVE'));
const [at, row, now] = get('ROW').split('|');
const onRow = fellIn(JSON.parse(row ?? 'null'));
check('a death: the body on the spawn, on the ground floor, as before', at === `${SPAWN_AT},0`, at);
check(`  and where it fell on its row, ${FALL.x},${FALL.y} on the ground floor, at the death's instant`,
  !!onRow && onRow.x === FALL.x && onRow.y === FALL.y && onRow.level === 0 && now === 'true', `${row} ${now}`);
const beat = fellIn(JSON.parse(get('BEAT')));
check('the beat says it, as the browser reads it', !!beat && beat.x === FALL.x && beat.y === FALL.y && beat.level === 0, get('BEAT'));
check('  and again on the next', get('BEAT_AGAIN') === get('BEAT'), get('BEAT_AGAIN'));
check('the browser draws it lain there while it is on the spawn', lyingAt(beat, { x: SPAWN + 0.5, y: SPAWN + 0.5, level: 0 }, { x: SPAWN, y: SPAWN }) === beat);
check('  and not off it, nor up a storey, nor aboard', !lyingAt(beat, { x: SPAWN + 1.5, y: SPAWN + 0.5, level: 0 }, { x: SPAWN, y: SPAWN })
  && !lyingAt(beat, { x: SPAWN + 0.5, y: SPAWN + 0.5, level: 1 }, { x: SPAWN, y: SPAWN }) && !lyingAt(beat, { x: SPAWN + 0.5, y: SPAWN + 0.5, level: 0, aboard: 3 }, { x: SPAWN, y: SPAWN }));
check('a stay: the fall gone', get('STAY') === 'null', get('STAY'));
check('a death a storey up: the fall on that storey, the body on the ground floor', get('UP') === '1,0', get('UP'));
check('a stone picked: the fall gone', get('STONE') === 'null', get('STONE'));
check('a step off the spawn: gone from the row, and from the beats after the one that finds it', get('STEPPED') === 'null|null', get('STEPPED'));

check('a plain blow that lands is not a heavy one', get('PLAIN') === 'true|false', get('PLAIN'));
const [landed, heavy, died, line] = get('HEAVY').split('|');
check('an ogre\'s heavy blow that lands is marked a heavy one', landed === 'true' && heavy === 'true', get('HEAVY'));
check('  said in its line as the browser reads it', heavyOf(line ?? ''), line);
check('  and the beat says so', died === 'true' || get('HEAVY_BEAT') === 'true', `${get('HEAVY_BEAT')} (died: ${died})`);
check('heavyOf: a plain blow\'s line is not one', !heavyOf('The ogre is on you. Wound: a cut to the chest.'));

finish('A body lies where it fell; a heavy blow is marked');
