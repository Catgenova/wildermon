/**
 * Soul strength: its uses and its sources.
 *
 * Asked for, of the Soul strength review: "1. Add to those other uses. 2. Add
 * those sources as well. 3. Keep small. 4. Fix text." Asked of both sides at
 * soul strength 20, 60 and 100:
 *
 *   * tame chance, +0.2 points a level over the starting mark (`soulBonus`,
 *     the soul term of `tame_chance`);
 *   * one multiplier, +0.125% a level (`soulAbove`, `soul_mul`), on favour per
 *     prayer, Calm per sitting, and a Beastmaster spell's heal, blow and bonus
 *     (`soulFx`, `soul_fx`): a prayer banks the same favour, a sitting the same
 *     Calm, and Lick Wounds heals the same share of its health;
 *   * a prayer, a sitting and a sacrifice at an altar each teach soul strength
 *     the one gain a taming offering does (`SOUL_GAIN`, `soul_gain`).
 *
 * Nothing frightens a player, on the island or in the browser, so there is no
 * fear for soul strength to shorten and none is asked.
 *
 * The island half runs in one transaction that is rolled back, on an island of
 * its own.
 */
import { execFileSync } from 'node:child_process';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { CHAR_START, Game, type Deed } from '../../src/game/game';
import { SKILL_TOP } from '../../src/game/skills';
import { SOUL_GAIN, tryGain } from '../../src/game/learn';
import { TAME_NERVE } from '../../src/game/creatureActions';
import { prayerWorth } from '../../src/game/faith';
import { SIT_CALM, sittingWorth } from '../../src/game/meditation';
import { soulFx, SOUL_FX } from '../../src/game/talents';

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
const near = (a: number, b: number, by = 1e-9): boolean => Math.abs(a - b) <= by;
/** Favour, Calm and health are kept in single precision on the island: a millionth either way. */

const LEVELS = [CHAR_START, 60, SKILL_TOP];
const ALTAR_QL = 50;
const PRAYING = 30;
const LICK = 'beastmaster_lick_wounds';
const SCALED = Object.entries(SOUL_FX).flatMap(([id, keys]) => Object.keys(keys).map((k) => [id, k] as const));

/* ---- the browser ---------------------------------------------------------- */
const g = Game.create(4242);
const home: Deed = { name: 'Home', x: 40, y: 40, radius: 3, level: 1, mine: true };
g.deed = home;
g.player.x = 40.5; g.player.y = 40.5;
const altar = g.addFurniture('altar', 41, 40, 0, 0, ALTAR_QL);
const at = (itemUid?: number): Target => ({ kind: 'furniture', id: altar.id, ...(itemUid === undefined ? {} : { itemUid }) } as Target);
// What each go hands soul strength to learn by: the base, before the curve and the roll.
const gains: number[] = [];
const gainSkill = g.gainSkill.bind(g);
g.gainSkill = (id: string, base?: number): number => {
  if (id === 'soul_strength') gains.push(base ?? NaN);
  return gainSkill(id, base);
};
g.skills.values.set('praying', PRAYING);
g.skills.values.set('prayer', 50);
g.skills.values.set('meditation', 50);
const pray = ACTION_BY_ID.get('pray')!;
const meditate = ACTION_BY_ID.get('meditate')!;
const sacrifice = ACTION_BY_ID.get('sacrifice')!;

const mine = LEVELS.map((L) => {
  g.skills.values.set('soul_strength', L);
  const mul = g.soulMul();
  // A prayer, from no favour; each go below raises soul strength, praying and meditation, and each is put back first.
  g.skills.values.set('praying', PRAYING);
  g.skills.values.set('meditation', 50);
  g.player.favour = 0;
  gains.length = 0;
  pray.perform(at(), g);
  const favour = g.player.favour / prayerWorth(ALTAR_QL, g.hourOfDay(), PRAYING);
  const prayed = gains[0];
  // A sitting, from no Calm.
  g.skills.values.set('soul_strength', L);
  g.player.satSpots = [];
  const worth = sittingWorth(g);
  g.player.calm = 0;
  gains.length = 0;
  meditate.perform({ kind: 'tile', x: 40, y: 40 } as Target, g);
  const calm = g.player.calm / (SIT_CALM * worth.place);
  const sat = gains[0];
  // A sacrifice: a rare plank.
  g.skills.values.set('soul_strength', L);
  const plank = g.inventory.add('plank', { ql: 40, count: 1 });
  plank.rare = 1;
  gains.length = 0;
  sacrifice.perform(at(plank.uid), g);
  const given = gains[0];
  g.skills.values.set('soul_strength', L);
  return {
    L, mul, tame: g.soulBonus(), favour, calm, worthCalm: worth.calm / (SIT_CALM * worth.place), prayed, sat, given,
    fx: Object.fromEntries(SCALED.map(([id, k]) => [`${id}.${k}`, soulFx(id, k, g.soulMul())])),
  };
});
check(`the multiplier is 1 at ${CHAR_START} and 1.1 at ${SKILL_TOP}, as asked`,
  near(mine[0].mul, 1) && near(mine[2].mul, 1.1), mine.map((m) => `${m.L}: ${m.mul}`).join(', '));
for (const m of mine) {
  check(`browser, soul strength ${m.L}: a prayer banks favour ×${m.mul}`, near(m.favour, m.mul), String(m.favour));
  check(`browser, soul strength ${m.L}: a sitting banks Calm ×${m.mul}, as its worth says`, near(m.calm, m.mul) && near(m.worthCalm, m.mul), `${m.calm} / ${m.worthCalm}`);
  check(`browser, soul strength ${m.L}: a prayer, a sitting and a sacrifice each teach soul strength ${SOUL_GAIN}, an offering's gain`,
    [m.prayed, m.sat, m.given].every((v) => v === tryGain(true, SOUL_GAIN)) && TAME_NERVE === SOUL_GAIN, `${m.prayed} / ${m.sat} / ${m.given}`);
}

/* ---- the island ----------------------------------------------------------- */
const out = psql(`
begin;
create temp table said (k text, v text);
create temp table gained (k text, base double precision);
-- What each go hands soul strength to learn by, as the browser's is read above.
create or replace function skill_told(p_world uuid, p_uid uuid, p_id text, p_base double precision) returns double precision
language plpgsql as $f$
begin
  if p_id = 'soul_strength' then insert into gained values (current_setting('soul.at', true), p_base); end if;
  return skill_raise(p_world, p_uid, p_id, p_base);
end $f$;
do $t$
declare w uuid; u uuid := '55555555-5555-5555-5555-555555555555'; L double precision; alt bigint; it bigint;
        wild int; k int; v_px double precision := 32.5; v_py double precision := 32.5; r jsonb;
        t0 double precision; t1 double precision; was double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Soul', 235, 64, 32, 32, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Ash');
  update player set x = v_px, y = v_py, act = null, act_queue = '[]', equipped = '{}'::jsonb, struck_at = null,
         stats = coalesce(stats, '{}'::jsonb) || '{"health": 1, "hunger": 1, "thirst": 1, "stamina": 1}'::jsonb
   where world_id = w and uid = u;
  insert into skill (world_id, uid, id, value)
    values (w, u, 'praying', ${PRAYING}), (w, u, 'prayer', 50), (w, u, 'meditation', 50), (w, u, 'taming', 60)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'altar', 33, 32, 0, 0, 33.5, 32.5, ${ALTAR_QL}, u) returning id into alt;
  wild := creature_spawn(w, 'roxxen', v_px + 3, v_py, 'wild', now() - interval '2 hours', null);
  update creature set traits = '{}', rare = null, hunger = 1, coaxed = 0, coaxed_at = null where world_id = w and id = wild;
  insert into said values ('offering', try_gain(true, tame_nerve())::text);

  foreach L in array array[${LEVELS.join(', ')}]::double precision[] loop
    -- Each go below raises soul strength, praying and meditation: each is put back first.
    insert into skill (world_id, uid, id, value) values (w, u, 'soul_strength', L), (w, u, 'praying', ${PRAYING}), (w, u, 'meditation', 50)
      on conflict (world_id, uid, id) do update set value = excluded.value;
    insert into said values ('mul' || L, soul_mul(w, u)::text);
    -- Tame chance: what soul strength adds over the starting mark, read through the age of the one offered to.
    select tame_chance(w, u, c), (age_row(c.born, old_of(c), age_pace(c))).tame into t1, was from creature c where c.world_id = w and c.id = wild;
    update skill set value = ${CHAR_START} where world_id = w and uid = u and id = 'soul_strength';
    select tame_chance(w, u, c) into t0 from creature c where c.world_id = w and c.id = wild;
    update skill set value = L where world_id = w and uid = u and id = 'soul_strength';
    insert into said values ('tame' || L, ((t1 - t0) / was)::text);
    insert into said values ('tamebase' || L, t0::text);
    -- A prayer, from no favour.
    update player set favour = 0, favour_at = now(), prayed_at = null where world_id = w and uid = u;
    perform set_config('soul.at', 'pray' || L, true);
    perform act_perform(w, u, 'pray', jsonb_build_object('kind', 'furniture', 'id', alt));
    insert into said select 'favour' || L, (favour / prayer_worth(${ALTAR_QL}, hour_of_day(w), ${PRAYING}))::text
      from player where world_id = w and uid = u;
    -- A sitting, from no Calm, on a spot not sat on.
    update skill set value = L where world_id = w and uid = u and id = 'soul_strength';
    update player set calm = 0, sat_at = null, struck_at = null, sat_spots = '[]'::jsonb where world_id = w and uid = u;
    select s.place into t0 from sitting_worth(w, u) s;
    insert into said select 'worth' || L, (s.calm / (sit_calm() * s.place))::text from sitting_worth(w, u) s;
    perform set_config('soul.at', 'sit' || L, true);
    perform act_perform(w, u, 'meditate', jsonb_build_object('kind', 'tile', 'x', 32, 'y', 32));
    insert into said select 'calm' || L, (p.calm / (sit_calm() * t0))::text from player p where p.world_id = w and p.uid = u;
    update skill set value = L where world_id = w and uid = u and id = 'soul_strength';
    -- A sacrifice: a rare plank.
    it := give(w, u, 'plank', 1, 40, null, 'rare');
    select value into was from skill where world_id = w and uid = u and id = 'soul_strength';
    perform set_config('soul.at', 'sacrifice' || L, true);
    perform act_perform(w, u, 'sacrifice', jsonb_build_object('kind', 'furniture', 'id', alt, 'itemUid', it));
    insert into said select 'rose' || L, (value > was)::text from skill where world_id = w and uid = u and id = 'soul_strength';
    update skill set value = L where world_id = w and uid = u and id = 'soul_strength';
    insert into said select 'soulfx' || L || ':' || f.id || '.' || f.k, soul_fx(w, u, f.id, f.k)::text
      from (values ${SCALED.map(([id, k]) => `('${id}', '${k}')`).join(', ')}) f(id, k);
  end loop;

  -- Lick Wounds, cast by a Beastmaster on a companion at half its health.
  insert into said values ('take', coalesce(rpc_take_class(w, 'beastmaster')->>'why', 'took'));
  insert into player_node (world_id, uid, node) values (w, u, '${LICK}') on conflict do nothing;
  k := creature_spawn(w, 'roxxen', v_px, v_py, 'active', now() - interval '2 hours', u);
  update creature set traits = '{}', rare = null, skills = '{}'::jsonb where world_id = w and id = k;
  foreach L in array array[${LEVELS.join(', ')}]::double precision[] loop
    update skill set value = L where world_id = w and uid = u and id = 'soul_strength';
    update creature set from_x = v_px, from_y = v_py, to_x = v_px, to_y = v_py, leg_at = now(), leg_ends = now(), until = now(),
           settled_at = now(), phase = 'idle', enemy = null, heel_until = null, stance = 'defensive', hurt_at = null
     where world_id = w and id = k;
    update creature set health = max_health(creature) / 2 where world_id = w and id = k;
    r := class_spell_cast(w, u, '${LICK}', jsonb_build_object('kind', 'self', 'uid', u));
    insert into said select 'lick' || L, (cr.health / max_health(cr) - 0.5)::text || '|' || coalesce(r->>'said', r->>'why')
      from creature cr where cr.world_id = w and cr.id = k;
  end loop;
end $t$;
select k || '=' || v from said;
select 'gain:' || k || '=' || base from gained;
rollback;
`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const num = (k: string): number => Number(isle.get(k) ?? NaN);

check('a Beastmaster is taken up on the island', isle.get('take') === 'took', isle.get('take'));
for (const m of mine) {
  check(`soul strength ${m.L}: the same multiplier on both sides`, near(num(`mul${m.L}`), m.mul), `browser ${m.mul}, island ${num(`mul${m.L}`)}`);
  check(`soul strength ${m.L}: the same tame chance added`, near(num(`tame${m.L}`), m.tame, 1e-9) && num(`tamebase${m.L}`) > 0.05 && num(`tamebase${m.L}`) < 0.7,
    `browser ${m.tame}, island ${num(`tame${m.L}`)} (over ${num(`tamebase${m.L}`)})`);
  check(`soul strength ${m.L}: a prayer banks the same favour`, near(num(`favour${m.L}`), m.favour, 1e-6), `browser ×${m.favour}, island ×${num(`favour${m.L}`)}`);
  check(`soul strength ${m.L}: a sitting banks the same Calm`, near(num(`calm${m.L}`), m.calm, 1e-6) && near(num(`worth${m.L}`), m.worthCalm, 1e-9),
    `browser ×${m.calm}, island ×${num(`calm${m.L}`)} (worth ×${num(`worth${m.L}`)})`);
  const wrong = SCALED.filter(([id, k]) => !near(num(`soulfx${m.L}:${id}.${k}`), m.fx[`${id}.${k}`]));
  check(`soul strength ${m.L}: every Beastmaster heal, blow and bonus the same on both sides`, wrong.length === 0,
    wrong.map(([id, k]) => `${id}.${k}: browser ${m.fx[`${id}.${k}`]}, island ${num(`soulfx${m.L}:${id}.${k}`)}`).join('; ') || `${SCALED.length} numbers`);
  const [share, line] = (isle.get(`lick${m.L}`) ?? '|').split('|');
  check(`soul strength ${m.L}: Lick Wounds heals ${m.fx[`${LICK}.heal`]} of its health on the island, as the browser says`,
    near(Number(share), m.fx[`${LICK}.heal`], 1e-6), `${share} — ${line}`);
  const taught = ['pray', 'sit', 'sacrifice'].map((k) => num(`gain:${k}${m.L}`));
  check(`soul strength ${m.L}: on the island a prayer, a sitting and a sacrifice each teach soul strength an offering's gain, the browser's`,
    taught.every((v) => near(v, num('offering')) && near(v, tryGain(true, SOUL_GAIN))) && isle.get(`rose${m.L}`) === 'true',
    `${taught.join(' / ')} (offering ${num('offering')}, rose ${isle.get(`rose${m.L}`)})`);
}

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`soul strength — ${ok.length} of ${ok.length}`);
