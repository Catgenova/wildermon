/**
 * Enchanting, part 3 (`enchant.ts`, `enchanting.ts`), on both sides: the
 * enchantments on new kinds of thing.
 *
 * For each: its scroll's recipe, the same on both sides; what Examine says it
 * does at its quality; the refusal that names what it goes on; and what it
 * does, measured the same way on both sides:
 *
 *   * the jewel slot: Scholar's Band on a trade's gain, Knackstone on the
 *     chance of a knack (a roll between the plain chance and the better one),
 *     Steady Heart on the wind that comes back and Hearthbound on hunger and
 *     thirst over one settling of the body, Favoured on a prayer's favour,
 *     Stillwater on a sitting's Calm.
 *
 * Every roll is set: dice on the island (`random()` read off a list) and the
 * same list as the browser's `rand`. Runs against the database the suite
 * leaves behind; the island half is rolled back.
 *
 *   npx esbuild supabase/test/enchant3.ts --bundle --platform=node --format=esm \
 *     --external:typescript --outfile=node_modules/.cache/enchant3.mjs && node node_modules/.cache/enchant3.mjs
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import { bagRoom, type Item } from '../../src/game/items';
import { furnitureCapacity, liquidCapacity } from '../../src/game/furniture';
import { crateCapacity } from '../../src/game/crates';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { alreadyEnchanted, ENCHANTERS_PLINTH, ENCHANT_HARM, ENCHANT_SAID, ENCHANTMENT_LIST, ENCHANTMENTS, enchantValue, NETMENDER_WEAR, ON_WORDS, wrongKind, type EnchantmentDef } from '../../src/game/enchant';
import { CATCH_MOST, catchChance } from '../../src/game/traps';
import { sameStack } from '../../src/game/items';
import { tackEnchant, tackSpeed } from '../../src/game/creatures';
import { tameChance } from '../../src/game/creatureActions';
import { DAY_SECONDS } from '../../src/game/game';
import { REST_CAP } from '../../src/game/boons';
import type { Creature } from '../../src/game/creatures';
import { DAMAGE_MAX } from '../../src/game/limits';
import { enchantSays } from '../../src/game/enchanting';
import { knackChance } from '../../src/game/titles';
import { sittingWorth } from '../../src/game/meditation';
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
const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps;

const E = (id: string): EnchantmentDef => ENCHANTMENTS[id];
const [SCHOLAR, KNACK, HEART, HEARTH, FAVOUR, STILL] = ['scholars_band', 'knackstone', 'steady_heart', 'hearthbound', 'favoured', 'stillwater'].map(E);
const JEWEL = [SCHOLAR, KNACK, HEART, HEARTH, FAVOUR, STILL];
const [MULE, SEAL, HAWK] = ['packmule', 'seals_coat', 'hawks_eye'].map(E);
const [EMBER, MASTER] = ['ember_heart', 'masterwork'].map(E);
const [WIND, DEEP, AXLE, BAG] = ['fair_wind', 'deep_hold', 'true_axle', 'bag_of_holding'].map(E);
const [SNARE, MEND, DREAM] = ['snarecraft', 'netmender', 'dreamweave'].map(E);
const [FLEET, TAMER] = ['fleetfoot', 'tamers_bridle'].map(E);
/** Everything part 3 has added so far, for the scrolls and the words. */
const PART3 = [...JEWEL, MULE, SEAL, HAWK, EMBER, MASTER, WIND, DEEP, AXLE, BAG, SNARE, MEND, DREAM, FLEET, TAMER];

/* ---- the scrolls and the words, on both sides ------------------------------ */

const billIsle = psql(`select string_agg(r.id || '=' || (select string_agg(ri.item || '*' || ri.count, '+' order by ri.item collate "C") from recipe_input ri where ri.recipe = r.id),
  '|' order by r.id collate "C") from recipe r where r.id in (${PART3.map((e) => `'make_${e.scroll}'`).join(', ')})`);
const billHere = PART3.map((e) => `make_${e.scroll}=${[...(RECIPE_BY_ID.get(`make_${e.scroll}`)?.inputs ?? [])]
  .sort((a, b) => (a.item < b.item ? -1 : a.item > b.item ? 1 : 0)).map((i) => `${i.item}*${i.count ?? 1}`).join('+')}`).sort().join('|');
check(`every scroll is written from the same papyrus and motes on both sides: ${PART3.map((e) => `${e.name} (${e.motes.map(([m, n]) => `${n} ${m}`).join(' + ')})`).join(', ')}`,
  billIsle === billHere && billHere.includes('make_knackstone_scroll=life_mote*1+light_mote*1+papyrus*1'), billIsle === billHere ? '' : `${billIsle} / ${billHere}`);

const QLS = [0.4, 37.48, 50, 100, 140];
const saysIsle = psql(`select string_agg(enchant_says(jsonb_build_object('id', e.id, 'ql', q)), '#' order by e.ord, o)
  from enchantments() e, unnest(array[${QLS.join(',')}]::float8[]) with ordinality u(q, o) where e.id in (${PART3.map((e) => `'${e.id}'`).join(', ')})`);
const saysHere = PART3.flatMap((e) => QLS.map((q) => enchantSays({ enchant: { id: e.id, ql: q } }))).join('#').trim();
check('Examine says each at its quality in the same words on both sides, a Packmule\'s in kilos', saysIsle === saysHere && saysHere.includes('you carry 3.7 kg more') && saysHere.includes('you carry 10 kg more'),
  saysIsle === saysHere ? '' : (() => { const i = [...saysIsle].findIndex((ch, k) => ch !== saysHere[k]); return `at ${i}: ${saysIsle.slice(i - 40, i + 60)} / ${saysHere.slice(i - 40, i + 60)}`; })());
check(`and the figures at QL 100 are the owner's: Scholar's Band 5% more skill, Knackstone half again the chance of a knack, Steady Heart 20% faster wind, Hearthbound 20% slower hunger and thirst, Favoured and Stillwater 10% more`,
  near(enchantValue(SCHOLAR, 100), 0.05) && near(enchantValue(KNACK, 100), 0.5) && near(enchantValue(HEART, 100), 0.2)
    && near(enchantValue(HEARTH, 100), 0.2) && near(enchantValue(FAVOUR, 100), 0.1) && near(enchantValue(STILL, 100), 0.1));

/* ---- on the island --------------------------------------------------------------- */

const MIRA = 'e1c4a170-0000-4000-8000-000000000003';
const lastSaid = `(select e.text from event e where e.world_id = w and e.uid = u order by e.n desc limit 1)`;
const out = psql(`
begin;
create temp table said (k text, v text);
create schema dice;
create function dice.random() returns double precision language plpgsql volatile as $f$
declare xs text[] := string_to_array(current_setting('wurm.dice'), ',');
        n int := coalesce(nullif(current_setting('wurm.dice_n', true), ''), '0')::int;
begin
  perform set_config('wurm.dice_n', (n + 1)::text, true);
  return xs[1 + n % array_length(xs, 1)]::double precision;
end $f$;
create function pg_temp.dice(v text) returns void language plpgsql as $f$
begin
  perform set_config('wurm.dice', v, true);
  perform set_config('wurm.dice_n', '0', true);
  perform set_config('search_path', 'dice, public, pg_catalog', true);
end $f$;
create function pg_temp.nodice() returns void language plpgsql as $f$
begin
  perform set_config('search_path', '"$user", public', true);
end $f$;
do $t$
declare w uuid; u uuid := '${MIRA}'; v_ring bigint; v_pend bigint; v_s bigint; v_altar bigint; v_at jsonb; c0 double precision;
        v_pack bigint; v_chest bigint; v_cap bigint; v_sm bigint; v_sm2 bigint; v_anv bigint; v_loom bigint; v_back bigint;
        v_boat bigint; v_ship bigint; v_wagon bigint; v_chestp bigint; v_barrel bigint; v_cart bigint; v_bag bigint; v_crate int; v_q double precision;
        v_trap bigint; v_bed bigint; v_net bigint; v_rod bigint; v_c creature; v_d0 double precision;
        v_sad bigint; v_bri bigint; v_wild int; v_mount int; v_w creature;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Enchanting 3', 318, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  -- Enchant is done at an enchanter's plinth: one within reach of every place she stands.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql) values (w, 'furniture', 'enchanters_plinth', 41, 42, 0, 0, 41.25, 42.25, 50);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql) values (w, 'furniture', 'enchanters_plinth', 47, 42, 0, 0, 47.25, 42.25, 50);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql) values (w, 'furniture', 'enchanters_plinth', 28, 31, 0, 0, 28.25, 31.25, 50);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql) values (w, 'furniture', 'enchanters_plinth', 35, 32, 0, 0, 35.25, 32.25, 50);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql) values (w, 'furniture', 'enchanters_plinth', 28, 35, 0, 0, 28.25, 35.25, 50);
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql) values (w, 'furniture', 'enchanters_plinth', 19, 23, 0, 0, 19.25, 23.25, 50);
  update player set x = 40.5, y = 40.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb, craft_from_stores = false,
         class_mul = null, combat_class = null, craft_class = null, wounds = '[]'::jsonb, blessings = '{}'::jsonb, knacks = '{}'::jsonb,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w and uid = u;
  insert into skill (world_id, uid, id, value) values (w, u, 'enchanting', 100), (w, u, faith_skill(), 50), (w, u, praying_skill(), 50)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  v_ring := give(w, u, 'jewelled_ring', 1, 100, 'Ruby');
  v_pend := give(w, u, 'jewelled_pendant', 1, 100, 'Ruby');

  -- 1. Refused on the other jewel, in words that name the right one.
  v_s := give(w, u, 'scholars_band_scroll', 1, 90);
  insert into said values ('R:scholarpend', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_pend, 'scroll', v_s)), 'none'));
  insert into said values ('R:scholarring', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_ring, 'scroll', v_s)), 'none'));
  v_s := give(w, u, 'steady_heart_scroll', 1, 90);
  insert into said values ('R:heartring', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_ring, 'scroll', v_s)), 'none'));
  insert into said values ('R:heartpend', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_pend, 'scroll', v_s)), 'none'));

  -- 2. Scholar's Band on a trade's gain, worn and not.
  update item set enchant = '{"id": "scholars_band", "ql": 100}'::jsonb where id = v_ring;
  insert into said values ('LEARN0', skill_mult(w, u, 'mining')::text);
  update player set equipped = jsonb_build_object('jewel', v_ring) where world_id = w and uid = u;
  insert into said values ('LEARN', skill_mult(w, u, 'mining')::text);

  -- 3. Knackstone: a roll a quarter over the plain chance takes nothing without it and a knack with it.
  update item set enchant = '{"id": "knackstone", "ql": 100}'::jsonb where id = v_ring;
  c0 := knack_chance('mining', 1, 1);
  update player set equipped = '{}'::jsonb where world_id = w and uid = u;
  perform pg_temp.dice((c0 * 1.25)::text);
  perform earn_knacks(w, u, 'mining', 1);
  insert into said select 'KNACK0', coalesce(knacks->>'mining', '0') from player where world_id = w and uid = u;
  update player set equipped = jsonb_build_object('jewel', v_ring) where world_id = w and uid = u;
  perform pg_temp.dice((c0 * 1.25)::text);
  perform earn_knacks(w, u, 'mining', 1);
  perform pg_temp.nodice();
  insert into said select 'KNACK', coalesce(knacks->>'mining', '0') || '|' || c0 from player where world_id = w and uid = u;

  -- 4. Steady Heart and Hearthbound over one settling of the body: four seconds at rest, worn and not.
  update player set equipped = '{}'::jsonb, act = null, moved_at = now() - interval '1 hour', body_at = now() - interval '4 seconds',
         stats = stats || jsonb_build_object('hunger', 0.9, 'thirst', 0.9, 'stamina', 0.3)
   where world_id = w and uid = u;
  perform body_settle(w, u);
  insert into said select 'BODY0', (stats->>'stamina') || '|' || (stats->>'hunger') || '|' || (stats->>'thirst') from player where world_id = w and uid = u;
  update item set enchant = '{"id": "steady_heart", "ql": 100}'::jsonb where id = v_pend;
  update player set equipped = jsonb_build_object('jewel', v_pend), body_at = now() - interval '4 seconds',
         stats = stats || jsonb_build_object('hunger', 0.9, 'thirst', 0.9, 'stamina', 0.3)
   where world_id = w and uid = u;
  perform body_settle(w, u);
  insert into said select 'WIND', (stats->>'stamina') from player where world_id = w and uid = u;
  update item set enchant = '{"id": "hearthbound", "ql": 100}'::jsonb where id = v_pend;
  update player set body_at = now() - interval '4 seconds', stats = stats || jsonb_build_object('hunger', 0.9, 'thirst', 0.9, 'stamina', 0.3)
   where world_id = w and uid = u;
  perform body_settle(w, u);
  insert into said select 'UPKEEP', (stats->>'hunger') || '|' || (stats->>'thirst') from player where world_id = w and uid = u;

  -- 5. Favoured on a prayer at an altar, worn and not.
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql) values (w, 'furniture', 'altar', 40, 40, 40.5, 40.5, 40) returning id into v_altar;
  v_at := jsonb_build_object('kind', 'furniture', 'id', v_altar);
  update player set equipped = '{}'::jsonb, prayed_at = null, favour = 0, favour_at = now() where world_id = w and uid = u;
  perform perform_faith(w, u, 'pray', v_at);
  insert into said select 'FAVOUR0', favour::double precision::text from player where world_id = w and uid = u;
  update item set enchant = '{"id": "favoured", "ql": 100}'::jsonb where id = v_pend;
  -- The first prayer trained Faith and Prayer; the second reads them where the first did.
  update skill set value = 50 where world_id = w and uid = u and id in (faith_skill(), praying_skill());
  update player set equipped = jsonb_build_object('jewel', v_pend), prayed_at = null, favour = 0, favour_at = now() where world_id = w and uid = u;
  perform perform_faith(w, u, 'pray', v_at);
  insert into said select 'FAVOUR', favour::double precision::text from player where world_id = w and uid = u;

  -- 6. Stillwater on what a sitting banks, worn and not.
  delete from placed where id = v_altar;
  update item set enchant = '{"id": "stillwater", "ql": 100}'::jsonb where id = v_pend;
  update player set equipped = '{}'::jsonb where world_id = w and uid = u;
  insert into said select 'CALM0', s.calm::text from sitting_worth(w, u) s;
  update player set equipped = jsonb_build_object('jewel', v_pend) where world_id = w and uid = u;
  insert into said select 'CALM', s.calm::text from sitting_worth(w, u) s;

  -- 7. Packmule, Seal's Coat and Hawk's Eye: refused elsewhere, and a Packmule on what you carry.
  update player set equipped = '{}'::jsonb where world_id = w and uid = u;
  v_pack := give(w, u, 'backpack', 1, 100);
  v_chest := give(w, u, 'leather_jerkin', 1, 100);
  v_cap := give(w, u, 'leather_cap', 1, 100);
  v_s := give(w, u, 'packmule_scroll', 1, 90);
  insert into said values ('R:mulechest', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_chest, 'scroll', v_s)), 'none'));
  insert into said values ('R:mulepack', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_pack, 'scroll', v_s)), 'none'));
  v_s := give(w, u, 'seals_coat_scroll', 1, 90);
  insert into said values ('R:sealcap', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_cap, 'scroll', v_s)), 'none'));
  insert into said values ('R:sealchest', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_chest, 'scroll', v_s)), 'none'));
  v_s := give(w, u, 'hawks_eye_scroll', 1, 90);
  insert into said values ('R:hawkchest', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_chest, 'scroll', v_s)), 'none'));
  insert into said values ('R:hawkcap', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_cap, 'scroll', v_s)), 'none'));
  insert into said values ('CARRY0', carry_limit(w, u)::text);
  update item set enchant = '{"id": "packmule", "ql": 100}'::jsonb where id = v_pack;
  insert into said values ('CARRY', carry_limit(w, u)::text);
  insert into said values ('SWIMSRC', (pg_get_functiondef('body_settle(uuid, uuid)'::regprocedure) like '%* (1 - worn_enchant(p_world, p_uid, ''swim''))%')::text);

  -- 8. Things standing where they were set down: a smelter, a second one, an anvil and a loom round the body.
  update player set equipped = '{}'::jsonb where world_id = w and uid = u;
  delete from event where world_id = w and uid = u;
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql) values (w, 'smelter', 41, 40, 0, 0, 41.375, 40.25, 60) returning id into v_sm;
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql) values (w, 'smelter', 39, 41, 0, 0, 39.375, 41.25, 60) returning id into v_sm2;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql) values (w, 'anvil', 'iron', 39, 40, 0, 0, 39.25, 40.25, 50) returning id into v_anv;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql) values (w, 'furniture', 'loom', 40, 41, 0, 0, 40.25, 41.25, 50) returning id into v_loom;
  v_s := give(w, u, 'ember_heart_scroll', 1, 90);
  insert into said values ('R:embanvil', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'anvil', 'id', v_anv, 'scroll', v_s)), 'none'));
  insert into said values ('R:embsm', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'smelter', 'id', v_sm, 'scroll', v_s)), 'none'));
  update player set x = 46.5 where world_id = w and uid = u;
  insert into said values ('R:far', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'smelter', 'id', v_sm, 'scroll', v_s)), 'none'));
  update player set x = 40.5 where world_id = w and uid = u;
  -- Taken, through the job: enchanting 100, a QL 90 scroll, a QL 60 smelter -- held to the smelter.
  perform pg_temp.dice('0.01,0.5');
  perform act_perform(w, u, 'enchant', jsonb_build_object('kind', 'smelter', 'id', v_sm, 'scroll', v_s));
  perform pg_temp.nodice();
  insert into said select 'EMB', (p.enchant->>'ql') || '|' || ${lastSaid} from placed p where p.id = v_sm;
  -- Not taken, twice, on the other: harm, and then harm held a point short of broken.
  v_s := give(w, u, 'ember_heart_scroll', 1, 90);
  perform pg_temp.dice('0.99,0.01');
  perform perform_enchant(w, u, jsonb_build_object('kind', 'smelter', 'id', v_sm2, 'scroll', v_s));
  perform pg_temp.nodice();
  insert into said select 'MISS', p.dmg || '|' || ${lastSaid} from placed p where p.id = v_sm2;
  update placed set dmg = 90 where id = v_sm2;
  v_s := give(w, u, 'ember_heart_scroll', 1, 90);
  perform pg_temp.dice('0.99,0.01');
  perform perform_enchant(w, u, jsonb_build_object('kind', 'smelter', 'id', v_sm2, 'scroll', v_s));
  perform pg_temp.nodice();
  insert into said select 'MISS2', p.dmg || '|' || (p.enchant is null)::text || '|' || ${lastSaid} from placed p where p.id = v_sm2;
  -- Up into the pack and down again: the enchantment goes with it both ways.
  perform perform_fire(w, u, 'pick_up_smelter', jsonb_build_object('kind', 'smelter', 'id', v_sm));
  select i.id into v_back from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = 'smelter';
  insert into said select 'UP', coalesce(i.enchant::text, 'none') || '|' || item_name(i) from item i where i.id = v_back;
  perform perform_fire(w, u, 'place_smelter', jsonb_build_object('kind', 'tile', 'x', 41, 'y', 40, 'sx', 0, 'sy', 0, 'itemUid', v_back));
  select p.id into v_sm from placed p where p.world_id = w and p.kind = 'smelter' and p.x = 41 and p.y = 40;
  insert into said select 'DOWN', coalesce(p.enchant::text, 'none') from placed p where p.id = v_sm;
  -- Ember Heart in the fire: ten seconds of a lit smelter with a job on, and the fuel and the work it comes to.
  update placed set lit = true, fuel = 100, since = now() - interval '10 seconds',
         state = jsonb_build_object('jobs', jsonb_build_array(jsonb_build_object('left', 20, 'makes', 'copper_lump', 'ql', 50)), 'output', '[]'::jsonb)
   where id = v_sm;
  insert into said select 'RATE', placed_burn_rate(p)::text from placed p where p.id = v_sm;
  perform furnace_settle(w, v_sm);
  insert into said select 'BURN', p.fuel || '|' || (p.state->'jobs'->0->>'left') from placed p where p.id = v_sm;
  -- Masterwork: refused on a smelter, refused on a locked loom, and what it adds at the loom it stands on.
  v_s := give(w, u, 'masterwork_scroll', 1, 90);
  insert into said values ('R:mastersm', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'smelter', 'id', v_sm2, 'scroll', v_s)), 'none'));
  update placed set lock = 999999 where id = v_loom;
  insert into said values ('R:lock', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'furniture', 'id', v_loom, 'scroll', v_s)), 'none'));
  update placed set lock = null where id = v_loom;
  insert into said values ('R:loom', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'furniture', 'id', v_loom, 'scroll', v_s)), 'none'));
  insert into said values ('R:anvil', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'anvil', 'id', v_anv, 'scroll', v_s)), 'none'));
  update placed set enchant = '{"id": "masterwork", "ql": 60}'::jsonb where id = v_loom;
  insert into said values ('MASTER', station_master(w, u, 'loom')::text || '|' || station_master(w, u, 'campfire')::text);
  insert into said values ('MASTERSRC', (pg_get_functiondef('perform_craft(uuid, uuid, text, jsonb)'::regprocedure) like '%+ station_master(p_world, p_uid, r.station)%')::text
    || '|' || ((length(pg_get_functiondef('perform_forge(uuid, uuid, text, jsonb)'::regprocedure))
                - length(replace(pg_get_functiondef('perform_forge(uuid, uuid, text, jsonb)'::regprocedure), '+ placed_enchant(p, ''master'')', ''))) / length('+ placed_enchant(p, ''master'')'))::text);

  -- 9. Fair Wind, Deep Hold, True Axle and Bag of Holding: the refusals, and what each holds at QL 50 and 100.
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql) values (w, 'furniture', 'rowing_boat', 30, 30, 30.5, 30.5, 50) returning id into v_boat;
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql) values (w, 'furniture', 'sailing_boat', 30, 33, 30.5, 33.5, 50) returning id into v_ship;
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql) values (w, 'furniture', 'wagon', 33, 30, 33.5, 30.5, 50) returning id into v_wagon;
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql) values (w, 'furniture', 'chest', 33, 33, 33.5, 33.5, 50) returning id into v_chestp;
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql) values (w, 'furniture', 'barrel', 36, 30, 36.5, 30.5, 50) returning id into v_barrel;
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql) values (w, 'furniture', 'cart', 36, 33, 36.5, 33.5, 50) returning id into v_cart;
  v_bag := give(w, u, 'satchel', 1, 50);
  update player set x = 30.5, y = 31.5 where world_id = w and uid = u;
  v_s := give(w, u, 'fair_wind_scroll', 1, 90);
  insert into said values ('R:windrow', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'furniture', 'id', v_boat, 'scroll', v_s)), 'none'));
  insert into said values ('R:windship', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'furniture', 'id', v_ship, 'scroll', v_s)), 'none'));
  v_s := give(w, u, 'deep_hold_scroll', 1, 90);
  insert into said values ('R:deeprow', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'furniture', 'id', v_boat, 'scroll', v_s)), 'none'));
  update player set x = 33.5, y = 31.5 where world_id = w and uid = u;
  insert into said values ('R:deepwagon', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'furniture', 'id', v_wagon, 'scroll', v_s)), 'none'));
  v_s := give(w, u, 'true_axle_scroll', 1, 90);
  insert into said values ('R:axlewagon', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'furniture', 'id', v_wagon, 'scroll', v_s)), 'none'));
  insert into said values ('R:axlechest', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'furniture', 'id', v_chestp, 'scroll', v_s)), 'none'));
  v_s := give(w, u, 'bag_of_holding_scroll', 1, 90);
  insert into said values ('R:bagchest', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'furniture', 'id', v_chestp, 'scroll', v_s)), 'none'));
  insert into said values ('R:bagsatchel', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_bag, 'scroll', v_s)), 'none'));
  update placed set enchant = '{"id": "deep_hold", "ql": 60}'::jsonb where id = v_boat;
  update player set x = 30.5, y = 31.5 where world_id = w and uid = u;
  insert into said values ('R:bagheld', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'furniture', 'id', v_boat, 'scroll', v_s)), 'none'));
  update placed set enchant = null where id = v_boat;
  -- Plain, then at QL 50 and 100.
  insert into said select 'ROOM0', (select furniture_capacity(p) from placed p where id = v_boat) || '|' || (select furniture_capacity(p) from placed p where id = v_wagon)
    || '|' || (select furniture_capacity(p) from placed p where id = v_chestp) || '|' || (select liquid_capacity(p) from placed p where id = v_barrel)
    || '|' || (select furniture_capacity(p) from placed p where id = v_cart) || '|' || (select bag_room(i) from item i where id = v_bag);
  foreach v_q in array array[50, 100]::float8[] loop
    update placed set enchant = jsonb_build_object('id', 'deep_hold', 'ql', v_q) where id = v_boat;
    update placed set enchant = jsonb_build_object('id', 'true_axle', 'ql', v_q) where id = v_wagon;
    update placed set enchant = jsonb_build_object('id', 'bag_of_holding', 'ql', v_q) where id in (v_chestp, v_barrel, v_cart);
    update item set enchant = jsonb_build_object('id', 'bag_of_holding', 'ql', v_q) where id = v_bag;
    insert into said select 'ROOM' || v_q::int, (select furniture_capacity(p) from placed p where id = v_boat) || '|' || (select furniture_capacity(p) from placed p where id = v_wagon)
      || '|' || (select furniture_capacity(p) from placed p where id = v_chestp) || '|' || (select liquid_capacity(p) from placed p where id = v_barrel)
      || '|' || (select furniture_capacity(p) from placed p where id = v_cart) || '|' || (select bag_room(i) from item i where id = v_bag);
  end loop;
  insert into said values ('SAILSRC', (pg_get_functiondef('travel_speed(uuid, uuid)'::regprocedure) like '%* (1 + placed_enchant(p, ''sail''))%')::text);
  -- A crate: enchanted where it stands, what it holds, and up into the pack and down again.
  select coalesce(max(id), 0) + 1 into v_crate from crate where world_id = w;
  insert into crate (world_id, id, kind, x, y, sx, sy, made_by, ql) values (w, v_crate, 'plank', 30, 36, 1, 1, u, 50);
  update player set x = 30.5, y = 35.5 where world_id = w and uid = u;
  insert into said select 'CRATE0', crate_capacity(c)::text from crate c where world_id = w and id = v_crate;
  v_s := give(w, u, 'bag_of_holding_scroll', 1, 90);
  perform pg_temp.dice('0.01,0.5');
  perform perform_enchant(w, u, jsonb_build_object('kind', 'crate', 'id', v_crate, 'scroll', v_s));
  perform pg_temp.nodice();
  insert into said select 'CRATE', (c.enchant->>'ql') || '|' || crate_capacity(c) || '|' || ${lastSaid} from crate c where world_id = w and id = v_crate;
  perform perform_crate(w, u, 'pick_up_crate', jsonb_build_object('kind', 'crate', 'id', v_crate));
  select i.id into v_back from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def = 'crate_plank';
  insert into said select 'CRATEUP', coalesce(i.enchant->>'id', 'none') from item i where i.id = v_back;
  perform perform_crate(w, u, 'place_crate', jsonb_build_object('kind', 'tile', 'x', 30, 'y', 36, 'sx', 1, 'sy', 1, 'itemUid', v_back));
  insert into said select 'CRATEDOWN', coalesce(c.enchant->>'id', 'none') from crate c where world_id = w and c.x = 30 and c.y = 36;

  -- 10. Snarecraft, Netmender and Dreamweave: the refusals, a trap's chance, a net's wear, a night's rest.
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql) values (w, 'trap', 'snare', 20, 20, 20.5, 20.5, 30) returning id into v_trap;
  insert into placed (world_id, kind, sub, x, y, cx, cy, ql) values (w, 'furniture', 'bed', 21, 20, 21.5, 20.5, 50) returning id into v_bed;
  v_net := give(w, u, 'fishing_net', 1, 50);
  v_rod := give(w, u, 'fishing_rod', 1, 50);
  update player set x = 20.5, y = 21.5 where world_id = w and uid = u;
  v_s := give(w, u, 'snarecraft_scroll', 1, 90);
  insert into said values ('R:snaretrap', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'trap', 'id', v_trap, 'scroll', v_s)), 'none'));
  insert into said values ('R:snarebed', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'furniture', 'id', v_bed, 'scroll', v_s)), 'none'));
  v_s := give(w, u, 'netmender_scroll', 1, 90);
  insert into said values ('R:mendnet', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_net, 'scroll', v_s)), 'none'));
  insert into said values ('R:mendrod', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_rod, 'scroll', v_s)), 'none'));
  v_s := give(w, u, 'dreamweave_scroll', 1, 90);
  insert into said values ('R:dreambed', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'furniture', 'id', v_bed, 'scroll', v_s)), 'none'));
  insert into said values ('R:dreamtrap', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'trap', 'id', v_trap, 'scroll', v_s)), 'none'));
  v_c.species := 'orse';
  insert into said select 'SNARE', catch_chance(p, v_c)::text from placed p where id = v_trap;
  update placed set enchant = '{"id": "snarecraft", "ql": 100}'::jsonb where id = v_trap;
  insert into said select 'SNARE100', catch_chance(p, v_c)::text from placed p where id = v_trap;
  insert into said values ('CREELSRC', (pg_get_functiondef('trap_settle(bigint)'::regprocedure) like '%* (1 + placed_enchant(p, ''snare''))%')::text);
  -- A net's wear for one drag, plain and with a Netmender at QL 100; and its haul.
  perform wear_tool(v_net, 1.4);
  select dmg into v_d0 from item where id = v_net;
  update item set dmg = 0, enchant = '{"id": "netmender", "ql": 100}'::jsonb where id = v_net;
  perform wear_tool(v_net, 1.4);
  insert into said select 'WEAR', v_d0 || '|' || dmg from item where id = v_net;
  insert into said values ('HAULSRC', (pg_get_functiondef('perform_fish(uuid, uuid, text, jsonb)'::regprocedure) like '%* (1 + v_mend)%')::text);
  -- A night with rest already at the most banked: plain, it stays there; in a Dreamweave at QL 100, it goes that much past; plain again, nothing is lost.
  update player set rested = rest_cap(), rested_at = now() where world_id = w and uid = u;
  perform sleep_until_morning(w, u, 1, 'bed');
  insert into said select 'REST0', rested::text from player where world_id = w and uid = u;
  perform sleep_until_morning(w, u, 1, 'bed', enchant_hit_chance('dreamweave', 100));
  insert into said select 'REST100', rested::text from player where world_id = w and uid = u;
  perform sleep_until_morning(w, u, 1, 'bed');
  insert into said select 'RESTKEPT', rested::text from player where world_id = w and uid = u;
  -- 11. Fleetfoot and Tamer's Bridle: the refusals, a pile of its own, taming, and the tack on a mount and off it.
  insert into skill (world_id, uid, id, value) values (w, u, 'taming', 60) on conflict (world_id, uid, id) do update set value = excluded.value;
  v_sad := give(w, u, 'saddle', 1, 50);
  v_bri := give(w, u, 'bridle', 1, 50);
  v_s := give(w, u, 'fleetfoot_scroll', 1, 90);
  insert into said values ('R:fleetsaddle', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_sad, 'scroll', v_s)), 'none'));
  insert into said values ('R:fleetbridle', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_bri, 'scroll', v_s)), 'none'));
  v_s := give(w, u, 'tamers_bridle_scroll', 1, 90);
  insert into said values ('R:tamerbridle', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_bri, 'scroll', v_s)), 'none'));
  insert into said values ('R:tamersaddle', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_sad, 'scroll', v_s)), 'none'));
  update item set enchant = '{"id": "fleetfoot", "ql": 100}'::jsonb where id = v_sad;
  update item set enchant = '{"id": "tamers_bridle", "ql": 100}'::jsonb where id = v_bri;
  perform give(w, u, 'saddle', 1, 40);
  insert into said select 'PILES', count(*)::text from item where world_id = w and holder = 'player' and holder_uid = u and def = 'saddle';
  v_wild := creature_spawn(w, 'orse', 22.5, 21.5, 'wild', now() - interval '3 days', null);
  select * into v_w from creature where world_id = w and id = v_wild;
  insert into said select 'TAME', tame_chance(w, u, v_w)::text;
  update item set enchant = null where id = v_bri;
  insert into said select 'TAME0', tame_chance(w, u, v_w)::text;
  update item set enchant = '{"id": "tamers_bridle", "ql": 100}'::jsonb where id = v_bri;
  delete from creature where world_id = w and id = v_wild;
  v_mount := creature_spawn(w, 'orse', 20.5, 20.5, 'active', now() - interval '3 days', u);
  update creature set keeper = u, hunger = 1, from_x = 20.5, from_y = 20.5, to_x = 20.5, to_y = 20.5,
         leg_at = now(), leg_ends = now(), settled_at = now(), name = 'Greyfell' where world_id = w and id = v_mount;
  perform act_perform(w, u, 'tack_creature', jsonb_build_object('kind', 'creature', 'id', v_mount));
  insert into said select 'TACK', coalesce(c.tack_enchant->'saddle'->>'id', 'none') || '|' || coalesce(c.tack_enchant->'bridle'->>'id', 'none') || '|' || tack_speed(c)
    || '|' || coalesce((select x->'tack_enchant'->'saddle'->>'id' from jsonb_array_elements(rpc_creatures(w, 20)) x where (x->>'id')::int = v_mount), 'unsent')
    from creature c where world_id = w and id = v_mount;
  perform act_perform(w, u, 'untack_creature', jsonb_build_object('kind', 'creature', 'id', v_mount));
  insert into said select 'UNTACK', (select string_agg(i.def || '=' || coalesce(i.enchant->>'id', 'none'), '#' order by i.def, i.id)
      from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = u and i.def in ('saddle', 'bridle'))
    || '|' || coalesce((select tack_enchant::text from creature where world_id = w and id = v_mount), 'none');
  insert into said values ('LEASHSRC', (pg_get_functiondef('companion_target(uuid, creature, player)'::regprocedure) like '%c.tacked and tack_enchant_of(c, ''tame'') > 0%')::text);
  insert into said values ('DREAMSRC', (pg_get_functiondef('perform_last(uuid, uuid, text, jsonb)'::regprocedure) like '%placed_enchant(pc, ''dream'')%')::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const part = (k: string, i = 0): string => (isle.get(k) ?? '').split('|')[i] ?? '';
const num = (k: string, i = 0): number => Number(part(k, i));

/* ---- in the browser, the same ----------------------------------------------------- */

const g = Game.create(318, 256);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
g.inventory.items.length = 0;
g.putBody(40.5, 40.5, 0);
g.settings.fromStores = false;
// An enchanter's plinth within reach of every place the body stands, as on the island.
for (const [x, y] of [[41, 42], [47, 42], [28, 31], [35, 32], [28, 35], [19, 23]]) g.addFurniture(ENCHANTERS_PLINTH, x, y, 0, 0, 50);
const dice = (...xs: number[]): void => {
  let n = 0;
  g.rand = () => xs[n++ % xs.length];
};
const act = (id: string): ActionDef => ACTION_BY_ID.get(id) as ActionDef;
const thing = (id: string, ql: number, extra?: string): Item => g.gather(id, { count: 1, ql, ...(extra ? { extra } : {}) });
g.skills.values.set('enchanting', 100);
const ring = thing('jewelled_ring', 100, 'Ruby');
const pend = thing('jewelled_pendant', 100, 'Ruby');
const askWith = (e: EnchantmentDef, uid: number): string => {
  const sc = thing(e.scroll, 90);
  return act('enchant').check?.({ kind: 'item', uid, scroll: sc.uid } as Target, g) ?? 'none';
};

/* 1. Refusals. */
const refusals: Array<[string, string, string]> = [
  ['R:scholarpend', askWith(SCHOLAR, pend.uid), wrongKind(SCHOLAR)], ['R:scholarring', askWith(SCHOLAR, ring.uid), 'none'],
  ['R:heartring', askWith(HEART, ring.uid), wrongKind(HEART)], ['R:heartpend', askWith(HEART, pend.uid), 'none'],
];
check(`Scholar's Band and Knackstone go on a jewelled ring, the other four on a jewelled pendant, and each is refused on the other in words that say so, on both sides: ${wrongKind(SCHOLAR)} ${wrongKind(HEART)}`,
  refusals.every(([k, here, want]) => isle.get(k) === want && here === want),
  refusals.map(([k, here, want]) => `${k}: ${isle.get(k)} / ${here} / ${want}`).join('; '));

/* 2. Scholar's Band. */
ring.enchant = { id: SCHOLAR.id, ql: 100 };
g.player.equipped.jewel = null;
const learn0 = g.skillMult('mining');
g.player.equipped.jewel = ring.uid;
const learn = g.skillMult('mining');
check(`Scholar's Band at QL 100 worn: every go teaches ${enchantValue(SCHOLAR, 100) * 100}% more, added as a stone's is, on both sides`,
  near(learn - learn0, enchantValue(SCHOLAR, 100)) && near(num('LEARN') - num('LEARN0'), enchantValue(SCHOLAR, 100)) && near(num('LEARN0'), learn0),
  `${isle.get('LEARN0')} ${isle.get('LEARN')} / ${learn0} ${learn}`);

/* 3. Knackstone. */
ring.enchant = { id: KNACK.id, ql: 100 };
const c0 = knackChance('mining', 1, 1);
const earn = (g as unknown as { earnKnacks(s: string, b: number): void }).earnKnacks.bind(g);
g.player.knacks = {};
g.player.equipped.jewel = null;
dice(c0 * 1.25);
earn('mining', 1);
const knack0 = g.player.knacks.mining ?? 0;
g.player.equipped.jewel = ring.uid;
dice(c0 * 1.25);
earn('mining', 1);
const knack1 = g.player.knacks.mining ?? 0;
check(`Knackstone at QL 100 worn: the chance of a knack is ${times(1 + enchantValue(KNACK, 100))} the plain one, so a roll a quarter over the plain chance gives nothing without it and a knack with it, on both sides`,
  knack0 === 0 && knack1 === 1 && part('KNACK0') === '0' && part('KNACK', 0) === '1' && near(num('KNACK', 1), c0, 1e-12),
  `${isle.get('KNACK0')} ${isle.get('KNACK')} / ${knack0} ${knack1} ${c0}`);

/* 4. Steady Heart and Hearthbound. */
g.player.equipped.jewel = pend.uid;
pend.enchant = { id: HEART.id, ql: 100 };
const windMul = g.windMul();
pend.enchant = { id: HEARTH.id, ql: 100 };
const upkeepMul = g.upkeepMul();
const wound0 = num('BODY0', 0) - 0.3;
check(`Steady Heart at QL 100 worn: the wind comes back ${enchantValue(HEART, 100) * 100}% faster over the same four seconds, on both sides`,
  near(windMul, 1 + enchantValue(HEART, 100)) && wound0 > 0 && near((num('WIND') - 0.3) / wound0, windMul, 1e-6),
  `${isle.get('BODY0')} ${isle.get('WIND')} / ${windMul}`);
check(`Hearthbound at QL 100 worn: hunger and thirst fall ${enchantValue(HEARTH, 100) * 100}% slower over the same four seconds, on both sides`,
  near(upkeepMul, 1 - enchantValue(HEARTH, 100)) && 0.9 - num('BODY0', 1) > 0
    && near((0.9 - num('UPKEEP', 0)) / (0.9 - num('BODY0', 1)), upkeepMul, 1e-6) && near((0.9 - num('UPKEEP', 1)) / (0.9 - num('BODY0', 2)), upkeepMul, 1e-6),
  `${isle.get('BODY0')} ${isle.get('UPKEEP')} / ${upkeepMul}`);

/* 5. Favoured. */
pend.enchant = { id: FAVOUR.id, ql: 100 };
check(`Favoured at QL 100 worn: a prayer gives ${enchantValue(FAVOUR, 100) * 100}% more favour, on both sides`,
  // Favour is kept as a real, so to its sixth figure.
  near(g.wornEnchant('favour'), enchantValue(FAVOUR, 100)) && num('FAVOUR0') > 0
    && near(num('FAVOUR') / num('FAVOUR0'), 1 + enchantValue(FAVOUR, 100), 1e-5),
  `${isle.get('FAVOUR0')} ${isle.get('FAVOUR')}`);

/* 6. Stillwater. */
pend.enchant = { id: STILL.id, ql: 100 };
g.player.equipped.jewel = null;
const calm0 = sittingWorth(g).calm;
g.player.equipped.jewel = pend.uid;
const calm = sittingWorth(g).calm;
check(`Stillwater at QL 100 worn: a sitting banks ${enchantValue(STILL, 100) * 100}% more Calm, on both sides`,
  near(calm, calm0 * (1 + enchantValue(STILL, 100))) && num('CALM0') > 0 && near(num('CALM'), num('CALM0') * (1 + enchantValue(STILL, 100))),
  `${isle.get('CALM0')} ${isle.get('CALM')} / ${calm0} ${calm}`);

/* 7. Packmule, Seal's Coat, Hawk's Eye. */
g.player.equipped.jewel = null;
const pack = thing('backpack', 100);
const jerkin = thing('leather_jerkin', 100);
const cap = thing('leather_cap', 100);
const refusals3b: Array<[string, string, string]> = [
  ['R:mulechest', askWith(MULE, jerkin.uid), wrongKind(MULE)], ['R:mulepack', askWith(MULE, pack.uid), 'none'],
  ['R:sealcap', askWith(SEAL, cap.uid), wrongKind(SEAL)], ['R:sealchest', askWith(SEAL, jerkin.uid), 'none'],
  ['R:hawkchest', askWith(HAWK, jerkin.uid), wrongKind(HAWK)], ['R:hawkcap', askWith(HAWK, cap.uid), 'none'],
];
check(`Packmule goes on a backpack or a satchel, Seal's Coat on what is worn on the chest, Hawk's Eye on the head, each refused elsewhere in words that say so, on both sides`,
  refusals3b.every(([k, here, want]) => isle.get(k) === want && here === want),
  refusals3b.map(([k, here, want]) => `${k}: ${isle.get(k)} / ${here} / ${want}`).join('; '));
const carry0 = g.carryLimit();
pack.enchant = { id: MULE.id, ql: 100 };
const carry = g.carryLimit();
check(`a Packmule at QL 100 on a backpack carried: ${enchantValue(MULE, 100)} kilos more before the weight tells, on both sides`,
  near(carry - carry0, enchantValue(MULE, 100)) && near(num('CARRY') - num('CARRY0'), enchantValue(MULE, 100)), `${isle.get('CARRY0')} ${isle.get('CARRY')} / ${carry0} ${carry}`);
g.player.equipped.chest = jerkin.uid;
const wind0 = g.swimWind();
jerkin.enchant = { id: SEAL.id, ql: 100 };
const wind = g.swimWind();
check(`a Seal's Coat at QL 100 worn: swimming costs ${enchantValue(SEAL, 100) * 100}% less stamina in the browser and in the island's body_settle`,
  wind0 > 0 && near(wind, wind0 * (1 - enchantValue(SEAL, 100))) && isle.get('SWIMSRC') === 'true', `${wind0} ${wind} ${isle.get('SWIMSRC')}`);
g.player.equipped.head = cap.uid;
const sight0 = g.vision.sightRange();
cap.enchant = { id: HAWK.id, ql: 100 };
const sight = g.vision.sightRange();
check(`a Hawk's Eye at QL 100 worn: sight ${enchantValue(HAWK, 100) * 100}% further (the browser's own reckoning; the island keeps no sight)`,
  sight0 > 3 && near(sight, sight0 * (1 + enchantValue(HAWK, 100))), `${sight0} ${sight}`);

/* 8. Things standing where they were set down: Ember Heart and Masterwork. */
const said: string[] = [];
const logOf = g.logMsg.bind(g);
g.logMsg = (m: string, k?: Parameters<typeof logOf>[1]) => { said.push(m); logOf(m, k); };
g.player.equipped = {};
const sm = g.addSmelter(41, 40, 0, 0, 60);
const sm2 = g.addSmelter(39, 41, 0, 0, 60);
const anv = g.addAnvil(39, 40, 0, 0, 'iron', 50);
const loom = g.addFurniture('loom', 40, 41, 0, 0, 50);
const placedAsk = (e: EnchantmentDef, t: Target): string => act('enchant').check?.({ ...t, scroll: thing(e.scroll, 90).uid } as Target, g) ?? 'none';
const placedRefusals: Array<[string, string, string]> = [
  ['R:embanvil', placedAsk(EMBER, { kind: 'anvil', id: anv.id }), wrongKind(EMBER)],
  ['R:embsm', placedAsk(EMBER, { kind: 'smelter', id: sm.id }), 'none'],
  ['R:mastersm', placedAsk(MASTER, { kind: 'smelter', id: sm2.id }), wrongKind(MASTER)],
  ['R:loom', placedAsk(MASTER, { kind: 'furniture', id: loom.id }), 'none'],
  ['R:anvil', placedAsk(MASTER, { kind: 'anvil', id: anv.id }), 'none'],
];
g.putBody(46.5, 40.5, 0);
placedRefusals.push(['R:far', placedAsk(EMBER, { kind: 'smelter', id: sm.id }), ENCHANT_SAID.reach]);
g.putBody(40.5, 40.5, 0);
loom.lock = 999999;
placedRefusals.push(['R:lock', placedAsk(MASTER, { kind: 'furniture', id: loom.id }), 'It is locked, and you have no key to it.']);
loom.lock = undefined;
check(`Ember Heart goes on ${ON_WORDS.furnace} and Masterwork on ${ON_WORDS.station}, enchanted where they stand: each refused on the other kind, out of reach, and past a padlock you have no key to, in the same words on both sides`,
  placedRefusals.every(([k, here, want]) => isle.get(k) === want && here === want),
  placedRefusals.map(([k, here, want]) => `${k}: ${isle.get(k)} / ${here} / ${want}`).join('; '));
const placedGo = (e: EnchantmentDef, t: Target, ...rolls: number[]): string => {
  dice(...rolls);
  act('enchant').perform({ ...t, scroll: thing(e.scroll, 90).uid } as Target, g);
  return said[said.length - 1];
};
const took = placedGo(EMBER, { kind: 'smelter', id: sm.id }, 0.01, 0.5);
check('a scroll that takes on a smelter where it stands: the same quality, held to the smelter\'s, and the same words on both sides',
  took === part('EMB', 1) && near(sm.enchant?.ql ?? -1, num('EMB', 0)) && took.includes('held to the smelter\'s QL 60.0'), `${isle.get('EMB')} / ${sm.enchant?.ql} ${took}`);
const miss = placedGo(EMBER, { kind: 'smelter', id: sm2.id }, 0.99, 0.01);
sm2.dmg = 90;
const miss2 = placedGo(EMBER, { kind: 'smelter', id: sm2.id }, 0.99, 0.01);
check(`one that does not take leaves the scroll's ${ENCHANT_HARM} damage on a placed thing and never breaks it, even on the roll that breaks a thing in the pack: the harm stops at ${DAMAGE_MAX - 1}, on both sides`,
  miss === part('MISS', 1) && num('MISS', 0) === ENCHANT_HARM && miss2 === part('MISS2', 2) && num('MISS2', 0) === DAMAGE_MAX - 1 && sm2.dmg === DAMAGE_MAX - 1
    && part('MISS2', 1) === 'true' && g.smelters.has(sm2.id),
  `${isle.get('MISS')} ${isle.get('MISS2')} / ${miss} ${miss2}`);
check('picked up, the smelter carries its enchantment in the pack, and set down again it carries it back to the ground, on the island',
  part('UP', 0).includes('"ember_heart"') && part('UP', 1).endsWith('(Ember Heart)') && isle.get('DOWN') === part('UP', 0), `${isle.get('UP')} ${isle.get('DOWN')}`);
sm.lit = true;
sm.fuel = 100;
sm.jobs = [{ left: 20, makes: 'copper_lump', ql: 50 } as unknown as (typeof sm.jobs)[number]];
(g as unknown as { runSmelters(dt: number): void }).runSmelters(10);
const rate = 1 - enchantValue(EMBER, sm.enchant?.ql ?? 0);
check(`an Ember Heart at QL ${sm.enchant?.ql.toFixed(1)}: ten seconds of heat take ${(10 * rate).toFixed(1)} fuel and do ten seconds of work, on both sides`,
  near(num('RATE'), rate) && near(sm.fuel, 100 - 10 * rate, 1e-9) && near(num('BURN', 0), 100 - 10 * rate, 1e-3)
    && near(sm.jobs[0]?.left ?? -1, 10, 1e-9) && near(num('BURN', 1), 10, 1e-3), `${isle.get('RATE')} ${isle.get('BURN')} / ${sm.fuel} ${sm.jobs[0]?.left}`);
loom.enchant = { id: MASTER.id, ql: 60 };
check(`a Masterwork at QL 60 on a loom adds ${enchantValue(MASTER, 60)} to the quality of what is made at it, and nothing at a fire, on both sides; the island's craft and forge add it`,
  near(g.masterAt('loom'), enchantValue(MASTER, 60)) && g.masterAt('campfire') === 0 && near(num('MASTER', 0), enchantValue(MASTER, 60)) && num('MASTER', 1) === 0
    && isle.get('MASTERSRC') === 'true|2', `${isle.get('MASTER')} ${isle.get('MASTERSRC')} / ${g.masterAt('loom')}`);

/* 9. Fair Wind, Deep Hold, True Axle and Bag of Holding. */
const boat = g.addFurniture('rowing_boat', 30, 30, 0, 0, 50);
const ship = g.addFurniture('sailing_boat', 30, 33, 0, 0, 50);
const wagon = g.addFurniture('wagon', 33, 30, 0, 0, 50);
const chestP = g.addFurniture('chest', 33, 33, 0, 0, 50);
const barrel = g.addFurniture('barrel', 36, 30, 0, 0, 50);
const cart = g.addFurniture('cart', 36, 33, 0, 0, 50);
const satchel = thing('satchel', 50);
const at = (x: number, y: number): void => g.putBody(x, y, 0);
const fu = (f: { id: number }): Target => ({ kind: 'furniture', id: f.id });
at(30.5, 31.5);
const roomRefusals: Array<[string, string, string]> = [
  ['R:windrow', placedAsk(WIND, fu(boat)), wrongKind(WIND)], ['R:windship', placedAsk(WIND, fu(ship)), 'none'],
  ['R:deeprow', placedAsk(DEEP, fu(boat)), 'none'],
];
at(33.5, 31.5);
roomRefusals.push(['R:deepwagon', placedAsk(DEEP, fu(wagon)), wrongKind(DEEP)], ['R:axlewagon', placedAsk(AXLE, fu(wagon)), 'none'],
  ['R:axlechest', placedAsk(AXLE, fu(chestP)), wrongKind(AXLE)], ['R:bagchest', placedAsk(BAG, fu(chestP)), 'none'],
  ['R:bagsatchel', askWith(BAG, satchel.uid), 'none']);
boat.enchant = { id: DEEP.id, ql: 60 };
at(30.5, 31.5);
roomRefusals.push(['R:bagheld', placedAsk(BAG, fu(boat)), alreadyEnchanted({ id: DEEP.id, ql: 60 })]);
delete boat.enchant;
check(`Fair Wind goes on ${ON_WORDS.ship}, Deep Hold on ${ON_WORDS.hull}, True Axle on ${ON_WORDS.cart} and Bag of Holding on ${ON_WORDS.store}: each refused elsewhere, and one already holding an enchantment says which, on both sides`,
  roomRefusals.every(([k, here, want]) => isle.get(k) === want && here === want),
  roomRefusals.map(([k, here, want]) => `${k}: ${isle.get(k)} / ${here} / ${want}`).join('; '));
const rooms = (): string => [furnitureCapacity(boat), furnitureCapacity(wagon), furnitureCapacity(chestP), liquidCapacity(barrel), furnitureCapacity(cart), bagRoom(satchel)].join('|');
const room0 = rooms();
const roomAt: Record<number, string> = {};
for (const q of [50, 100]) {
  boat.enchant = { id: DEEP.id, ql: q };
  wagon.enchant = { id: AXLE.id, ql: q };
  for (const f of [chestP, barrel, cart]) f.enchant = { id: BAG.id, ql: q };
  satchel.enchant = { id: BAG.id, ql: q };
  roomAt[q] = rooms();
}
const base = room0.split('|').map(Number);
const want = (q: number): number[] => base.map((n, i) => Math.round(n * (1 + enchantValue(i === 0 ? DEEP : i === 1 ? AXLE : BAG, q))));
check(`what each holds, plain and at QL 50 and 100, the same on both sides: Deep Hold and True Axle ${enchantValue(DEEP, 100) * 100}% more at QL 100, a Bag of Holding ${1 + enchantValue(BAG, 100)} times as much on a chest, a barrel's litres, a cart and a satchel`,
  isle.get('ROOM0') === room0 && isle.get('ROOM50') === roomAt[50] && isle.get('ROOM100') === roomAt[100]
    && roomAt[100] === want(100).join('|') && roomAt[50] === want(50).join('|'),
  `${isle.get('ROOM0')} ${isle.get('ROOM50')} ${isle.get('ROOM100')} / ${room0} ${roomAt[50]} ${roomAt[100]} / ${want(50).join('|')} ${want(100).join('|')}`);
const sail0 = g.boatSpeed(ship);
ship.enchant = { id: WIND.id, ql: 100 };
const sail = g.boatSpeed(ship);
check(`a Fair Wind at QL 100 on a sailing boat: ${enchantValue(WIND, 100) * 100}% faster under sail, in the browser and in the island's travel_speed`,
  sail0 > 0 && near(sail / sail0, 1 + enchantValue(WIND, 100)) && isle.get('SAILSRC') === 'true', `${sail0} ${sail} ${isle.get('SAILSRC')}`);
const crateP = g.addCrate('plank', 30, 36, 1, 1, [], false, undefined, 50);
at(30.5, 35.5);
const crate0 = crateCapacity(crateP);
const crateSaid = placedGo(BAG, { kind: 'crate', id: crateP.id }, 0.01, 0.5);
check('a crate takes a Bag of Holding where it stands, the same quality and words and what it then holds on both sides, and keeps it through being picked up and set down on the island',
  isle.get('CRATE0') === String(crate0) && near(crateP.enchant?.ql ?? -1, num('CRATE', 0)) && part('CRATE', 1) === String(crateCapacity(crateP))
    && crateSaid === part('CRATE', 2) && isle.get('CRATEUP') === BAG.id && isle.get('CRATEDOWN') === BAG.id,
  `${isle.get('CRATE0')} ${isle.get('CRATE')} ${isle.get('CRATEUP')} ${isle.get('CRATEDOWN')} / ${crate0} ${crateP.enchant?.ql} ${crateCapacity(crateP)} ${crateSaid}`);

/* 10. Snarecraft, Netmender and Dreamweave. */
const trapP = g.addTrap('snare', 20, 20, 1, 1, 30);
const bedP = g.addFurniture('bed', 21, 20, 0, 0, 50);
const net = thing('fishing_net', 50);
const rod = thing('fishing_rod', 50);
at(20.5, 21.5);
const trapRefusals: Array<[string, string, string]> = [
  ['R:snaretrap', placedAsk(SNARE, { kind: 'trap', id: trapP.id }), 'none'], ['R:snarebed', placedAsk(SNARE, fu(bedP)), wrongKind(SNARE)],
  ['R:mendnet', askWith(MEND, net.uid), 'none'], ['R:mendrod', askWith(MEND, rod.uid), wrongKind(MEND)],
  ['R:dreambed', placedAsk(DREAM, fu(bedP)), 'none'], ['R:dreamtrap', placedAsk(DREAM, { kind: 'trap', id: trapP.id }), wrongKind(DREAM)],
];
check(`Snarecraft goes on ${ON_WORDS.trap}, Netmender on ${ON_WORDS.net} and Dreamweave on ${ON_WORDS.bed}, each refused elsewhere in words that say so, on both sides`,
  trapRefusals.every(([k, here, want]) => isle.get(k) === want && here === want),
  trapRefusals.map(([k, here, want]) => `${k}: ${isle.get(k)} / ${here} / ${want}`).join('; '));
const orse = { species: 'orse' } as unknown as Creature;
const snare0 = catchChance(trapP, orse);
trapP.enchant = { id: SNARE.id, ql: 100 };
const snare100 = catchChance(trapP, orse);
check(`a Snarecraft at QL 100 on a snare: its chance of taking a creature ${enchantValue(SNARE, 100) * 100}% better, never past ${CATCH_MOST * 100}%, on both sides; a creel's chance of a fish the same, in the island's trap_settle`,
  near(num('SNARE'), snare0) && near(num('SNARE100'), snare100) && near(snare100, Math.min(CATCH_MOST, snare0 * (1 + enchantValue(SNARE, 100)))) && snare100 > snare0
    && isle.get('CREELSRC') === 'true', `${isle.get('SNARE')} ${isle.get('SNARE100')} ${isle.get('CREELSRC')} / ${snare0} ${snare100}`);
g.inventory.items.splice(g.inventory.items.indexOf(rod), 1);
g.wearTool('fishing_net', 1.4);
const wear0 = net.dmg ?? 0;
net.dmg = 0;
net.enchant = { id: MEND.id, ql: 100 };
g.wearTool('fishing_net', 1.4);
const wear100 = net.dmg ?? 0;
check(`a Netmender at QL 100 on a net: a drag wears it ${enchantValue(MEND, 100) * NETMENDER_WEAR * 100}% less, the same on both sides, and brings up ${enchantValue(MEND, 100) * 100}% more fish in the island's perform_fish`,
  wear0 > 0 && near(wear100, wear0 * (1 - enchantValue(MEND, 100) * NETMENDER_WEAR)) && near(num('WEAR', 0), wear0, 1e-4) && near(num('WEAR', 1), wear100, 1e-4)
    && isle.get('HAULSRC') === 'true', `${isle.get('WEAR')} ${isle.get('HAULSRC')} / ${wear0} ${wear100}`);
g.player.rested = REST_CAP;
const night = 8 * 3600;
g.bankRest(night, 1);
const rest0 = g.player.rested;
g.bankRest(night, 1, enchantValue(DREAM, 100));
const rest100 = g.player.rested;
g.bankRest(night, 1);
check(`a night in a bed with a Dreamweave at QL 100 banks ${enchantValue(DREAM, 100) * 100}% more rest, past the most a night otherwise banks, and a plain night after takes none of it away, on both sides`,
  rest0 === REST_CAP && near(rest100, REST_CAP * (1 + enchantValue(DREAM, 100))) && g.player.rested === rest100
    && near(num('REST0'), rest0) && near(num('REST100'), rest100) && near(num('RESTKEPT'), rest100) && isle.get('DREAMSRC') === 'true',
  `${isle.get('REST0')} ${isle.get('REST100')} ${isle.get('RESTKEPT')} ${isle.get('DREAMSRC')} / ${rest0} ${rest100} ${g.player.rested}`);

/* 11. Fleetfoot and Tamer's Bridle. */
const saddle = thing('saddle', 50);
const bridle = thing('bridle', 50);
const tackRefusals: Array<[string, string, string]> = [
  ['R:fleetsaddle', askWith(FLEET, saddle.uid), 'none'], ['R:fleetbridle', askWith(FLEET, bridle.uid), wrongKind(FLEET)],
  ['R:tamerbridle', askWith(TAMER, bridle.uid), 'none'], ['R:tamersaddle', askWith(TAMER, saddle.uid), wrongKind(TAMER)],
];
check(`Fleetfoot goes on ${ON_WORDS.saddle} and Tamer's Bridle on ${ON_WORDS.bridle}, each refused on the other in words that say so, on both sides`,
  tackRefusals.every(([k, here, want]) => isle.get(k) === want && here === want),
  tackRefusals.map(([k, here, want]) => `${k}: ${isle.get(k)} / ${here} / ${want}`).join('; '));
saddle.enchant = { id: FLEET.id, ql: 100 };
bridle.enchant = { id: TAMER.id, ql: 100 };
const plainSaddle = thing('saddle', 40);
check('an enchanted saddle is a pile of its own beside a plain one, on both sides',
  !sameStack(saddle, plainSaddle) && g.inventory.items.filter((it) => it.id === 'saddle').length === 2 && isle.get('PILES') === '2',
  `${isle.get('PILES')} / ${g.inventory.items.filter((it) => it.id === 'saddle').length}`);
g.skills.values.set('taming', 60);
const wildOrse = g.creatures.spawn('orse', 22.5, 21.5, 'wild', () => 0.5, g.time - 3 * DAY_SECONDS);
wildOrse.hunger = 1;
const tame100 = tameChance(g, wildOrse);
delete bridle.enchant;
const tame0 = tameChance(g, wildOrse);
bridle.enchant = { id: TAMER.id, ql: 100 };
g.creatures.list.delete(wildOrse.id);
check(`a Tamer's Bridle at QL 100 in the pack: an offering ${enchantValue(TAMER, 100) * 100}% likelier to tame, on both sides`,
  tame0 > 0 && near(tame100 / tame0, 1 + enchantValue(TAMER, 100)) && near(num('TAME') / num('TAME0'), 1 + enchantValue(TAMER, 100)),
  `${isle.get('TAME')} ${isle.get('TAME0')} / ${tame100} ${tame0}`);
const mount = g.creatures.spawn('orse', 20.5, 20.5, 'active', () => 0.5, g.time - 3 * DAY_SECONDS);
mount.hunger = 1;
const plainSpeed = tackSpeed(mount);
act('tack_creature').perform({ kind: 'creature', id: mount.id } as Target, g);
const tackedSpeed = tackSpeed(mount);
const onIt = `${mount.tackEnchant?.saddle?.id ?? 'none'}|${mount.tackEnchant?.bridle?.id ?? 'none'}`;
check(`a Fleetfoot at QL 100 in the saddle on a mount: it carries you ${enchantValue(FLEET, 100) * 100}% faster; both pieces ride on the mount and the island tells the browser, on both sides`,
  onIt === `${FLEET.id}|${TAMER.id}` && near(tackedSpeed, plainSpeed * (1 + enchantValue(FLEET, 100)))
    && isle.get('TACK') === `${onIt}|${tackedSpeed}|${FLEET.id}`, `${isle.get('TACK')} / ${onIt}|${tackedSpeed}`);
check('a mount wearing a Tamer\'s Bridle never breaks off a fight, however far from you it goes, in the browser and in the island\'s companion_target',
  tackEnchant(mount, 'tame') > 0 && isle.get('LEASHSRC') === 'true', `${tackEnchant(mount, 'tame')} ${isle.get('LEASHSRC')}`);
act('untack_creature').perform({ kind: 'creature', id: mount.id } as Target, g);
const back = g.inventory.items.filter((it) => it.id === 'saddle' || it.id === 'bridle').sort((a, b) => a.id.localeCompare(b.id) || a.uid - b.uid)
  .map((it) => `${it.id}=${it.enchant?.id ?? 'none'}`).join('#');
check('taken off, the saddle and bridle come back into the pack with their enchantments, on both sides',
  isle.get('UNTACK') === `${back}|none` && back.includes(`saddle=${FLEET.id}`) && back.includes(`bridle=${TAMER.id}`) && !mount.tackEnchant,
  `${isle.get('UNTACK')} / ${back}`);

check('every one of them is in the table once', ENCHANTMENT_LIST.filter((e) => PART3.includes(e)).length === PART3.length);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nenchanting, part 3 — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);

function times(x: number): string {
  return `${Number(x.toFixed(2))} times`;
}
