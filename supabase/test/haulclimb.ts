/**
 * Riding and pulling teach climbing.
 *
 * Asked for: "fix it so riding and pulling teach climbing". A Thistlekit's level is its climbing, and the island paid
 * none: not under a rider, not in the traces. Now every tile gone into on the ground is a go of climbing at `haulLearn`
 * of its rise, the island's `haul_learn_of`, to the mount under its rider and to every beast in the traces of a pulled
 * cart that keeps climbing there (`tracesSkill`); a Cartling, which learns driving by pulling, is paid that and no
 * climbing.
 *
 * Asks that the numbers and the rule are the browser's on the island; that in the browser a Thistlekit in the traces
 * with no climbing yet learns it; and, on the island in a rolled-back transaction, that a Thistlekit ridden four tiles
 * learns four goes, more up a slope than on the flat, nothing standing; that one at heel learns nothing; and that in a
 * large cart's traces a Thistlekit learns climbing and a Cartling none.
 *
 * Runs against the database the suite leaves behind: Faraway, and Ivar on it.
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { HAUL_LEARN, HAUL_LEARN_RISE, HAUL_LEARN_STEEP, HAUL_SKILL, haulLearn, SPECIES, tracesSkill } from '../../src/game/creatures';

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

/* ---- the rule, on both sides ---------------------------------------------- */

const RISES = [0, 3, 6, 12, 24, 100];
const isleRule = psql(`select haul_learn() || '|' || haul_learn_steep() || '|' || haul_learn_rise() || '|'
  || (select string_agg(haul_learn_of(r)::text, ',' order by o) from unnest(array[${RISES.join(',')}]::double precision[]) with ordinality t(r, o))`);
const [hl, hs, hr, of] = isleRule.split('|');
check('haul_learn, haul_learn_steep and haul_learn_rise are the browser\'s on the island',
  Number(hl) === HAUL_LEARN && Number(hs) === HAUL_LEARN_STEEP && Number(hr) === HAUL_LEARN_RISE, isleRule);
check(`haul_learn_of is the browser's haulLearn at rises ${RISES.join(', ')}`,
  of.split(',').every((v, i) => Math.abs(Number(v) - haulLearn(RISES[i])) < 1e-12), `${of} vs ${RISES.map(haulLearn).join(',')}`);
check('a Thistlekit, a Gorral and a Shaggan keep climbing in the traces; a Cartling its driving',
  ['orse', 'gorral', 'shaggan'].every((k) => tracesSkill(SPECIES[k]) === HAUL_SKILL) && tracesSkill(SPECIES.roxxen) !== HAUL_SKILL);

/* ---- the browser --------------------------------------------------------- */

{
  const g = Game.create(4747);
  const c = g.creatures.spawn('orse', g.player.x, g.player.y, 'active', g.rand, g.time - 3600 * 24);
  delete c.skills[HAUL_SKILL];
  g.player.dirX = 1;
  g.player.dirY = 0;
  g.workClimb(c, 1);
  check('in the browser a tile teaches a Thistlekit with no climbing yet some', (c.skills[HAUL_SKILL] ?? 0) > 1, JSON.stringify(c.skills));
}

/* ---- the island ----------------------------------------------------------- */

const IVAR = `(select uid from player where world_id = (select id from world where name = 'Faraway') and name = 'Ivar')`;
const out = psql(`
begin;
create temp table said (k text, v text);
select set_config('request.jwt.claims', json_build_object('sub', ${IVAR})::text, true) \\g /dev/null
do $t$
declare w uuid; u uuid; gx int; gy int; v_kit int; v_heel int; v_hauled bigint; v_tk int; v_cart int; v_climbs double precision[];
begin
  select id into w from world where name = 'Faraway';
  select uid into u from player where world_id = w and name = 'Ivar';
  -- Flat grass, and to the south a rise of 3 a tile going east.
  for gx in 12..34 loop for gy in 15..27 loop
    perform land_set_height(w, gx, gy, case when gy >= 24 then 4 + 3 * greatest(0, gx - 20) else 4 end);
    perform land_set_tile(w, gx, gy, tile_id('Grass'));
  end loop; end loop;
  update creature set rider = null where world_id = w and rider = u;
  delete from placed where world_id = w and driver = u;
  update player set x = 20.5, y = 21.5, level = 0, aboard = null, away = false,
         moved_at = now() - interval '10 seconds', body_at = now() where world_id = w and uid = u;

  -- Up on a Thistlekit with no climbing, and another at heel.
  v_kit := creature_spawn(w, 'orse', 20.5, 21.5, 'active', now() - interval '60 days', u);
  v_heel := creature_spawn(w, 'orse', 20.5, 22.5, 'active', now() - interval '60 days', u);
  update creature set hunger = 1, traits = '{}', skills = '{}' where world_id = w and id in (v_kit, v_heel);
  update creature set rider = u where world_id = w and id = v_kit;
  insert into said select 'BOUNDS', skill_gain_of(1, haul_learn_of(0) * beast_mul(c, 'learn') * learn_pace(c, 'climbing'), 0.6)
    || '|' || skill_gain_of(1, haul_learn_of(0) * beast_mul(c, 'learn') * learn_pace(c, 'climbing'), 1.4) from creature c where c.world_id = w and c.id = v_kit;

  -- Four tiles east on the flat.
  perform rpc_move(w, 24.5, 21.5, 0);
  insert into said select 'MOVED', x::text from player where world_id = w and uid = u;
  insert into said select 'FLAT', coalesce(skills->>'climbing', '-') from creature where world_id = w and id = v_kit;
  insert into said select 'HEEL', coalesce(skills->>'climbing', '-') from creature where world_id = w and id = v_heel;

  -- And a walk that goes nowhere.
  update player set moved_at = now() - interval '10 seconds', body_at = now() where world_id = w and uid = u;
  perform rpc_move(w, 24.5, 21.5, 0);
  insert into said select 'STILL', coalesce(skills->>'climbing', '-') from creature where world_id = w and id = v_kit;

  -- Four tiles east up the rise, from no climbing again.
  update creature set skills = '{}' where world_id = w and id = v_kit;
  update player set x = 20.5, y = 25.5, moved_at = now() - interval '10 seconds', body_at = now() where world_id = w and uid = u;
  update creature set from_x = 20.5, from_y = 25.5, to_x = 20.5, to_y = 25.5 where world_id = w and id = v_kit;
  v_climbs := walk_climbs(w, 20.5, 25.5, 24.5, 25.5);
  insert into said values ('CLIMBS', array_to_string(v_climbs, ','));
  perform rpc_move(w, 24.5, 25.5, 0);
  insert into said select 'UPX', x::text from player where world_id = w and uid = u;
  insert into said select 'UP', coalesce(skills->>'climbing', '-') from creature where world_id = w and id = v_kit;

  -- Off it, and on the seat of a large cart with a Thistlekit and a Cartling in its yokes.
  update creature set rider = null where world_id = w and id = v_kit;
  update player set x = 20.5, y = 18.5, moved_at = now() - interval '10 seconds', body_at = now() where world_id = w and uid = u;
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql, driver)
    values (w, 'furniture', 'large_cart', 20, 18, 20.5, 18.5, 50, u) returning id into v_hauled;
  v_tk := creature_spawn(w, 'orse', 22.5, 18.5, 'active', now() - interval '60 days', u);
  v_cart := creature_spawn(w, 'roxxen', 22.5, 19.5, 'active', now() - interval '60 days', u);
  update creature set hitched_to = v_hauled, hunger = 1, traits = '{}', skills = '{}' where world_id = w and id in (v_tk, v_cart);
  insert into said values ('SPEED', vehicle_speed(w, v_hauled)::text);
  perform rpc_move(w, 24.5, 18.5, 0);
  insert into said select 'PULLX', x::text from player where world_id = w and uid = u;
  insert into said select 'PULLED', coalesce(skills->>'climbing', '-') from creature where world_id = w and id = v_tk;
  insert into said select 'CARTLING', coalesce(skills->>'climbing', '-') || '|' || coalesce(skills->>'driving', '-')
    from creature where world_id = w and id = v_cart;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const say = (k: string): string => isle.get(k) ?? 'unsaid';
const [lo, hi] = say('BOUNDS').split('|').map(Number);
const gained = (k: string): number => Number(say(k)) - 1;

check('on the island the rider goes the four tiles', Number(say('MOVED')) === 24.5, say('MOVED'));
check('on the island a Thistlekit ridden four tiles on the flat learns four goes of climbing',
  gained('FLAT') >= 4 * lo * 0.999 && gained('FLAT') <= 4 * hi * 1.001,
  `climbing ${say('FLAT')} (+${(4 * lo).toFixed(5)} to +${(4 * hi).toFixed(5)})`);
check('on the island standing on it teaches nothing', say('STILL') === say('FLAT'), `${say('FLAT')} → ${say('STILL')}`);
check('on the island one at heel learns nothing', say('HEEL') === '-', say('HEEL'));
const climbs = say('CLIMBS').split(',').map(Number);
check('on the island the rise is four tiles going up', climbs.length === 4 && climbs.every((c) => c > 0) && Number(say('UPX')) === 24.5,
  `${say('CLIMBS')}, to ${say('UPX')}`);
const steep = climbs.reduce((a, c) => a + haulLearn(c), 0) / (4 * haulLearn(0));
check(`on the island the same four tiles up the rise teach about ×${steep.toFixed(2)} what the flat does`,
  gained('UP') >= steep * 4 * lo * 0.97 && gained('UP') <= steep * 4 * hi * 1.03 && gained('UP') > gained('FLAT') * 0.6,
  `climbing ${say('UP')} vs ${say('FLAT')} on the flat`);
check('on the island the large cart is pulled the four tiles', Number(say('SPEED')) > 0 && Number(say('PULLX')) === 24.5,
  `team pace ${say('SPEED')}, to ${say('PULLX')}`);
check('on the island a Thistlekit in the traces learns four goes of climbing',
  gained('PULLED') >= 4 * lo * 0.999 && gained('PULLED') <= 4 * hi * 1.001, `climbing ${say('PULLED')}`);
const [cc, cd] = say('CARTLING').split('|');
check('on the island a Cartling beside it learns driving and no climbing', cc === '-' && Number(cd) > 1, say('CARTLING'));

for (const l of [...ok, ...bad]) console.log(l);
console.log(`riding and pulling teach climbing — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
