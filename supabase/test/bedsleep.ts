/**
 * Sleep logs you off in a bed, and the sleep bonus (`src/game/sleep.ts`; `last_refusal`, `sleep_fall`,
 * `private.sleep_wake`, `rpc_sleep_bonus`, `body_settle`, `skill_mult` and the beat on the island).
 *
 * Asked for: "beds say 'sleep over the night' when they should operate like wurm beds, logging the player off
 * and beginning the stage of sleep bonus gain while the player is offline". So this asks, of the island:
 *
 *   * Sleep at noon on a bed of yours is allowed; refused on what is not a bed, out of reach, on a stranger's
 *     bed off any settlement of yours, with another job going, in a fight (something wild hunting you) and
 *     mounted, in those words; a citizen may sleep in a bed on the settlement, a stranger may not;
 *   * done through the doors (`rpc_act`, the job settled): wind full, logged off (`away`), asleep in that bed,
 *     "Asleep in bed." said; the beat then says `asleep` and leaves the body logged off; nothing is asked of it
 *     ("Asleep."), and the sleep bonus will not switch;
 *   * six hours asleep, the next `rpc_join` wakes it where it lay down beside the bed, adds `sleepBanked` of
 *     six hours at the bed's `sleepRate` and says `sleptSaid`; two days asleep stop at `SLEEP_BONUS_CAP`;
 *     with the ground where it lay down turned to rock it wakes on a free tile round the bed; with the bed gone,
 *     where the bed stood; and logged off anywhere else nothing is gained;
 *   * switched on (`rpc_sleep_bonus`), skill gain is ×`SLEEP_BONUS_MULT` (`skill_mult`, and a real
 *     `skill_raise`), the line is `sleepSwitchSaid`, and a minute on the island drains a minute; switched off,
 *     a minute drains nothing and skill gain is ×1; and the beat says `sleep_on`;
 *
 * and of the browser, the same rules (`Sleep`'s check and perform, `skillMult`, the drain in `update`), and the
 * island's words and numbers against `sleep.ts`'s.
 *
 * Makes its own island and rolls it back.
 *
 *   npx esbuild supabase/test/bedsleep.ts --bundle --platform=node --format=esm --external:typescript \
 *     --outfile=node_modules/.cache/bedsleep.mjs --log-level=error && node node_modules/.cache/bedsleep.mjs
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { Game } from '../../src/game/game';
import { furnitureDef } from '../../src/game/furniture';
import {
  asleepIn, SLEEP_BONUS_CAP, SLEEP_BONUS_MULT, SLEEP_SAID, sleepBanked, sleepHm, sleepNotYours, sleepRate,
  sleepSwitchSaid, sleptSaid,
} from '../../src/game/sleep';
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
const near = (a: number, b: number, eps = 0.5): boolean => Math.abs(a - b) <= eps;

/* ---- the island ------------------------------------------------------------------------------------------------ */

const ME = 'bed00000-0000-4000-8000-000000000001';
const CIT = 'bed00000-0000-4000-8000-000000000002';
const STR = 'bed00000-0000-4000-8000-000000000003';
/** The bed, made by ME on ME's settlement, QL 50; where ME lies down beside it; and a stranger's bed off it. */
const BED = { x: 40, y: 40, ql: 50 };
const LIE = { x: 40.5, y: 41.5 };
const THEIRS = { x: 80, y: 80 };
const BED_FACTOR = furnitureDef('bed').bed ?? 1;
const RATE = sleepRate(BED_FACTOR, BED.ql);
const SIX = 6 * 3600;

const out = psql(`
begin;
create temp table said (k text, v text);
-- As somebody, with nothing paced against them yet.
create function pg_temp.as_(u uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  delete from caller where uid = u;
end $f$;
create function pg_temp.why(w uuid, u uuid, t jsonb) returns text language sql as $f$
  select coalesce(act_refusal(w, u, 'sleep', t), 'ALLOWED')
$f$;
-- Sleep through the doors: asked, the job's time put behind it, and settled as the beat settles it.
create function pg_temp.sleep(w uuid, u uuid, bed bigint) returns text language plpgsql as $f$
declare j jsonb;
begin
  perform pg_temp.as_(u);
  j := rpc_act(w, 'sleep', jsonb_build_object('kind', 'furniture', 'id', bed), 1);
  update player set act_ends = now() - interval '1 second' where world_id = w and uid = u;
  perform settle(w, u);
  return coalesce(j->>'why', 'started');
end $f$;
-- Come back: the join, and where the body is, what is stored, and the last line.
create function pg_temp.wake(w uuid, u uuid) returns text language plpgsql as $f$
begin
  perform pg_temp.as_(u);
  perform rpc_join(w, null);
  return (select p.x || ',' || p.y || ',' || coalesce(p.level, 0) || '|' || p.rested || '|' || p.away
            || '|' || (select e.text from event e where e.world_id = w and e.uid = u and e.text like 'Slept %' order by e.n desc limit 1)
            from player p where p.world_id = w and p.uid = u);
end $f$;
do $t$
declare w uuid; me uuid := '${ME}'; cit uuid := '${CIT}'; str uuid := '${STR}'; v_bed bigint; v_theirs bigint; v_chest bigint;
        j jsonb; v_a double precision; v_b double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Bedside', 4249, 128, 20, 20, true) returning id into w;
  perform land_blank(w, 128);
  perform pg_temp.as_(cit); perform rpc_join(w, 'Cyne');
  perform pg_temp.as_(str); perform rpc_join(w, 'Stray');
  perform pg_temp.as_(me); perform rpc_join(w, 'Mearh');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Ashford', ${BED.x}, ${BED.y}, 5, 1, me);
  insert into deed_member (world_id, founder, uid, role) values (w, me, cit, 'guest');
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, level, made_by)
    values (w, 'furniture', 'bed', ${BED.x}, ${BED.y}, 0, 0, ${BED.x} + 0.375, ${BED.y} + 0.25, ${BED.ql}, 0, me) returning id into v_bed;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, level, made_by)
    values (w, 'furniture', 'bed', ${THEIRS.x}, ${THEIRS.y}, 0, 0, ${THEIRS.x} + 0.375, ${THEIRS.y} + 0.25, 50, 0, str) returning id into v_theirs;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, level, made_by)
    values (w, 'furniture', 'chest', ${BED.x + 1}, ${BED.y}, 0, 0, ${BED.x + 1} + 0.25, ${BED.y} + 0.25, 50, 0, me) returning id into v_chest;
  update player set x = ${LIE.x}, y = ${LIE.y}, level = 0, stats = jsonb_set(stats, '{stamina}', '0.2'),
         rested = 0, sleep_on = false, body_at = now(), moved_at = now() where world_id = w and uid in (me, cit, str);
  update player set x = ${THEIRS.x} + 0.5, y = ${THEIRS.y} + 1.5 where world_id = w and uid = str;
  -- Noon.
  update world set epoch = now() - make_interval(secs => 12 / 24.0 * day_seconds()) where id = w;

  -- 1. Refused and allowed.
  insert into said values ('CLOCK', world_clock(w));
  insert into said values ('MINE', pg_temp.why(w, me, jsonb_build_object('kind', 'furniture', 'id', v_bed)));
  insert into said values ('CHEST', pg_temp.why(w, me, jsonb_build_object('kind', 'furniture', 'id', v_chest)));
  insert into said values ('FAR', pg_temp.why(w, me, jsonb_build_object('kind', 'furniture', 'id', v_theirs)));
  update player set x = ${THEIRS.x} + 1.5, y = ${THEIRS.y} + 1.5 where world_id = w and uid = me;
  insert into said values ('THEIRS', pg_temp.why(w, me, jsonb_build_object('kind', 'furniture', 'id', v_theirs)));
  insert into said values ('THEIRS_OWN', pg_temp.why(w, str, jsonb_build_object('kind', 'furniture', 'id', v_theirs)));
  update player set x = ${LIE.x}, y = ${LIE.y} where world_id = w and uid in (me, cit, str);
  insert into said values ('CITIZEN', pg_temp.why(w, cit, jsonb_build_object('kind', 'furniture', 'id', v_bed)));
  insert into said values ('STRANGER', pg_temp.why(w, str, jsonb_build_object('kind', 'furniture', 'id', v_bed)));
  update player set act = 'dig', act_target = '{}'::jsonb where world_id = w and uid = me;
  insert into said values ('BUSY', pg_temp.why(w, me, jsonb_build_object('kind', 'furniture', 'id', v_bed)));
  update player set act = null, act_target = null where world_id = w and uid = me;
  insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, health, sex, hunting) values
    (w, 9801, 'shaggan', 'Hunter', 'wild', ${LIE.x + 3}, ${LIE.y}, ${LIE.x + 3}, ${LIE.y}, 90, 'female', me);
  insert into said values ('FIGHT', pg_temp.why(w, me, jsonb_build_object('kind', 'furniture', 'id', v_bed)));
  delete from creature where world_id = w and id = 9801;
  insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, health, sex, keeper, rider) values
    (w, 9802, 'shaggan', 'Mount', 'active', ${LIE.x}, ${LIE.y}, ${LIE.x}, ${LIE.y}, 90, 'female', me, me);
  insert into said values ('MOUNTED', pg_temp.why(w, me, jsonb_build_object('kind', 'furniture', 'id', v_bed)));
  delete from creature where world_id = w and id = 9802;

  -- 2. Asleep, through the doors.
  insert into said values ('ASK', pg_temp.sleep(w, me, v_bed));
  insert into said values ('FELL', (select away || '|' || (stats->>'stamina') || '|' || x || ',' || y from player where world_id = w and uid = me));
  insert into said values ('FELL_LINE', (select text from event where world_id = w and uid = me order by n desc limit 1));
  insert into said values ('RECORD', (select bed || '|' || name || '|' || rate from private.asleep where world_id = w and uid = me));
  perform pg_temp.as_(me);
  j := rpc_settle(null, w, null, false, null);
  insert into said values ('BEAT', coalesce(j->>'asleep', 'NONE') || '|' || (select away from player where world_id = w and uid = me));
  insert into said values ('ASLEEP_ASK', coalesce(act_refusal(w, me, 'set_home', jsonb_build_object('kind', 'furniture', 'id', v_bed)), 'ALLOWED'));
  perform pg_temp.as_(me);
  insert into said values ('ASLEEP_SWITCH', coalesce(rpc_sleep_bonus(w, true)->>'why', 'SWITCHED'));

  -- 3. Six hours asleep, then the join.
  update private.asleep set at = now() - make_interval(secs => ${SIX}) where world_id = w and uid = me;
  insert into said values ('WAKE6', pg_temp.wake(w, me));
  insert into said values ('AFTER', (select count(*) from private.asleep where world_id = w and uid = me)::text);

  -- 4. Two days asleep: to the cap.
  update player set x = ${LIE.x}, y = ${LIE.y} where world_id = w and uid = me;
  perform pg_temp.sleep(w, me, v_bed);
  update private.asleep set at = now() - interval '48 hours' where world_id = w and uid = me;
  insert into said values ('WAKE48', pg_temp.wake(w, me));

  -- 5. Where it lay down turned to rock: a free tile round the bed.
  update player set rested = 0, x = ${LIE.x}, y = ${LIE.y} where world_id = w and uid = me;
  perform pg_temp.sleep(w, me, v_bed);
  perform land_set_tile(w, ${Math.floor(LIE.x)}, ${Math.floor(LIE.y)}, (select id from tile_def where blocks order by id limit 1));
  insert into said values ('ROCKED', pg_temp.wake(w, me));
  insert into said values ('LANDING', (select (l.x + 0.5) || ',' || (l.y + 0.5) from respawn_landing(w, ${BED.x}, ${BED.y}) l));
  perform land_set_tile(w, ${Math.floor(LIE.x)}, ${Math.floor(LIE.y)}, 0);

  -- 6. The bed gone while asleep: where it stood.
  update player set rested = 0, x = ${LIE.x}, y = ${LIE.y} where world_id = w and uid = me;
  perform pg_temp.sleep(w, me, v_bed);
  delete from placed where id = v_bed;
  update private.asleep set at = now() - interval '1 hour' where world_id = w and uid = me;
  insert into said values ('GONE', pg_temp.wake(w, me));

  -- 7. Logged off anywhere else: nothing gained.
  update player set rested = 100, away = true, left_at = now() - interval '5 hours' where world_id = w and uid = me;
  perform pg_temp.as_(me);
  perform rpc_join(w, null);
  insert into said values ('ELSEWHERE', (select rested::text from player where world_id = w and uid = me));

  -- 8. Switched on and off: skill gain, a real raise, the drain, the line, and the beat.
  update player set rested = 3000, sleep_on = false, away = false where world_id = w and uid = me;
  insert into said values ('MULT_OFF', skill_mult(w, me, 'mining')::text);
  -- A raise off with twice the base, and one on with the base: the same roll for both.
  insert into skill (world_id, uid, id, value) values (w, me, 'mining', 20) on conflict (world_id, uid, id) do update set value = 20;
  perform setseed(0.3);
  perform skill_raise(w, me, 'mining', ${SLEEP_BONUS_MULT});
  v_a := (select value from skill where world_id = w and uid = me and id = 'mining') - 20;
  perform pg_temp.as_(me);
  j := rpc_sleep_bonus(w, true);
  insert into said values ('ON', (j->>'on') || '|' || (j->>'left'));
  insert into said values ('ON_LINE', (select text from event where world_id = w and uid = me order by n desc limit 1));
  insert into said values ('MULT_ON', skill_mult(w, me, 'mining')::text);
  insert into said values ('BONUS_ON', rest_bonus(w, me)::text);
  update skill set value = 20 where world_id = w and uid = me and id = 'mining';
  perform setseed(0.3);
  perform skill_raise(w, me, 'mining', 1);
  v_b := (select value from skill where world_id = w and uid = me and id = 'mining') - 20;
  insert into said values ('RAISE', v_a || '|' || v_b);
  perform pg_temp.as_(me);
  insert into said values ('BEAT_ON', coalesce(rpc_settle(null, w, null, false, null)->>'sleep_on', 'NONE'));
  update player set rested = 3000, rested_at = now() - interval '60 seconds', body_at = now() - interval '60 seconds'
   where world_id = w and uid = me;
  perform body_settle(w, me);
  insert into said values ('DRAIN_ON', (select rested::text from player where world_id = w and uid = me));
  perform pg_temp.as_(me);
  j := rpc_sleep_bonus(w, false);
  insert into said values ('OFF', (j->>'on') || '|' || (j->>'left'));
  insert into said values ('OFF_LINE', (select text from event where world_id = w and uid = me order by n desc limit 1));
  update player set rested_at = now() - interval '60 seconds', body_at = now() - interval '60 seconds' where world_id = w and uid = me;
  perform body_settle(w, me);
  insert into said values ('DRAIN_OFF', (select rested::text from player where world_id = w and uid = me));
  insert into said values ('MULT_OFF2', skill_mult(w, me, 'mining')::text);
  -- Used up while on: said.
  update player set sleep_on = true, rested = 30, rested_at = now() - interval '60 seconds', body_at = now() - interval '60 seconds'
   where world_id = w and uid = me;
  perform body_settle(w, me);
  insert into said values ('USED', (select rested::text from player where world_id = w and uid = me) || '|'
    || (select text from event where world_id = w and uid = me order by n desc limit 1));

  -- 9. The words and numbers, against the browser's.
  insert into said values ('HM', sleep_hm(0) || ';' || sleep_hm(59) || ';' || sleep_hm(3600) || ';' || sleep_hm(7500) || ';' || sleep_hm(18000));
  insert into said values ('RATE', sleep_rate(${BED_FACTOR}, ${BED.ql}, 0)::text || '|' || sleep_rate(0.5, 100, 0.25)::text);
  insert into said values ('SAID', sleep_slept_said(${SIX}, 9000, 9000) || ';' || sleep_switch_said(true, 7500) || ';'
    || sleep_switch_said(false, 59) || ';' || sleep_not_yours('Bed') || ';' || asleep_in('Bed'));
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
const parts = (k: string): string[] => get(k).split('|');
const at = (s: string): number[] => s.split(',').map(Number);

console.log('--- the island');
check('Sleep at noon in a bed of your own: allowed (night only is gone)', get('MINE') === 'ALLOWED', `${get('CLOCK')}: ${get('MINE')}`);
check('not a bed', get('CHEST') === 'Not a bed.', get('CHEST'));
check('out of reach', get('FAR') === 'Stand next to it.', get('FAR'));
check("a stranger's bed off any settlement of yours: refused, named", get('THEIRS') === sleepNotYours('Bed'), get('THEIRS'));
check('and its maker may', get('THEIRS_OWN') === 'ALLOWED', get('THEIRS_OWN'));
check('a citizen of the settlement it stands on may', get('CITIZEN') === 'ALLOWED', get('CITIZEN'));
check('a stranger to that settlement may not', get('STRANGER') === sleepNotYours('Bed'), get('STRANGER'));
check('with another job going: refused', get('BUSY') === SLEEP_SAID.busy, get('BUSY'));
check('in a fight: refused', get('FIGHT') === SLEEP_SAID.fight, get('FIGHT'));
check('mounted: refused', get('MOUNTED') === SLEEP_SAID.mounted, get('MOUNTED'));

const [fellAway, fellWind, fellAt] = parts('FELL');
check('asked through rpc_act and settled: logged off, wind full, where it lay down',
  get('ASK') === 'started' && fellAway === 'true' && Number(fellWind) === 1 && fellAt === `${LIE.x},${LIE.y}`, `${get('ASK')} ${get('FELL')}`);
check('said: "Asleep in bed."', get('FELL_LINE') === `${asleepIn('Bed')}.`, get('FELL_LINE'));
const [recBed, recName, recRate] = parts('RECORD');
check(`asleep in that bed, at its rate: ${RATE.toFixed(4)} a second`, !!recBed && recName === 'Bed' && near(Number(recRate), RATE, 1e-9), get('RECORD'));
check('the beat says asleep, by the bed, and leaves the body logged off', get('BEAT') === 'Bed|true', get('BEAT'));
check('asleep, nothing is asked of it', get('ASLEEP_ASK') === SLEEP_SAID.asleep, get('ASLEEP_ASK'));
check('and the sleep bonus will not switch', get('ASLEEP_SWITCH') === SLEEP_SAID.asleep, get('ASLEEP_SWITCH'));

const gain6 = sleepBanked(0, SIX, RATE);
const [w6At, w6Rest, w6Away, w6Line] = parts('WAKE6');
check(`six hours asleep: woken by the join where it lay down, back on the island, +${sleepHm(gain6)} stored`,
  w6At === `${LIE.x},${LIE.y},0` && near(Number(w6Rest), gain6, 1) && w6Away === 'false', get('WAKE6'));
check('and said, as the browser says it', w6Line === sleptSaid(SIX, gain6, gain6), `${w6Line} | ${sleptSaid(SIX, gain6, gain6)}`);
check('and the sleep is over', get('AFTER') === '0', get('AFTER'));
const [, w48Rest, , w48Line] = parts('WAKE48');
check(`two days asleep: stored to the cap, ${sleepHm(SLEEP_BONUS_CAP)}`, near(Number(w48Rest), SLEEP_BONUS_CAP, 1)
  && w48Line === sleptSaid(48 * 3600, SLEEP_BONUS_CAP - gain6, SLEEP_BONUS_CAP), `${get('WAKE48')} | ${sleptSaid(48 * 3600, SLEEP_BONUS_CAP - gain6, SLEEP_BONUS_CAP)}`);
const [rockAt] = parts('ROCKED');
const [rx, ry] = at(rockAt);
check('where it lay down turned to rock: woken on the first free tile round the bed', `${rx},${ry}` === get('LANDING') && Math.max(Math.abs(rx - BED.x), Math.abs(ry - BED.y)) < 3,
  `${rockAt} vs ${get('LANDING')}`);
const [goneAt, goneRest] = parts('GONE');
check('the bed gone while asleep: woken where it stood, with the hour asleep gained', goneAt === `${BED.x + 0.375},${BED.y + 0.25},0` && near(Number(goneRest), 3600 * RATE, 1),
  get('GONE'));
check('logged off anywhere else: nothing gained', near(Number(get('ELSEWHERE')), 100, 1e-3), get('ELSEWHERE'));

const [onOn, onLeft] = parts('ON');
check('switched on: on, and what is stored', onOn === 'true' && near(Number(onLeft), 3000, 1), get('ON'));
check('said, as the browser says it', get('ON_LINE') === sleepSwitchSaid(true, Number(onLeft)), `${get('ON_LINE')} | ${sleepSwitchSaid(true, Number(onLeft))}`);
check(`on: skill gain ×${SLEEP_BONUS_MULT} (skill_mult, rest_bonus)`, near(Number(get('MULT_ON')), Number(get('MULT_OFF')) * SLEEP_BONUS_MULT, 1e-6)
  && Number(get('BONUS_ON')) === SLEEP_BONUS_MULT, `${get('MULT_OFF')} -> ${get('MULT_ON')}, ${get('BONUS_ON')}`);
const [raiseOff, raiseOn] = parts('RAISE').map(Number);
check(`and a real raise on goes in as one off with ×${SLEEP_BONUS_MULT} the base`, raiseOff > 0 && near(raiseOn, raiseOff, 1e-9), get('RAISE'));
check('the beat says it is on', get('BEAT_ON') === 'true', get('BEAT_ON'));
check('a minute on the island, on: a minute drained', near(Number(get('DRAIN_ON')), 2940, 1.5), get('DRAIN_ON'));
const [offOn, offLeft] = parts('OFF');
check('switched off: off, said', offOn === 'false' && get('OFF_LINE') === sleepSwitchSaid(false, Number(offLeft)), `${get('OFF')} ${get('OFF_LINE')}`);
check('a minute off: nothing drained, skill gain ×1', near(Number(get('DRAIN_OFF')), Number(offLeft), 1e-3) && get('MULT_OFF2') === get('MULT_OFF'),
  `${get('DRAIN_OFF')} ${get('MULT_OFF2')}`);
check('used up while on: none left, said', get('USED') === `0|${SLEEP_SAID.used}`, get('USED'));

check('the island says a stretch of time as the browser does',
  get('HM') === [0, 59, 3600, 7500, 18000].map(sleepHm).join(';'), get('HM'));
const [rate1, rate2] = parts('RATE').map(Number);
check('and works the rate the same', near(rate1, sleepRate(BED_FACTOR, BED.ql), 1e-12) && near(rate2, sleepRate(0.5, 100, 0.25), 1e-12), get('RATE'));
check('and says the lines the same', get('SAID') === [sleptSaid(SIX, 9000, 9000), sleepSwitchSaid(true, 7500), sleepSwitchSaid(false, 59), sleepNotYours('Bed'), asleepIn('Bed')].join(';'),
  get('SAID'));

/* ---- the browser, the same rules ------------------------------------------------------------------------------- */

console.log('--- the browser');
const g = Game.create(4249, 128);
const wd = g.world;
wd.water = null;
wd.heights.fill(10);
wd.tiles.fill(TileType.Grass);
wd.data.fill(0);
for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
g.putBody(LIE.x, LIE.y, 0);
const bed = g.addFurniture('bed', BED.x, BED.y, 0, 0, BED.ql);
const chest = g.addFurniture('chest', BED.x + 1, BED.y, 0, 0, 50);
const sleep = ACTION_BY_ID.get('sleep');
const ask = (id: number): string => sleep?.check?.({ kind: 'furniture', id } as Target, g) ?? 'ALLOWED';
check('the action is "Sleep"', sleep?.label === 'Sleep', sleep?.label);
check('a bed of yours: allowed, at any hour', ask(bed.id) === 'ALLOWED', ask(bed.id));
check('not a bed', ask(chest.id) === 'Not a bed.', ask(chest.id));
bed.mine = false;
check("somebody else's bed off any settlement of yours: refused in the island's words", ask(bed.id) === sleepNotYours('Bed'), ask(bed.id));
g.deed = { name: 'Ashford', x: BED.x, y: BED.y, radius: 5, level: 1 } as never;
check('on a settlement of yours: allowed', ask(bed.id) === 'ALLOWED', ask(bed.id));
g.deed = null;
bed.mine = true;
g.action = { def: ACTION_BY_ID.get('dig'), target: { kind: 'tile', x: 1, y: 1 }, state: 'performing' } as never;
check('with another job going', ask(bed.id) === SLEEP_SAID.busy, ask(bed.id));
g.action = null;
const plain = { inAFight: g.inAFight, mounted: g.mounted };
g.inAFight = () => true;
check('in a fight', ask(bed.id) === SLEEP_SAID.fight, ask(bed.id));
g.inAFight = plain.inAFight;
g.mounted = (() => ({ id: 1 })) as never;
check('mounted', ask(bed.id) === SLEEP_SAID.mounted, ask(bed.id));
g.mounted = plain.mounted;
g.player.stats.stamina = 0.2;
let fell = '';
g.events.on('asleep', (what) => (fell = what));
sleep?.perform({ kind: 'furniture', id: bed.id } as Target, g);
check('done: wind full, asleep in the bed, and the page told', g.player.stats.stamina === 1 && g.asleep === 'Bed' && fell === 'Bed',
  `${g.player.stats.stamina} ${g.asleep} ${fell}`);
check('the boot card says "Asleep in bed"', asleepIn(fell) === 'Asleep in bed', asleepIn(fell));

g.player.rested = 3000;
g.player.sleepOn = false;
const off = g.skillMult('mining');
g.player.sleepOn = true;
const on = g.skillMult('mining');
check(`on: skill gain ×${SLEEP_BONUS_MULT}, as the island's`, near(on, off * SLEEP_BONUS_MULT, 1e-9), `${off} -> ${on}`);
g.player.rested = 0;
check('on with none stored: ×1', g.skillMult('mining') === off, String(g.skillMult('mining')));
g.player.rested = 3000;
g.rand = () => 0.5;
g.skills.values.set('mining', 20);
g.player.sleepOn = false;
const raisedOff = g.gainSkill('mining', SLEEP_BONUS_MULT);
g.skills.values.set('mining', 20);
g.player.sleepOn = true;
const raisedOn = g.gainSkill('mining', 1);
check(`a real raise on goes in as one off with ×${SLEEP_BONUS_MULT} the base`, raisedOff > 0 && near(raisedOn, raisedOff, 1e-12), `${raisedOff} ${raisedOn}`);
g.player.rested = 3000;
for (let i = 0; i < 10; i++) g.update(0.1);
check('a second on: a second drained', near(g.player.rested, 2999, 1e-6), String(g.player.rested));
g.player.sleepOn = false;
for (let i = 0; i < 10; i++) g.update(0.1);
check('a second off: nothing drained', near(g.player.rested, 2999, 1e-6), String(g.player.rested));

for (const l of [...ok, ...bad]) console.log(l);
console.log(`\n${ok.length} ok, ${bad.length} failed`);
if (bad.length) process.exit(1);
