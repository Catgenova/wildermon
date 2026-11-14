/**
 * Elementalism past the swirls (`infusion.ts`, `infuseActions.ts`), on both sides.
 *
 * Asked for: Infuse at an enchanter's plinth, 3 motes of one element into a
 * thing it goes into, one element to a thing, 7 days, strength (skill/100) ×
 * (mote QL/100) of the element's most, ×1.2 attuned, a full go of
 * Elementalism; fire in a campfire, oven, smelter or kiln fuel ×1.5, earth in
 * a shovel or pickaxe +1 on 20% of goes, wind in a hull or cart +8%, water in
 * a well fills ×2, life in a planter stage time ×0.75, light in a lantern or
 * lantern post no candle, dark in a weapon or armour +10% misses at you;
 * attunement, the element collected most over 7 days, +1 mote a swirl;
 * sensing once an hour within 20 + 0.8 × level tiles. Every roll pinned.
 * Runs against the database the suite leaves behind, rolled back.
 *
 *   npx esbuild supabase/test/infusion.ts --bundle --platform=node --format=esm --packages=external \
 *     --outfile=node_modules/.cache/infusion.mjs && node node_modules/.cache/infusion.mjs
 */
import {
  ATTUNE_MOTES, darkInto, earthMore, fireLife, INFUSE_ELEMENTS, INFUSE_INTO, INFUSE_MOTES, INFUSE_SAID, INFUSE_SECS, infusedSaid, infuseShare, infuseSays,
  lifeStage, darkMiss, waterFill, windPace, senseRange, sensedSaid, type Infusion,
} from '../../src/game/infusion';
import { infuseName } from '../../src/game/infuseActions';
import { MOTE_ELEMENTS, motesFor } from '../../src/game/motes';
import { CLIPS, clipFor, PLACEHOLDER, workClipOf } from '../../src/sculpt/anim';
import type { FigurePose } from '../../src/render/figure';
import { psql, check, finish } from './harness';

const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps;
const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;
const SKILL = 80;
const MOTE_QL = 50;
const SHARE = infuseShare(SKILL, MOTE_QL, false);

/* ---- the numbers, on both sides ------------------------------------------------------- */

const CASES: Array<[number, number, boolean]> = [[0, 50, false], [50, 50, false], [80, 50, true], [100, 100, true], [120, 130, false]];
const shares = psql(`select string_agg(infuse_share(s, ql, a)::text, ',' order by o) from (values ${CASES.map(([s, ql, a], i) => `(${s}, ${ql}, ${a}, ${i})`).join(', ')}) v(s, ql, a, o)`).split(',').map(Number);
check('an infusion\'s strength off the skill, the motes\' QL and attunement, the same on both sides',
  shares.length === CASES.length && CASES.every(([s, ql, a], i) => near(shares[i], infuseShare(s, ql, a))) && near(infuseShare(100, 100, true), 1.2), JSON.stringify(shares));
{
  const pairs = INFUSE_ELEMENTS.flatMap((el) => (el === 'dark' ? darkInto() : INFUSE_INTO[el]?.into ?? []).map((id) => [el, id] as [string, string]));
  const fits = psql(`select string_agg(infuse_fits(e, d)::text, ',') from (values ${pairs.map(([e, d]) => `(${q(e)}, ${q(d)})`).join(', ')}) v(e, d)`);
  const wrong = psql(`select infuse_fits('fire', 'shovel')::text || infuse_fits('ice', 'larder')::text || infuse_fits('dark', 'campfire')::text`);
  check('what each element goes into, the same on both sides, and nothing else', fits.split(',').every((x) => x === 'true') && wrong === 'falsefalsefalse',
    `${fits.split(',').filter((x) => x !== 'true').length} not, ${wrong}`);
  const said = psql(`select string_agg(infuse_fits_said(e), '|' order by o) from unnest(array[${MOTE_ELEMENTS.map(q).join(', ')}]) with ordinality v(e, o)`);
  check('and what each says of a thing it does not go into', said === MOTE_ELEMENTS.map((e) => INFUSE_SAID.fits(e)).join('|'), said);
}
const ranges = psql(`select string_agg(sense_range(v)::text, ',' order by v) from unnest(array[0, 1, 50, 100, 120]::double precision[]) v`).split(',').map(Number);
check('a sensing\'s reach at each level, the same on both sides', [0, 1, 50, 100, 120].every((v, i) => near(ranges[i], senseRange(v))) && senseRange(100) === 100, ranges.join(','));

/* ---- on the island ---------------------------------------------------------------------- */

const pack = `delete from item where world_id = w and holder in ('player', 'bag') and holder_uid = u`;
const said = `coalesce((select string_agg(e.text, '#' order by e.n) from event e where e.world_id = w and e.uid = u and e.kind in ('event', 'error', 'fight')), '')`;
const at = (kind: string, id: string, mote: string): string => `jsonb_build_object('kind', ${q(kind)}, 'id', ${id}, 'item', ${mote})`;
const atItem = (uid: string, mote: string): string => `jsonb_build_object('kind', 'item', 'uid', ${uid}, 'item', ${mote})`;

const out = psql(`
begin;
create temp table said (k text, v text);
create temp table raised (id text, base double precision);
create or replace function skill_raise(p_world uuid, p_uid uuid, p_id text, p_base double precision) returns double precision
  language sql as 'insert into raised values (p_id, p_base); select 0::double precision';
create schema dice;
create function dice.random() returns double precision language sql volatile as $f$ select coalesce(nullif(current_setting('wildermon.dice', true), ''), '0.5')::double precision $f$;
do $$
declare w uuid; u uuid; v_plinth bigint; v_fire bigint; v_m bigint; v_ice bigint; v_lamp bigint; v_lantern bigint; v_well bigint; v_planter bigint;
        v_boat bigint; v_shovel bigint; v_sword bigint; v_c int; a double precision; b double precision; v_far bigint; v_now double precision;
begin
  select id into w from world where name = 'Stonehaven';
  select p.uid into u from player p where p.world_id = w order by p.uid limit 1;
  ${pack};
  delete from placed where world_id = w and x between 4 and 20 and y between 4 and 20;
  delete from event where world_id = w and uid = u;
  delete from mote_take where world_id = w and uid = u;
  update creature set rider = null where world_id = w and rider = u;
  update player set x = 9.5, y = 9.5, level = 0, aboard = null, act = null, act_queue = '[]', equipped = '{}'::jsonb, body_at = now(),
         stats = coalesce(stats, '{}'::jsonb) - 'sensedAt' || jsonb_build_object('health', 1, 'stamina', 1, 'hunger', 1, 'thirst', 1),
         blessings = '{}'::jsonb
   where world_id = w and uid = u;
  insert into skill (world_id, uid, id, value) values (w, u, 'elementalism', ${SKILL})
    on conflict (world_id, uid, id) do update set value = excluded.value;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);

  /* ---- a campfire: refused without a plinth, infused at one, refused again; its burn ---- */
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, fuel, made_by) values (w, 'campfire', 10, 9, 0, 0, 10.5, 9.5, 120, u) returning id into v_fire;
  v_m := give(w, u, 'fire_mote', 5, ${MOTE_QL});
  insert into said values ('NOPLINTH', coalesce(infuse_refusal(w, u, infuse_action(), ${at('campfire', 'v_fire', 'v_m')}), 'ALLOWED'));
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by) values (w, 'furniture', 'enchanters_plinth', 9, 10, 0, 0, 9.5, 10.5, 50, u) returning id into v_plinth;
  insert into said values ('RATE0', placed_burn_rate((select p from placed p where p.id = v_fire))::text);
  delete from event where world_id = w and uid = u;
  v_now := extract(epoch from now());
  perform perform_infuse(w, u, infuse_action(), ${at('campfire', 'v_fire', 'v_m')});
  insert into said select 'FIRE', (select infuse::text from placed where id = v_fire) || '|' || coalesce((select count from item where id = v_m), 0)
    || '|' || v_now || '|' || ${said} || '|' || (select string_agg(base::text, ',') from raised where id = 'elementalism');
  insert into said values ('RATE1', placed_burn_rate((select p from placed p where p.id = v_fire))::text);
  perform give(w, u, 'fire_mote', 3, ${MOTE_QL});
  insert into said values ('AGAIN', coalesce(infuse_refusal(w, u, infuse_action(), ${at('campfire', 'v_fire', `(select max(id) from item where world_id = w and holder_uid = u and def = 'fire_mote')`)}), 'ALLOWED'));
  ${pack};
  -- Too few, the wrong element, too far.
  v_m := give(w, u, 'fire_mote', 2, ${MOTE_QL});
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, fuel, made_by) values (w, 'campfire', 10, 10, 0, 0, 10.5, 10.5, 120, u) returning id into v_c;
  insert into said values ('FEW', coalesce(infuse_refusal(w, u, infuse_action(), ${at('campfire', 'v_c', 'v_m')}), 'ALLOWED'));
  v_ice := give(w, u, 'ice_mote', 3, ${MOTE_QL});
  insert into said values ('ICE', coalesce(infuse_refusal(w, u, infuse_action(), ${at('campfire', 'v_c', 'v_ice')}), 'ALLOWED'));
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, fuel, made_by) values (w, 'campfire', 16, 16, 0, 0, 16.5, 16.5, 120, u) returning id into v_far;
  perform give(w, u, 'fire_mote', 1, ${MOTE_QL});
  insert into said values ('FAR', coalesce(infuse_refusal(w, u, infuse_action(),
    ${at('campfire', 'v_far', `(select max(id) from item where world_id = w and holder_uid = u and def = 'fire_mote')`)}), 'ALLOWED'));
  ${pack};

  /* ---- light: a lantern in hand burns none and lights with none; a lantern post burns none ---- */
  v_lantern := give(w, u, 'lantern', 1, 50);
  update item set charges = 0 where id = v_lantern;
  insert into said values ('NOCANDLE', candle_left((select i from item i where i.id = v_lantern))::text);
  v_m := give(w, u, 'light_mote', 3, ${MOTE_QL});
  perform perform_infuse(w, u, infuse_action(), ${atItem('v_lantern', 'v_m')});
  update item set charges = 600, lit = true, lit_at = now() - interval '100 seconds' where id = v_lantern;
  insert into said select 'LANTERN', candle_left(i)::text || '|-' from item i where i.id = v_lantern;
  update item set charges = 0 where id = v_lantern;
  update said set v = v || '|' || (select candle_left(i) from item i where i.id = v_lantern) where k = 'LANTERN';
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, fuel, lit, since) values (w, 'furniture', 'lamp_post', 8, 9, 0, 0, 8.5, 9.5, 50, u, 0, false, now()) returning id into v_lamp;
  v_m := give(w, u, 'light_mote', 3, ${MOTE_QL});
  perform perform_infuse(w, u, infuse_action(), ${at('furniture', 'v_lamp', 'v_m')});
  insert into said select 'LAMP', placed_burn_rate(p) || '|' || placed_fuel(p) from placed p where p.id = v_lamp;
  ${pack};

  /* ---- water: a well fills ×(1 + share) as fast ---- */
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by, litres, since) values (w, 'furniture', 'well', 10, 8, 0, 0, 10.5, 8.5, 50, u, 0, now() - interval '20 seconds') returning id into v_well;
  a := placed_litres((select p from placed p where p.id = v_well));
  v_m := give(w, u, 'water_mote', 3, ${MOTE_QL});
  perform perform_infuse(w, u, infuse_action(), ${at('furniture', 'v_well', 'v_m')});
  b := placed_litres((select p from placed p where p.id = v_well));
  insert into said values ('WELL', a || '|' || b);

  /* ---- life: a planter's stage time ×(1 - 0.25 share) ---- */
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by) values (w, 'furniture', 'planter', 8, 10, 0, 0, 8.5, 10.5, 50, u) returning id into v_planter;
  insert into planter_crop (placed, world_id, id, ql, sown_by, pace) values (v_planter, w, (select id from crop_def order by id limit 1), 50, u, 1);
  a := planter_per((select c from planter_crop c where c.placed = v_planter), (select p from placed p where p.id = v_planter));
  v_m := give(w, u, 'life_mote', 3, ${MOTE_QL});
  perform perform_infuse(w, u, infuse_action(), ${at('furniture', 'v_planter', 'v_m')});
  b := planter_per((select c from planter_crop c where c.placed = v_planter), (select p from placed p where p.id = v_planter));
  insert into said values ('LIFE', a || '|' || b);

  /* ---- wind: a sailing boat at the helm ---- */
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by) values (w, 'furniture', 'sailing_boat', 11, 9, 0, 0, 11.5, 9.5, 50, u) returning id into v_boat;
  v_m := give(w, u, 'wind_mote', 3, ${MOTE_QL});
  update placed set driver = u where id = v_boat;
  a := travel_speed(w, u);
  update placed set driver = null where id = v_boat;
  perform perform_infuse(w, u, infuse_action(), ${at('furniture', 'v_boat', 'v_m')});
  update placed set driver = u where id = v_boat;
  b := travel_speed(w, u);
  update placed set driver = null where id = v_boat;
  insert into said values ('WIND', a || '|' || b);
  ${pack};

  /* ---- earth: one more on a dig, at its chance; none without it ---- */
  v_shovel := give(w, u, 'shovel', 1, 50);
  perform set_config('search_path', 'dice, public, pg_catalog', true);
  perform set_config('wildermon.dice', '0.01', true);
  insert into said values ('EARTH0', earth_more(w, u, 'shovel')::text);
  update item set infuse = jsonb_build_object('el', 'earth', 'str', 1, 'until', extract(epoch from now()) + 3600) where id = v_shovel;
  insert into said values ('EARTHLO', earth_more(w, u, 'shovel')::text);
  perform set_config('wildermon.dice', '0.21', true);
  insert into said values ('EARTHHI', earth_more(w, u, 'shovel')::text);
  perform set_config('search_path', '"$user", public', true);
  ${pack};

  /* ---- dark: a blow at you misses for a dark sword in hand ---- */
  v_sword := give(w, u, 'sword', 1, 50);
  update player set equipped = jsonb_build_object('weapon', v_sword) where world_id = w and uid = u;
  insert into said values ('DARK0', dark_miss(w, u)::text);
  update item set infuse = jsonb_build_object('el', 'dark', 'str', ${SHARE}, 'until', extract(epoch from now()) + 3600) where id = v_sword;
  insert into said values ('DARK1', dark_miss(w, u)::text);
  v_c := creature_spawn(w, 'ulva', 10.5, 9.5, 'wild', now() - interval '60 days', null);
  update player set stats = stats || jsonb_build_object('hurtBy', v_c, 'health', 1) where world_id = w and uid = u;
  delete from event where world_id = w and uid = u;
  perform set_config('search_path', 'dice, public, pg_catalog', true);
  perform set_config('wildermon.dice', '0', true);
  perform hurt_player(w, u, 0.2, 'a bite');
  perform set_config('search_path', '"$user", public', true);
  insert into said select 'MISSED', ${said} || '|' || (select stats->>'health' from player where world_id = w and uid = u);
  delete from creature where world_id = w and id = v_c;
  update player set equipped = '{}'::jsonb where world_id = w and uid = u;
  ${pack};

  /* ---- attunement: the element collected most over seven days; a mote more off its swirls, and more strength ---- */
  insert into mote_take (world_id, uid, at, element, n) values
    (w, u, now() - interval '1 day', 'fire', 5), (w, u, now() - interval '2 days', 'water', 3), (w, u, now() - interval '9 days', 'ice', 40);
  perform mote_attune_kept(w, u);
  insert into said select 'ATTUNED', mote_attuned(w, u) || '|' || (stats->>'attune') from player where world_id = w and uid = u;
  delete from mote_swirl where world_id = w and x between 0 and 30 and y between 0 and 30;
  insert into mote_swirl (world_id, x, y, element, region) values (w, 10, 9, 'fire', region_of(10, 9));
  delete from event where world_id = w and uid = u;
  perform act_perform(w, u, 'collect_motes', jsonb_build_object('kind', 'tile', 'x', 10, 'y', 9, 'cx', 10, 'cy', 9));
  insert into said select 'SWIRL', coalesce((select sum(count) from item where world_id = w and holder_uid = u and def = 'fire_mote'), 0) || '|'
    || (select sum(n) from mote_take where world_id = w and uid = u and element = 'fire');
  ${pack};
  delete from placed where id = v_fire;
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, fuel, made_by) values (w, 'campfire', 10, 9, 0, 0, 10.5, 9.5, 120, u) returning id into v_fire;
  v_m := give(w, u, 'fire_mote', 3, ${MOTE_QL});
  perform perform_infuse(w, u, infuse_action(), ${at('campfire', 'v_fire', 'v_m')});
  insert into said select 'ATTUNESTR', infuse->>'str' from placed where id = v_fire;

  /* ---- sensing: the swirls in reach counted, once an hour ---- */
  delete from mote_swirl where world_id = w and x between 0 and 200 and y between 0 and 200;
  insert into mote_swirl (world_id, x, y, element, region) values (w, 20, 9, 'earth', region_of(20, 9)), (w, 9, 9 + ${Math.floor(senseRange(SKILL)) - 1}, 'wind', region_of(9, 9 + ${Math.floor(senseRange(SKILL)) - 1})),
    (w, 9 + ${Math.ceil(senseRange(SKILL)) + 2}, 9, 'life', region_of(9 + ${Math.ceil(senseRange(SKILL)) + 2}, 9));
  delete from event where world_id = w and uid = u;
  delete from raised;
  insert into said values ('SENSEOK', coalesce(infuse_refusal(w, u, sense_action(), jsonb_build_object('kind', 'tile', 'x', 9, 'y', 9)), 'ALLOWED'));
  perform perform_infuse(w, u, sense_action(), jsonb_build_object('kind', 'tile', 'x', 9, 'y', 9));
  insert into said select 'SENSED', ${said} || '|' || (select string_agg(base::text, ',') from raised where id = 'elementalism')
    || '|' || coalesce((select stats->>'sensedAt' from player where world_id = w and uid = u), 'none');
  insert into said values ('SENSEWAIT', coalesce(infuse_refusal(w, u, sense_action(), jsonb_build_object('kind', 'tile', 'x', 9, 'y', 9)), 'ALLOWED'));
end $$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const get = (k: string): string => isle.get(k) ?? 'unsaid';
const part = (k: string, i: number): string => get(k).split('|')[i] ?? '';
const num = (k: string, i = 0): number => Number(part(k, i));

check('an infusion is refused away from a plinth, too few motes, an element that does not go into it, too far, and once infused',
  get('NOPLINTH') === INFUSE_SAID.plinth && get('FEW') === INFUSE_SAID.motes && get('ICE') === INFUSE_SAID.fits('ice') && get('FAR') === INFUSE_SAID.reach
    && get('AGAIN') === INFUSE_SAID.already('fire'),
  `${get('NOPLINTH')} / ${get('FEW')} / ${get('ICE')} / ${get('FAR')} / ${get('AGAIN')}`);
{
  const i = JSON.parse(part('FIRE', 0) || '{}') as Infusion;
  const now = num('FIRE', 2);
  check(`fire into a campfire at Elementalism ${SKILL}, motes QL ${MOTE_QL}: strength ${SHARE}, ${INFUSE_MOTES} motes used, ${INFUSE_SECS / 86400} days, a full go`,
    i.el === 'fire' && near(i.str, SHARE) && near(i.until - now, INFUSE_SECS, 5) && num('FIRE', 1) === 5 - INFUSE_MOTES && part('FIRE', 4) === '1',
    get('FIRE'));
  check('and says so as the browser says it', part('FIRE', 3) === infusedSaid(infuseName('campfire'), i, now) || part('FIRE', 3) === infusedSaid(infuseName('campfire'), i, now + 1),
    `${part('FIRE', 3)}\nbrowser ${infusedSaid(infuseName('campfire'), i, now)}`);
  check(`and its fuel lasts ×${fireLife(SHARE)}`, near(Number(get('RATE0')) / Number(get('RATE1')), fireLife(SHARE), 1e-9), `${get('RATE0')} / ${get('RATE1')}`);
}
check('light: a lantern burns none of its candle and lights with none; a lantern post burns none and lights with none',
  get('NOCANDLE') === '0' && num('LANTERN') === 600 && num('LANTERN', 2) === 1 && num('LAMP') === 0 && num('LAMP', 1) >= 1,
  `${get('NOCANDLE')} / ${get('LANTERN')} / ${get('LAMP')}`);
check(`water: a well fills ×${waterFill(SHARE)} as fast`, num('WELL') > 0 && near(num('WELL', 1) / num('WELL'), waterFill(SHARE), 1e-3), get('WELL'));
check(`life: a planter's stage time ×${lifeStage(SHARE)}`, num('LIFE') > 0 && near(num('LIFE', 1) / num('LIFE'), lifeStage(SHARE), 1e-9), get('LIFE'));
check(`wind: a sailing hull goes ×${windPace(SHARE)}`, num('WIND') > 0 && near(num('WIND', 1) / num('WIND'), windPace(SHARE), 1e-9), get('WIND'));
check(`earth: one more at a chance of ${earthMore(1)} at full strength, and none without it`,
  get('EARTH0') === '0' && get('EARTHLO') === '1' && get('EARTHHI') === '0', `${get('EARTH0')} ${get('EARTHLO')} ${get('EARTHHI')}`);
check(`dark: a sword in hand makes a blow at you miss ${darkMiss(SHARE)} more, and one does`,
  get('DARK0') === '0' && near(Number(get('DARK1')), darkMiss(SHARE)) && /Missed: [a-z ]+, dark infusion\./.test(part('MISSED', 0)) && part('MISSED', 1) === '1',
  `${get('DARK0')} ${get('DARK1')} ${get('MISSED')}`);
check('attunement: the element collected most over seven days, kept on the body for the skill page',
  part('ATTUNED', 0) === 'fire' && num('ATTUNED', 1) === MOTE_ELEMENTS.indexOf('fire'), get('ATTUNED'));
check(`a swirl of it gives ${ATTUNE_MOTES} mote more, and is noted`,
  num('SWIRL') === motesFor(SKILL) + ATTUNE_MOTES && num('SWIRL', 1) === 5 + motesFor(SKILL) + ATTUNE_MOTES, get('SWIRL'));
check('an infusion of it is ×1.2 as strong', near(Number(get('ATTUNESTR')), infuseShare(SKILL, MOTE_QL, true)), get('ATTUNESTR'));
check(`sensing at ${SKILL} counts the swirls within ${senseRange(SKILL)} tiles, teaches a little, and waits an hour`,
  get('SENSEOK') === 'ALLOWED' && part('SENSED', 0).includes(sensedSaid(2, senseRange(SKILL))) && Number(part('SENSED', 1)) > 0 && part('SENSED', 2) !== 'none'
    && get('SENSEWAIT').startsWith('Sensed within the hour: again in '),
  `${get('SENSED')} / ${get('SENSEWAIT')}`);
check('an infusion says its element, strength, what it does and its time left',
  infuseSays({ el: 'wind', str: 0.5, until: 1000 + 3 * 86400 + 5 * 3600 + 120 }, 1000) === 'Infused: wind, strength 50%. Speed: +4%. 3 d 5 h left.');

// the clips: infusing as a spell on somebody else is cast, sensing as one on everything round oneself
for (const [job, name] of [['infuse_motes', 'cast-ally'], ['sense_swirls', 'cast-nova']]) {
  const pose = { id: undefined, phase: 0, moving: false, facing: 0, swimming: false, working: true, job, act: { t: 0.3, length: 4 } } as unknown as FigurePose;
  const at = clipFor(pose);
  check(`${job} plays ${name}, fitted to the go`, workClipOf(job) === name && name !== PLACEHOLDER && !!CLIPS[name] && at?.clip.name === name && at.t >= 0 && at.t <= CLIPS[name].length,
    `${workClipOf(job)} ${at?.clip.name} ${at?.t}`);
}

finish('Elementalism');
