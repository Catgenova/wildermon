/**
 * Ropemaking (`ropework.ts`), on both sides.
 *
 * Asked for: rope per lay-up 1, +1 per 30 levels; time per action −0.5% per
 * level on ropemaking; above 50 a failed lay-up loses half the fibre (here:
 * damages half its units, a failed go losing nothing); a rope walk where a
 * lay-up takes 0.6 of the time and comes out 5 QL better; rope QL carried
 * into a boat at 15% and a trap at 25%; twine, sailcloth (in the sails of a
 * sailing boat and a caravel), a hammock (rest 0.75), a bell rope (needed to
 * ring, its QL how far the ring is heard), a lead rope (a mount with no saddle
 * and bridle at 0.8 of its pace) and a twine snare (used up by its first
 * catch). Checked here, the island against the browser's numbers, with every
 * roll pinned. Runs against the database the suite leaves behind, rolled back.
 *
 *   npx esbuild supabase/test/ropework.ts --bundle --platform=node --format=esm --packages=external \
 *     --outfile=node_modules/.cache/ropework.mjs && node node_modules/.cache/ropework.mjs
 */
import {
  BELL_ROPE, bellHeard, bellRangSaid, HAMMOCK_REST, LAY_UP_SPARE_ABOVE, LEAD_PACE, LEAD_ROPE, NO_BELL_ROPE, noTackSaid, ROPE_SHARE_BOAT, ROPE_SHARE_TRAP,
  ROPE_WALK, ROPE_WALK_QL, ROPE_WALK_TIME, ropeBlend, ropeFailUnits, ropePerLayUp, ropeTime, TWINE_MADE,
} from '../../src/game/ropework';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { furnitureDef } from '../../src/game/furniture';
import { TRAPS } from '../../src/game/trapdefs';
import { failDamage } from '../../src/game/faildamage';
import { psql, check, finish } from './harness';

const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;
const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps;

/** What the hands make, pinned, so that the rope's share and the rope walk's QL are all that move it. */
const HANDS = 40;
const ROPE_QL = 90;
const SKILL = 60;
const LOW = 40;
const FIBRE_QL = 50;
const BELL_QL = 50;
const LEVELS = [0, 1, 29, 30, 59, 60, 89, 90, 100, 120];

/* ---- the numbers, on both sides ------------------------------------------------------- */

const nums = psql(`select string_agg(rope_per_lay_up(v) || '/' || rope_time(v) || '/' || rope_fail_units(4, v), ' ' order by v)
  from unnest(array[${LEVELS.join(', ')}]::double precision[]) v`).split(' ').map((s) => s.split('/').map(Number));
check('rope per lay-up, ropemaking time and a failed lay-up\'s units, at every level, the same on both sides',
  nums.length === LEVELS.length && LEVELS.every((v, i) => nums[i][0] === ropePerLayUp(v) && near(nums[i][1], ropeTime(v)) && nums[i][2] === ropeFailUnits(4, v))
    && ropePerLayUp(1) === 1 && ropePerLayUp(30) === 2 && ropePerLayUp(90) === 4 && near(ropeTime(100), 0.5)
    && ropeFailUnits(4, LAY_UP_SPARE_ABOVE) === 4 && ropeFailUnits(4, LAY_UP_SPARE_ABOVE + 1) === 2,
  JSON.stringify(nums));
const consts = psql(`select rope_walk_time() || '|' || rope_walk_ql_more() || '|' || bell_heard(0) || '|' || bell_heard(${BELL_QL}) || '|' || bell_heard(100)
  || '|' || lead_pace() || '|' || rope_lay_up('make_rope') || rope_lay_up('make_thick_rope') || rope_lay_up('make_net')`);
check('the rope walk, the bell rope and the lead rope priced the same on both sides',
  consts === [ROPE_WALK_TIME, ROPE_WALK_QL, bellHeard(0), bellHeard(BELL_QL), bellHeard(100), LEAD_PACE, 'truetruefalse'].join('|'), consts);
const rows = psql(`select
  (select string_agg(id || ':' || rope_share, ',' order by id) from recipe where rope_share is not null) || '|' ||
  (select count || ':' || (select string_agg(item || ' ' || count, ',' order by ord) from recipe_input where recipe = 'make_twine') from recipe where id = 'make_twine') || '|' ||
  (select station || ':' || skill || ':' || (select string_agg(item || ' ' || count, ',' order by ord) from recipe_input where recipe = 'make_sailcloth') from recipe where id = 'make_sailcloth') || '|' ||
  (select string_agg(recipe || ' ' || count, ',' order by recipe) from recipe_input where item = 'sailcloth' and recipe in ('make_sailing_boat', 'make_caravel')) || '|' ||
  (select count(*) from recipe_input where item = 'cloth' and recipe in ('make_sailing_boat', 'make_caravel')) || '|' ||
  (select bed from furniture_def where id = 'hammock') || '|' ||
  (select w || 'x' || h from furniture_def where id = ${q(ROPE_WALK)}) || '|' ||
  (select once || ':' || holds from trap_def where id = 'twine_snare')`);
const shares = [...RECIPE_BY_ID.values()].filter((r) => r.ropeShare).map((r) => `${r.id}:${r.ropeShare}`).sort().join(',');
const twine = RECIPE_BY_ID.get('make_twine')!;
const sail = RECIPE_BY_ID.get('make_sailcloth')!;
const want = [
  shares,
  `${TWINE_MADE}:${twine.inputs.map((i) => `${i.item} ${i.count}`).join(',')}`,
  `${sail.station}:${sail.skill}:${sail.inputs.map((i) => `${i.item} ${i.count}`).join(',')}`,
  ['make_caravel', 'make_sailing_boat'].map((r) => `${r} ${Object.fromEntries(furnitureDef(r.slice(5)).bill).sailcloth}`).join(','),
  '0', `${HAMMOCK_REST}`, `${furnitureDef(ROPE_WALK).w}x${furnitureDef(ROPE_WALK).h}`, `true:${TRAPS.twine_snare.holds}`,
].join('|');
check('the recipes, the sails, the hammock, the rope walk and the twine snare as the browser has them',
  rows === want && shares.includes(`make_rowing_boat:${ROPE_SHARE_BOAT}`) && shares.includes(`make_snare:${ROPE_SHARE_TRAP}`)
    && shares.includes(`make_creel:${ROPE_SHARE_TRAP}`),
  `island ${rows}\nbrowser ${want}`);

/* ---- on the island ---------------------------------------------------------------------- */

const skillAt = (id: string, v: number): string =>
  `insert into skill (world_id, uid, id, value) values (w, u, '${id}', ${v}) on conflict (world_id, uid, id) do update set value = excluded.value`;
const craft = (r: string): string => `perform perform_craft(w, u, '${r}', jsonb_build_object('kind', 'item', 'uid', null))`;
const pack = `delete from item where world_id = w and holder in ('player', 'bag') and holder_uid = u`;
const passes = (pass: boolean): string =>
  `create or replace function skill_check(p_skill double precision, p_difficulty double precision,
     p_tool_ql double precision default 0, p_ease double precision default 0)
     returns boolean language sql as 'select ${pass}'`;
const said = `coalesce((select string_agg(e.text, '#' order by e.n) from event e where e.world_id = w and e.uid = u and e.kind in ('event', 'error')), '')`;

const out = psql(`
begin;
create temp table said (k text, v text);
create function pg_temp.secs(w uuid, u uuid, a text, t jsonb) returns double precision language plpgsql as $f$
declare j jsonb; v double precision;
begin
  update player set act = null, act_target = null, act_started = null, act_ends = null, act_left = null,
         act_goes = null, act_queue = '[]' where world_id = w and uid = u;
  delete from caller where uid = u;
  j := rpc_act(w, a, t);
  select extract(epoch from act_ends - act_started) into v from player where world_id = w and uid = u;
  update player set act = null, act_target = null, act_started = null, act_ends = null, act_left = null,
         act_goes = null, act_queue = '[]' where world_id = w and uid = u;
  return v;
end $f$;
create or replace function product_ql(p_skill double precision, p_tool_ql double precision default 0)
  returns double precision language sql as 'select ${HANDS}::double precision';
-- No skill moves while a go is measured: Ropemaking stays where it is put.
create or replace function skill_raise(p_world uuid, p_uid uuid, p_id text, p_base double precision) returns double precision language sql as 'select 0::double precision';
create or replace function rarity_roll_from(p_units int[], p_first double precision) returns text language sql as 'select null::text';
${passes(true)};

do $$
declare w uuid; u uuid; v_walk bigint; v_bell bigint; v_c int; v_far int; v_t bigint; v_rider int; a double precision; b double precision;
begin
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  ${pack};
  delete from player_node where world_id = w and uid = u;
  delete from placed where world_id = w and x between 4 and 16 and y between 4 and 16;
  delete from event where world_id = w and uid = u;
  update creature set rider = null where world_id = w and rider = u;
  update player set x = 9.5, y = 9.5, level = 0, aboard = null, act = null, act_target = null, act_started = null, act_ends = null,
         act_left = null, act_goes = null, act_queue = '[]', craft_class = null, combat_class = null,
         class_mul = null, level_h = null, rested = 0, boons = '[]'::jsonb, body_at = now(), swim_at = now(),
         equipped = '{}'::jsonb, craft_from_stores = false, craft_spare_rare = false, wounds = '[]'::jsonb,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w and uid = u;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  ${skillAt('ropemaking', SKILL)};
  ${skillAt('carpentry', SKILL)};

  /* ---- a lay-up at Ropemaking ${SKILL}: its count; then at a rope walk, its QL ---- */
  perform give(w, u, 'rope_tool', 1, 50);
  perform give(w, u, 'wemp', 4, 30);
  ${craft('make_rope')};
  insert into said select 'LAYUP', coalesce(sum(count), 0) || ':' || coalesce(max(ql), 0) from item where world_id = w and holder = 'player' and holder_uid = u and def = 'rope';
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def = 'rope';
  perform give(w, u, 'wemp', 4, 30);
  insert into said values ('PACE', pg_temp.secs(w, u, 'make_rope', jsonb_build_object('kind', 'item', 'uid', null))::text);
  insert into said values ('NOWALK', rope_pace(w, u, 'make_rope', 'ropemaking') || ':' || rope_pace(w, u, 'make_net', 'ropemaking') || ':' || rope_pace(w, u, 'make_rope', 'carpentry'));
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', ${q(ROPE_WALK)}, 10, 9, 0, 0, 10.125, 9.5, 50, u) returning id into v_walk;
  perform give(w, u, 'wemp', 4, 30);
  ${craft('make_rope')};
  insert into said select 'WALKED', coalesce(sum(count), 0) || ':' || coalesce(max(ql), 0) from item where world_id = w and holder = 'player' and holder_uid = u and def = 'rope';
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def = 'rope';
  perform give(w, u, 'wemp', 4, 30);
  insert into said values ('WALKPACE', pg_temp.secs(w, u, 'make_rope', jsonb_build_object('kind', 'item', 'uid', null))::text);
  insert into said values ('ATWALK', rope_pace(w, u, 'make_rope', 'ropemaking') || ':' || rope_pace(w, u, 'make_net', 'ropemaking'));
  delete from placed where id = v_walk;
  ${pack};

  /* ---- a failed lay-up: half the fibre above ${LAY_UP_SPARE_ABOVE}, all of it at ${LOW} ---- */
  ${passes(false)};
  perform give(w, u, 'rope_tool', 1, 50);
  perform give(w, u, 'wemp', 4, ${FIBRE_QL});
  ${craft('make_rope')};
  insert into said select 'FAILHI', count || ':' || dmg from item where world_id = w and holder = 'player' and holder_uid = u and def = 'wemp';
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def = 'wemp';
  ${skillAt('ropemaking', LOW)};
  perform give(w, u, 'wemp', 4, ${FIBRE_QL});
  ${craft('make_rope')};
  insert into said select 'FAILLO', count || ':' || dmg from item where world_id = w and holder = 'player' and holder_uid = u and def = 'wemp';
  ${pack};
  ${passes(true)};

  /* ---- rope QL carried: a rowing boat and a snare ---- */
  perform give(w, u, 'mallet', 1, 50);
  perform give(w, u, 'plank', 200, 30, 'Pine');
  perform give(w, u, 'timber', 60, 30, 'Pine');
  perform give(w, u, 'shaft', 2, 30, 'Pine');
  perform give(w, u, 'rope', 4, ${ROPE_QL});
  perform give(w, u, 'nail', 150, 30);
  ${craft('make_rowing_boat')};
  insert into said select 'BOAT', coalesce(max(ql), 0)::text from item where world_id = w and holder = 'player' and holder_uid = u and def = 'rowing_boat';
  ${pack};
  perform give(w, u, 'shaft', 8, 30, 'Pine');
  perform give(w, u, 'rope', 4, ${ROPE_QL});
  ${craft('make_snare')};
  insert into said select 'SNARE', coalesce(max(ql), 0)::text from item where world_id = w and holder = 'player' and holder_uid = u and def = 'snare';
  ${pack};
  perform give(w, u, 'twine', 2, ${ROPE_QL});
  perform give(w, u, 'shaft', 1, 30, 'Pine');
  ${craft('make_twine_snare')};
  insert into said select 'TWINESNARE', coalesce(max(ql), 0)::text from item where world_id = w and holder = 'player' and holder_uid = u and def = 'twine_snare';
  ${pack};

  /* ---- a bell rung: needs a bell rope, and is heard as far as its QL ---- */
  delete from deed where world_id = w and founded_by = u;
  delete from deed where world_id = w and x between 0 and 30 and y between 0 and 30;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Ropestead', 9, 9, 5, 1, u);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'bell', 10, 9, 0, 0, 10.5, 9.5, 50, u) returning id into v_bell;
  insert into said values ('NOROPE', coalesce(last_refusal(w, u, 'ring_bell', jsonb_build_object('kind', 'furniture', 'id', v_bell)), 'ALLOWED'));
  perform give(w, u, ${q(BELL_ROPE)}, 1, ${BELL_QL});
  insert into said values ('ROPE', coalesce(last_refusal(w, u, 'ring_bell', jsonb_build_object('kind', 'furniture', 'id', v_bell)), 'ALLOWED'));
  v_c := creature_spawn(w, 'roxxen', 12.5, 9.5, 'deed', now() - interval '2 years', u);
  v_far := creature_spawn(w, 'roxxen', 10.5 + ${Math.ceil(bellHeard(BELL_QL)) + 5}, 9.5, 'deed', now() - interval '2 years', u);
  delete from creature where world_id = w and keeper = u and mode = 'deed' and id not in (v_c, v_far);
  delete from event where world_id = w and uid = u;
  perform perform_last(w, u, 'ring_bell', jsonb_build_object('kind', 'furniture', 'id', v_bell));
  insert into said select 'RANG', (select to_x || ',' || to_y from creature where world_id = w and id = v_c) || '|'
    || (select to_x || ',' || to_y from creature where world_id = w and id = v_far) || '|' || ${said};
  delete from creature where world_id = w and id in (v_c, v_far);
  delete from placed where id = v_bell;
  ${pack};

  /* ---- a lead rope: mounted with no saddle and bridle, at its pace ---- */
  v_rider := creature_spawn(w, 'roxxen', 10.5, 9.5, 'active', now() - interval '2 years', u);
  update creature set tacked = false, tack = null, hunger = 1, traits = '{}' where world_id = w and id = v_rider;
  insert into said values ('NOLEAD', coalesce(ride_refusal(w, u, 'mount_creature', jsonb_build_object('kind', 'creature', 'id', v_rider)), 'ALLOWED'));
  perform give(w, u, ${q(LEAD_ROPE)}, 1, 50);
  insert into said values ('LEAD', coalesce(ride_refusal(w, u, 'mount_creature', jsonb_build_object('kind', 'creature', 'id', v_rider)), 'ALLOWED'));
  update creature set rider = u where world_id = w and id = v_rider;
  a := travel_speed(w, u);
  update creature set tacked = true where world_id = w and id = v_rider;
  b := travel_speed(w, u);
  insert into said values ('LEADPACE', a || ':' || b);
  update creature set rider = null where world_id = w and id = v_rider;
  delete from creature where world_id = w and id = v_rider;
  ${pack};

  /* ---- a twine snare: used up by its first catch, taken or let go ---- */
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'trap', 'twine_snare', 11, 9, 0, 0, 11.125, 9.125, 50, u) returning id into v_t;
  v_c := creature_spawn(w, 'rabba', 11.2, 9.2, 'wild', now() - interval '60 days', null);
  update creature set trapped = v_t where world_id = w and id = v_c;
  update placed set caught = v_c where id = v_t;
  delete from creature where world_id = w and mode = 'active' and keeper = u;
  delete from event where world_id = w and uid = u;
  perform perform_trap(w, u, 'take_catch', jsonb_build_object('kind', 'trap', 'id', v_t));
  insert into said select 'TAKEN', (select count(*) from placed where id = v_t) || '|' || (select mode from creature where world_id = w and id = v_c) || '|' || ${said};
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'trap', 'twine_snare', 11, 9, 0, 0, 11.125, 9.125, 50, u) returning id into v_t;
  v_c := creature_spawn(w, 'rabba', 11.2, 9.2, 'wild', now() - interval '60 days', null);
  update creature set trapped = v_t where world_id = w and id = v_c;
  update placed set caught = v_c where id = v_t;
  perform perform_trap(w, u, 'free_catch', jsonb_build_object('kind', 'trap', 'id', v_t));
  insert into said select 'FREED', (select count(*) from placed where id = v_t)::text;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'trap', 'snare', 11, 9, 0, 0, 11.125, 9.125, 50, u) returning id into v_t;
  v_c := creature_spawn(w, 'rabba', 11.2, 9.2, 'wild', now() - interval '60 days', null);
  update creature set trapped = v_t where world_id = w and id = v_c;
  update placed set caught = v_c where id = v_t;
  perform perform_trap(w, u, 'free_catch', jsonb_build_object('kind', 'trap', 'id', v_t));
  insert into said select 'SNAREKEPT', (select count(*) from placed where id = v_t)::text;
end $$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const get = (k: string): string => isle.get(k) ?? 'unsaid';
const num = (k: string, i = 0, sep = ':'): number => Number(get(k).split(sep)[i]);

check(`a lay-up at Ropemaking ${SKILL} makes ${ropePerLayUp(SKILL)} rope at the hands' QL`,
  num('LAYUP') === ropePerLayUp(SKILL) && num('LAYUP', 1) === HANDS, get('LAYUP'));
check(`at a rope walk it makes the same count ${ROPE_WALK_QL} QL better`,
  num('WALKED') === ropePerLayUp(SKILL) && near(num('WALKED', 1), HANDS + ROPE_WALK_QL, 1e-4), get('WALKED'));
check(`Ropemaking's pace on its jobs, and the rope walk's on a lay-up only, as the browser has them`,
  near(num('NOWALK', 0), ropeTime(SKILL)) && near(num('NOWALK', 1), ropeTime(SKILL)) && num('NOWALK', 2) === 1
    && near(num('ATWALK', 0), ropeTime(SKILL) * ROPE_WALK_TIME) && near(num('ATWALK', 1), ropeTime(SKILL)),
  `${get('NOWALK')} ${get('ATWALK')}`);
check(`a go of Lay up a rope takes ${ROPE_WALK_TIME} of the time at a rope walk`,
  num('PACE') > 0 && near(num('WALKPACE') / num('PACE'), ROPE_WALK_TIME, 1e-3), `${get('PACE')} s, ${get('WALKPACE')} s at the walk`);
{
  const d = failDamage(FIBRE_QL);
  check(`a failed lay-up at ${SKILL} damages ${ropeFailUnits(4, SKILL)} of 4 wemp, at ${LOW} all 4 (+${d} each)`,
    num('FAILHI') === 4 && near(num('FAILHI', 1), d * ropeFailUnits(4, SKILL) / 4, 1e-3)
      && num('FAILLO') === 4 && near(num('FAILLO', 1), d * ropeFailUnits(4, LOW) / 4, 1e-3),
    `${get('FAILHI')} and ${get('FAILLO')}`);
}
check(`a rowing boat takes ${ROPE_SHARE_BOAT * 100}% of its rope's QL, a snare ${ROPE_SHARE_TRAP * 100}%, a twine snare none`,
  near(num('BOAT'), ropeBlend(HANDS, ROPE_QL, ROPE_SHARE_BOAT), 1e-3) && near(num('SNARE'), ropeBlend(HANDS, ROPE_QL, ROPE_SHARE_TRAP), 1e-3)
    && near(num('TWINESNARE'), HANDS, 1e-3),
  `boat ${get('BOAT')}, snare ${get('SNARE')}, twine snare ${get('TWINESNARE')}`);
{
  const [nearTo, farTo, words] = get('RANG').split('|');
  const heard = bellHeard(BELL_QL);
  check('a bell will not ring without a bell rope, and rings with one',
    get('NOROPE') === NO_BELL_ROPE && get('ROPE') === 'ALLOWED', `${get('NOROPE')} / ${get('ROPE')}`);
  check(`rung on a rope of QL ${BELL_QL}, a worker within ${heard} tiles comes and one further does not, and it says so`,
    nearTo === '9.5,9.5' && farTo !== '9.5,9.5' && (words ?? '').includes(bellRangSaid('Bell', 10, 9, 1, 'Ropestead', heard)),
    get('RANG'));
}
check('a wildermon with no saddle and bridle is mounted only with a lead rope in the pack',
  get('NOLEAD').endsWith(noTackSaid('').slice(0)) && get('LEAD') === 'ALLOWED',
  `${get('NOLEAD')} / ${get('LEAD')}`);
check(`led on a lead rope it goes at ${LEAD_PACE} of its pace`,
  num('LEADPACE', 1) > 0 && near(num('LEADPACE', 0) / num('LEADPACE', 1), LEAD_PACE, 1e-9), get('LEADPACE'));
check('a twine snare is used up by its first catch, taken or let go; a snare stays set',
  get('TAKEN').startsWith('0|active|') && get('TAKEN').includes('Used up: twine snare.') && get('FREED') === '0' && get('SNAREKEPT') === '1',
  `${get('TAKEN')} / ${get('FREED')} / ${get('SNAREKEPT')}`);

finish('Ropemaking');
