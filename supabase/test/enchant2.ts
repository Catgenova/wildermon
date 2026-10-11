/**
 * Enchanting, part 2 (`enchant.ts`, `enchanting.ts`), on both sides: the
 * enchantments after the first three.
 *
 * For each: its scroll's recipe, the same on both sides (Leeching's a life
 * mote and a dark one, the rest two of one element); what Examine says it does
 * at its quality, with the exact figure; the refusal that names what it goes
 * on; and what it does, measured the same way on both sides:
 *
 *   * Venomfang: a roll just over its chance does nothing, just under puts
 *     venom in the creature (its bleed at `VENOM_DRAIN` of its full health);
 *   * Gale: a swing's time, with it and without;
 *   * Nightblade: the chance of a critical blow, with it and without;
 *   * Sunstrike: a blow's damage on a hostile monster and on a creature that
 *     is not one;
 *   * Leeching: the health a hit gives back, every hit, with no roll;
 *   * Tidecaller: how far a hit puts the creature's next blow back;
 *   * Farsight: a bow's reach, with it and without;
 *   * Flamearrow and Frostbite: a shot's roll just over and just under, the
 *     burn, and the slow on both sides and in the creatures' door;
 *   * what is worn: Stoneskin, Emberward, Featherstep, Bulwark, Shadowcloak
 *     and Thornhide;
 *   * the tools: Swiftwork on a job's time, Truesteel on a use's wear, and
 *     Bountiful and Lodestone's one more, a roll just over and just under.
 *
 * Every roll is set: dice on the island (`random()` read off a list) and the
 * same list as the browser's `rand`. Runs against the database the suite
 * leaves behind; the island half is rolled back.
 *
 *   npx esbuild supabase/test/enchant2.ts --bundle --platform=node --format=esm \
 *     --external:typescript --outfile=node_modules/.cache/enchant2.mjs && node node_modules/.cache/enchant2.mjs
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import type { Item } from '../../src/game/items';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { EMBERWARD_CAP, ENCHANTMENT_LIST, ENCHANTMENTS, enchantHitChance, enchantValue, FROST_PACE, FROST_SECS, STONESKIN_CAP, wrongKind, type EnchantmentDef } from '../../src/game/enchant';
import { drainSecs, ENCHANT_BURN, enchantLineAt, enchantMore, enchantRoll, enchantSays, enchantWorks, leechHeal, shotRoll, slowed } from '../../src/game/enchanting';
import { classDealt } from '../../src/game/creatureActions';
import { blowEvery, bowReach, fightBase, myCritChance, VENOM_DRAIN } from '../../src/game/fight';
import { WEAPON_BY_ID } from '../../src/game/gear';
import { BLOW_SHARE, maxHealth, SPECIES, type Creature } from '../../src/game/creatures';
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

/** Everything after the first three: what this test is about. */
const LATER = ENCHANTMENT_LIST.slice(3);
const E = (id: string): EnchantmentDef => ENCHANTMENTS[id];
const [VENOM, GALE, NIGHT, SUN, LEECH, TIDE, FAR, FLAME, FROST] = ['venomfang', 'gale', 'nightblade', 'sunstrike', 'leeching', 'tidecaller', 'farsight', 'flamearrow', 'frostbite'].map(E);

/* ---- the scrolls and the words, on both sides ------------------------------ */

const billIsle = psql(`select string_agg(r.id || '=' || (select string_agg(ri.item || '*' || ri.count, '+' order by ri.item) from recipe_input ri where ri.recipe = r.id),
  '|' order by r.id) from recipe r where r.id like 'make\\_%\\_scroll'`);
const billHere = ENCHANTMENT_LIST.map((e) => `make_${e.scroll}=${[...(RECIPE_BY_ID.get(`make_${e.scroll}`)?.inputs ?? [])]
  .sort((a, b) => a.item.localeCompare(b.item)).map((i) => `${i.item}*${i.count ?? 1}`).join('+')}`).sort().join('|');
check(`every scroll is written from the same papyrus and motes on both sides: ${LATER.map((e) => `${e.name} (${e.motes.map(([m, n]) => `${n} ${m}`).join(' + ')})`).join(', ')}`,
  billIsle === billHere && billHere.includes('make_leeching_scroll=dark_mote*1+life_mote*1+papyrus*1') && billHere.includes('make_gale_scroll=papyrus*1+wind_mote*2'),
  billIsle === billHere ? '' : `${billIsle} / ${billHere}`);

const QLS = [0.4, 37.48, 50, 100, 140];
const saysIsle = psql(`select string_agg(enchant_says(jsonb_build_object('id', e.id, 'ql', q)), '#' order by e.ord, o)
  from enchantments() e, unnest(array[${QLS.join(',')}]::float8[]) with ordinality u(q, o) where e.ord >= 3`);
// Trimmed as the island's answer is: each line starts with a space.
const saysHere = LATER.flatMap((e) => QLS.map((q) => enchantSays({ enchant: { id: e.id, ql: q } }))).join('#').trim();
check('Examine says each at its quality in the same words on both sides', saysIsle === saysHere,
  saysIsle === saysHere ? '' : (() => { const i = [...saysIsle].findIndex((ch, k) => ch !== saysHere[k]); return `at ${i}: ${saysIsle.slice(i - 40, i + 60)} / ${saysHere.slice(i - 40, i + 60)}`; })());
const at100 = (e: EnchantmentDef): string => enchantLineAt(e, 100);
check('and the figures at QL 100 are the owner\'s: Venomfang 25% of hits, Gale 10% off a swing, Nightblade 5 points of critical chance, Sunstrike 25% on a monster, Leeching 10% of the damage, Tidecaller 20% of the time between blows',
  at100(VENOM).includes('puts venom in the target 25% of the time') && at100(GALE).includes('takes 10% less time')
    && at100(NIGHT).startsWith('5% more of its blows') && at100(SUN).includes('does 25% more damage to a hostile monster')
    && at100(LEECH).includes('gives you back 10% of the damage') && at100(TIDE).includes('back by 20% of the time between its blows')
    && near(enchantValue(GALE, 140), 0.1),
  LATER.map(at100).join(' # '));

/* ---- on the island --------------------------------------------------------------- */

const MIRA = 'e1c4a170-0000-4000-8000-000000000002';
const HIT_QL = 50;
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
create or replace function perk_rare(p_chance double precision) returns text language sql as 'select null::text';
create or replace function rarity_roll() returns text language sql as 'select null::text';
do $t$
declare w uuid; u uuid := '${MIRA}'; v_sw bigint; v_bow bigint; v_s bigint; v_c creature; v_g creature; v_until timestamptz;
        v_boot bigint; v_chest bigint; v_cap bigint; v_arm bigint; v_leg bigint; v_sh bigint;
        v_saw bigint; v_sick bigint; v_pick bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Enchanting 2', 218, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
  update player set x = 40.5, y = 40.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb, craft_from_stores = false,
         class_mul = null, combat_class = null, craft_class = null, wounds = '[]'::jsonb, blessings = '{}'::jsonb,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w and uid = u;
  insert into skill (world_id, uid, id, value) values (w, u, 'swords', 30), (w, u, 'enchanting', 100)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  v_sw := give(w, u, 'sword', 1, 100, 'Iron');
  v_bow := give(w, u, 'short_bow', 1, 50, 'Willow');

  -- 1. Refused on a thing of the wrong kind, in words that name the right one.
  v_s := give(w, u, 'gale_scroll', 1, 90);
  insert into said values ('R:bow', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_bow, 'scroll', v_s)), 'none'));
  insert into said values ('R:sword', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_sw, 'scroll', v_s)), 'none'));

  -- 2. Gale, Nightblade, Sunstrike: in the hand, and what each makes of a swing.
  update player set equipped = jsonb_build_object('weapon', v_sw) where world_id = w and uid = u;
  insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, health, sex)
    values (w, 9201, 'shaggan', 'Shaggan', 'wild', 41.2, 40.5, 41.2, 40.5, 90, 'female'),
           (w, 9202, 'goblin', 'Goblin', 'wild', 40.5, 41.2, 40.5, 41.2, 60, 'male');
  select * into v_c from creature where world_id = w and id = 9201;
  select * into v_g from creature where world_id = w and id = 9202;
  insert into said values ('PLAIN', act_base(w, u, 'attack_creature', 2.5)::text || '|' || my_crit_chance(w, u, swung_with(w, u))::text
    || '|' || class_dealt(w, u, v_c)::text || '|' || class_dealt(w, u, v_g)::text);
  update item set enchant = '{"id": "gale", "ql": 100}'::jsonb where id = v_sw;
  insert into said values ('GALE', act_base(w, u, 'attack_creature', 2.5)::text);
  update item set enchant = '{"id": "nightblade", "ql": 100}'::jsonb where id = v_sw;
  insert into said values ('NIGHT', my_crit_chance(w, u, swung_with(w, u))::text);
  update item set enchant = '{"id": "sunstrike", "ql": 100}'::jsonb where id = v_sw;
  insert into said values ('SUN', class_dealt(w, u, v_c)::text || '|' || class_dealt(w, u, v_g)::text);

  -- 3. Venomfang at QL ${HIT_QL}: a roll just over its chance, then just under.
  update item set enchant = jsonb_build_object('id', 'venomfang', 'ql', ${HIT_QL}) where id = v_sw;
  perform pg_temp.dice((enchant_hit_chance('venomfang', ${HIT_QL}) + 0.001)::text);
  perform enchant_hit(w, u, 9201, (select i from item i where i.id = v_sw), 10);
  insert into said select 'VOVER', coalesce((c.bleed_until > now())::text, 'null') from creature c where c.world_id = w and c.id = 9201;
  perform pg_temp.dice((enchant_hit_chance('venomfang', ${HIT_QL}) - 0.001)::text);
  perform enchant_hit(w, u, 9201, (select i from item i where i.id = v_sw), 10);
  perform pg_temp.nodice();
  insert into said select 'VUNDER', (c.bleed_until > now())::text || '|' || round(c.bleed_rate::numeric, 6)::text
    || '|' || round(extract(epoch from (c.bleed_until - now()))::numeric, 1)::text
    || '|' || (select e.text from event e where e.world_id = w and e.uid = u order by e.n desc limit 1)
    from creature c where c.world_id = w and c.id = 9201;

  -- 4. Leeching at QL ${HIT_QL}: a hit of 10 from half health, every time and with no roll.
  update item set enchant = jsonb_build_object('id', 'leeching', 'ql', ${HIT_QL}) where id = v_sw;
  update player set stats = stats || jsonb_build_object('health', 0.5) where world_id = w and uid = u;
  perform pg_temp.dice('0.999');
  perform enchant_hit(w, u, 9201, (select i from item i where i.id = v_sw), 10);
  perform enchant_hit(w, u, 9201, (select i from item i where i.id = v_sw), 10);
  insert into said select 'LEECH', (p.stats->>'health') || '|' || coalesce(current_setting('wurm.dice_n', true), '0')
    from player p where p.world_id = w and p.uid = u;
  perform pg_temp.nodice();

  -- 5. Tidecaller at QL ${HIT_QL}: how far one hit puts the shaggan's next blow back.
  update item set enchant = jsonb_build_object('id', 'tidecaller', 'ql', ${HIT_QL}) where id = v_sw;
  update creature set until = now() + interval '1 second' where world_id = w and id = 9201;
  select until into v_until from creature where world_id = w and id = 9201;
  perform enchant_hit(w, u, 9201, (select i from item i where i.id = v_sw), 10);
  insert into said select 'TIDE', round(extract(epoch from (c.until - v_until))::numeric, 6)::text
    from creature c where c.world_id = w and c.id = 9201;

  -- 6. A bow: Farsight refused on a sword and taken on the bow; its reach with it and without.
  v_s := give(w, u, 'farsight_scroll', 1, 90);
  insert into said values ('R:farsword', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_sw, 'scroll', v_s)), 'none'));
  insert into said values ('R:farbow', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_bow, 'scroll', v_s)), 'none'));
  update player set equipped = jsonb_build_object('weapon', v_bow) where world_id = w and uid = u;
  insert into said select 'REACH', bow_range(w, u, b, (select i from item i where i.id = v_bow))::text from weapon_def b where b.id = 'short_bow';
  update item set enchant = '{"id": "farsight", "ql": 100}'::jsonb where id = v_bow;
  insert into said select 'FAR', bow_range(w, u, b, (select i from item i where i.id = v_bow))::text from weapon_def b where b.id = 'short_bow';

  -- 7. Flamearrow and Frostbite at QL ${HIT_QL}: a roll just over its chance, then just under, on a fresh shaggan each.
  insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, health, sex)
    values (w, 9211, 'shaggan', 'Shaggan', 'wild', 30.5, 30.5, 30.5, 30.5, 90, 'female'),
           (w, 9212, 'shaggan', 'Shaggan', 'wild', 32.5, 30.5, 32.5, 30.5, 90, 'female');
  update item set enchant = jsonb_build_object('id', 'flamearrow', 'ql', ${HIT_QL}) where id = v_bow;
  perform pg_temp.dice((enchant_hit_chance('flamearrow', ${HIT_QL}) + 0.001)::text);
  perform enchant_shot(w, u, 9211, (select i from item i where i.id = v_bow));
  insert into said select 'FOVER', coalesce((select string_agg(m.kind, ',') from class_mark m where m.world_id = w and m.creature_id = 9211 and m.until > now()), '-');
  perform pg_temp.dice((enchant_hit_chance('flamearrow', ${HIT_QL}) - 0.001)::text);
  perform enchant_shot(w, u, 9211, (select i from item i where i.id = v_bow));
  insert into said select 'FUNDER', coalesce((select string_agg(m.kind, ',') from class_mark m where m.world_id = w and m.creature_id = 9211 and m.until > now()), '-')
    || '|' || (select e.text from event e where e.world_id = w and e.uid = u order by e.n desc limit 1);
  update item set enchant = jsonb_build_object('id', 'frostbite', 'ql', ${HIT_QL}) where id = v_bow;
  insert into said select 'SPEED0', beast_mul(c, 'speed')::text from creature c where c.world_id = w and c.id = 9212;
  perform pg_temp.dice((enchant_hit_chance('frostbite', ${HIT_QL}) + 0.001)::text);
  perform enchant_shot(w, u, 9212, (select i from item i where i.id = v_bow));
  insert into said select 'IOVER', coalesce((c.slow_until > now())::text, 'null') from creature c where c.world_id = w and c.id = 9212;
  perform pg_temp.dice((enchant_hit_chance('frostbite', ${HIT_QL}) - 0.001)::text);
  perform enchant_shot(w, u, 9212, (select i from item i where i.id = v_bow));
  perform pg_temp.nodice();
  insert into said select 'IUNDER', c.slow::text || '|' || round(extract(epoch from (c.slow_until - now()))::numeric, 1)::text
    || '|' || beast_mul(c, 'speed')::text
    || '|' || coalesce((select (t->>'slowed')::double precision::text || ',' || (t->>'slowPace') from jsonb_array_elements(rpc_creatures(w, 40)) t
                        where (t->>'id')::int = 9212), 'none')
    || '|' || (select e.text from event e where e.world_id = w and e.uid = u order by e.n desc limit 1)
    from creature c where c.world_id = w and c.id = 9212;

  -- 8. What is worn: refusals by kind.
  update player set equipped = '{}'::jsonb where world_id = w and uid = u;
  perform pg_temp.nodice();
  v_boot := give(w, u, 'leather_boots', 1, 100);
  v_chest := give(w, u, 'leather_jerkin', 1, 100);
  v_cap := give(w, u, 'leather_cap', 1, 100);
  v_arm := give(w, u, 'leather_sleeves', 1, 100);
  v_leg := give(w, u, 'leather_trousers', 1, 100);
  v_sh := give(w, u, 'wooden_shield', 1, 100, 'Pine');
  v_s := give(w, u, 'featherstep_scroll', 1, 90);
  insert into said values ('R:featherchest', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_chest, 'scroll', v_s)), 'none'));
  insert into said values ('R:featherboot', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_boot, 'scroll', v_s)), 'none'));
  v_s := give(w, u, 'shadowcloak_scroll', 1, 90);
  insert into said values ('R:shadowcap', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_cap, 'scroll', v_s)), 'none'));
  insert into said values ('R:shadowchest', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_chest, 'scroll', v_s)), 'none'));
  v_s := give(w, u, 'bulwark_scroll', 1, 90);
  insert into said values ('R:bulwarksword', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_sw, 'scroll', v_s)), 'none'));
  insert into said values ('R:bulwarkshield', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_sh, 'scroll', v_s)), 'none'));

  -- 9. Stoneskin on two pieces, then on four (past the cap); Emberward on one, then three; Featherstep; Bulwark; Shadowcloak.
  update player set equipped = jsonb_build_object('feet', v_boot, 'chest', v_chest, 'head', v_cap, 'arms', v_arm, 'legs', v_leg, 'offhand', v_sh)
   where world_id = w and uid = u;
  insert into said values ('WALK0', travel_speed(w, u)::text);
  update item set enchant = '{"id": "stoneskin", "ql": 100}'::jsonb where id in (v_chest, v_cap);
  insert into said values ('SKIN2', enchant_guard(w, u, 'bite')::text || '|' || enchant_guard(w, u, 'burn')::text);
  update item set enchant = '{"id": "stoneskin", "ql": 100}'::jsonb where id in (v_arm, v_leg);
  insert into said values ('SKIN4', enchant_guard(w, u, 'bite')::text);
  update item set enchant = null where id in (v_chest, v_cap, v_arm, v_leg);
  update item set enchant = '{"id": "emberward", "ql": 100}'::jsonb where id = v_chest;
  insert into said values ('EMBER1', enchant_guard(w, u, 'bite')::text || '|' || enchant_guard(w, u, 'burn')::text);
  update item set enchant = '{"id": "emberward", "ql": 100}'::jsonb where id in (v_cap, v_arm);
  insert into said values ('EMBER3', enchant_guard(w, u, 'burn')::text);
  update item set enchant = '{"id": "featherstep", "ql": 100}'::jsonb where id = v_boot;
  insert into said values ('WALK', travel_speed(w, u)::text);
  update item set enchant = '{"id": "bulwark", "ql": 100}'::jsonb where id = v_sh;
  insert into said values ('BLOCK', worn_enchant(w, u, 'block')::text);
  update item set enchant = '{"id": "shadowcloak", "ql": 100}'::jsonb where id = v_chest;
  insert into said values ('SHADOW', enchant_shadow(w, u)::text || '|' || is_night(w)::text);

  -- 10. Thornhide on two pieces: a shaggan's blow, and what is owed back to it.
  update item set enchant = null where id in (v_chest, v_cap, v_arm, v_leg, v_boot, v_sh);
  update player set equipped = jsonb_build_object('chest', v_chest, 'head', v_cap) where world_id = w and uid = u;
  update item set enchant = '{"id": "thornhide", "ql": 100}'::jsonb where id in (v_chest, v_cap);
  insert into creature (world_id, id, species, name, mode, from_x, from_y, to_x, to_y, health, sex)
    values (w, 9221, 'shaggan', 'Shaggan', 'wild', 41.2, 40.5, 41.2, 40.5, 90, 'male');
  update player set stats = stats || jsonb_build_object('health', 1, 'hurtBy', 9221), wounds = '[]'::jsonb, blessings = '{}'::jsonb
   where world_id = w and uid = u;
  delete from faith_owed where world_id = w;
  perform pg_temp.dice('0.99');
  perform hurt_player(w, u, 0.1, 'The shaggan bites', 'bite');
  perform pg_temp.nodice();
  insert into said select 'THORN', (1 - (p.stats->>'health')::double precision)::text
    || '|' || coalesce((select sum(o.dmg)::text from faith_owed o where o.world_id = w and o.creature_id = 9221), 'none')
    || '|' || worn_enchant(w, u, 'thorns')::text
    from player p where p.world_id = w and p.uid = u;

  -- 11. The tools: refusals by kind, Swiftwork on a job's time, Truesteel on wear, Bountiful and Lodestone's one more.
  perform pg_temp.nodice();
  update player set equipped = '{}'::jsonb where world_id = w and uid = u;
  v_saw := give(w, u, 'saw', 1, 50);
  v_sick := give(w, u, 'sickle', 1, 50);
  v_pick := give(w, u, 'pickaxe', 1, 50);
  v_s := give(w, u, 'swiftwork_scroll', 1, 90);
  insert into said values ('R:swiftsword', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_sw, 'scroll', v_s)), 'none'));
  insert into said values ('R:swiftsaw', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_saw, 'scroll', v_s)), 'none'));
  v_s := give(w, u, 'bountiful_scroll', 1, 90);
  insert into said values ('R:bountypick', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_pick, 'scroll', v_s)), 'none'));
  insert into said values ('R:bountysickle', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_sick, 'scroll', v_s)), 'none'));
  v_s := give(w, u, 'lodestone_scroll', 1, 90);
  insert into said values ('R:lodesickle', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_sick, 'scroll', v_s)), 'none'));
  insert into said values ('R:lodepick', coalesce(enchant_refusal(w, u, jsonb_build_object('kind', 'item', 'uid', v_pick, 'scroll', v_s)), 'none'));
  insert into said values ('STEADY0', faith_steady(w, u, 'saw')::text);
  update item set enchant = '{"id": "swiftwork", "ql": 100}'::jsonb where id = v_saw;
  insert into said values ('STEADY', faith_steady(w, u, 'saw')::text || '|' || faith_steady(w, u, 'sickle')::text);
  update item set enchant = null, dmg = 0 where id = v_saw;
  perform wear_tool(v_saw);
  insert into said select 'WEAR0', dmg::text from item where id = v_saw;
  update item set enchant = '{"id": "truesteel", "ql": 100}'::jsonb, dmg = 0 where id = v_saw;
  perform wear_tool(v_saw);
  insert into said select 'WEAR', dmg::text from item where id = v_saw;
  update item set enchant = '{"id": "bountiful", "ql": ${HIT_QL}}'::jsonb where id = v_sick;
  update item set enchant = '{"id": "lodestone", "ql": ${HIT_QL}}'::jsonb where id = v_pick;
  delete from item where world_id = w and holder = 'player' and holder_uid = u and def in ('raspberry', 'iron_ore');
  delete from event where world_id = w;
  perform pg_temp.dice('${(0.002 * 50 + 0.001).toFixed(3)}');
  perform enchant_more(w, u, 'sickle', 'bounty', 'raspberry', 33);
  perform pg_temp.dice('${(0.001 * 50 + 0.001).toFixed(3)}');
  perform enchant_more(w, u, 'pickaxe', 'lode', 'iron_ore', 33);
  insert into said select 'MOREOVER', coalesce(sum(count), 0)::text from item where world_id = w and holder = 'player' and holder_uid = u and def in ('raspberry', 'iron_ore');
  perform pg_temp.dice('${(0.002 * 50 - 0.001).toFixed(3)}');
  perform enchant_more(w, u, 'sickle', 'bounty', 'raspberry', 33);
  perform pg_temp.dice('${(0.001 * 50 - 0.001).toFixed(3)}');
  perform enchant_more(w, u, 'pickaxe', 'lode', 'iron_ore', 33);
  perform pg_temp.nodice();
  insert into said select 'MOREUNDER', string_agg(def || '*' || count || '@' || round(ql::numeric, 1), ',' order by def)
    from item where world_id = w and holder = 'player' and holder_uid = u and def in ('raspberry', 'iron_ore');
  insert into said select 'MORESAID', string_agg(e.text, '#' order by e.n) from event e where e.world_id = w and e.kind = 'event';
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const part = (k: string, i = 0): string => (isle.get(k) ?? '').split('|')[i] ?? '';

/* ---- in the browser, the same ----------------------------------------------------- */

const g = Game.create(218, 256);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
g.inventory.items.length = 0;
g.putBody(40.5, 40.5, 0);
g.settings.fromStores = false;
g.player.stats.stamina = 1;
g.player.stats.health = 1;
g.player.wounds = [];
const said: string[] = [];
const logOf = g.logMsg.bind(g);
g.logMsg = (m: string, k?: Parameters<typeof logOf>[1]) => { said.push(m); logOf(m, k); };
const dice = (...xs: number[]): void => {
  let n = 0;
  g.rand = () => xs[n++ % xs.length];
};
let rolls = 0;
const act = (id: string): ActionDef => ACTION_BY_ID.get(id) as ActionDef;
const thing = (id: string, ql: number, extra?: string): Item => g.gather(id, { count: 1, ql, ...(extra ? { extra } : {}) });
g.skills.values.set('swords', 30);
g.skills.values.set('enchanting', 100);
const sword = thing('sword', 100, 'Iron');
const bow = thing('short_bow', 50, 'Willow');

/* 1. Refusals. */
const galeScroll = thing(GALE.scroll, 90);
const ask = (uid: number): string => act('enchant').check?.({ kind: 'item', uid, scroll: galeScroll.uid } as Target, g) ?? 'none';
check(`a Gale scroll is refused on a bow in words that name what it goes on, on both sides: ${wrongKind(GALE)}`,
  isle.get('R:bow') === wrongKind(GALE) && ask(bow.uid) === wrongKind(GALE) && wrongKind(GALE) === 'Gale goes on a melee weapon, not a bow or a thrown weapon.',
  `${isle.get('R:bow')} / ${ask(bow.uid)}`);
check('and taken on a sword, on both sides', isle.get('R:sword') === 'none' && ask(sword.uid) === 'none', `${isle.get('R:sword')} / ${ask(sword.uid)}`);

/* 2. Gale, Nightblade, Sunstrike. */
g.player.equipped.weapon = sword.uid;
const shaggan = g.creatures.spawn('shaggan', 41.2, 40.5, 'wild', () => 0.5, 0);
shaggan.health = 90;
const goblin = g.creatures.spawn('goblin', 40.5, 41.2, 'wild', () => 0.5, 0);
goblin.health = 60;
const swingDef = { id: 'attack_creature', baseTime: 2.5 };
const swordDef = WEAPON_BY_ID.get('sword')!;
const plainHere = [fightBase(g, swingDef) ?? 0, myCritChance(g, swordDef), classDealt(g, shaggan), classDealt(g, goblin)];
const plainIsle = (isle.get('PLAIN') ?? '').split('|').map(Number);
check('without an enchantment a swing\'s time, the critical chance and the damage on a shaggan and a goblin are the same on both sides',
  plainHere.every((x, i) => near(x, plainIsle[i])), `${plainIsle.join(' ')} / ${plainHere.join(' ')}`);
sword.enchant = { id: GALE.id, ql: 100 };
const galeHere = fightBase(g, swingDef) ?? 0;
check(`a Gale at QL 100 takes ${enchantValue(GALE, 100) * 100}% off a swing on both sides: ${plainHere[0]} s to ${galeHere} s`,
  near(galeHere, plainHere[0] * (1 - enchantValue(GALE, 100))) && near(Number(isle.get('GALE')), galeHere), `island ${isle.get('GALE')}`);
sword.enchant = { id: NIGHT.id, ql: 100 };
const nightHere = myCritChance(g, swordDef);
check(`a Nightblade at QL 100 adds ${enchantValue(NIGHT, 100) * 100} points to the critical chance on both sides: ${plainHere[1]} to ${nightHere}`,
  near(nightHere, plainHere[1] + enchantValue(NIGHT, 100)) && near(Number(isle.get('NIGHT')), nightHere), `island ${isle.get('NIGHT')}`);
sword.enchant = { id: SUN.id, ql: 100 };
const sunHere = [classDealt(g, shaggan), classDealt(g, goblin)];
check(`a Sunstrike at QL 100 does ${enchantValue(SUN, 100) * 100}% more to a goblin, a hostile monster, and nothing more to a shaggan, on both sides`,
  SPECIES.goblin.monster === true && !SPECIES.shaggan.monster && near(sunHere[0], plainHere[2]) && near(sunHere[1], plainHere[3] * (1 + enchantValue(SUN, 100)))
    && near(Number(part('SUN', 0)), sunHere[0]) && near(Number(part('SUN', 1)), sunHere[1]),
  `${isle.get('SUN')} / ${sunHere.join('|')}`);

/* 3. Venomfang. */
sword.enchant = { id: VENOM.id, ql: HIT_QL };
const vc = g.creatures.spawn('shaggan', 30.5, 30.5, 'wild', () => 0.5, 0);
vc.health = 90;
const vchance = enchantHitChance(VENOM, HIT_QL);
dice(vchance + 0.001);
const vover = enchantRoll(g, sword, vc);
dice(vchance - 0.001);
const vunder = enchantRoll(g, sword, vc);
if (vunder) enchantWorks(g, vunder, HIT_QL, vc, 10, { burn: () => {}, bleed: () => {} });
const venomRate = maxHealth(vc, SPECIES.shaggan) * VENOM_DRAIN;
check(`a Venomfang at QL ${HIT_QL} (${vchance * 100}%): a roll just over does nothing and just under puts venom in it, ${VENOM_DRAIN * 100}% of its full health a second, on both sides`,
  part('VOVER') !== 'true' && vover === null && vunder?.id === VENOM.id && part('VUNDER', 0) === 'true'
    && near(Number(part('VUNDER', 1)), venomRate, 1e-5) && near(vc.bleedRate, venomRate) && vc.bleedUntil > g.time
    && part('VUNDER', 3) === said[said.length - 1] && said[said.length - 1] === 'Your Venomfang puts venom in the shaggan.',
  `${isle.get('VOVER')} ${isle.get('VUNDER')} / ${vc.bleedRate} ${said[said.length - 1]}`);

/* 4. Leeching. */
sword.enchant = { id: LEECH.id, ql: HIT_QL };
g.player.stats.health = 0.5;
dice(0.999);
rolls = 0;
const counted = g.rand;
g.rand = () => { rolls++; return counted(); };
for (let i = 0; i < 2; i++) {
  const e = enchantRoll(g, sword, shaggan);
  if (e) enchantWorks(g, e, HIT_QL, shaggan, 10, { burn: () => {}, bleed: () => {} });
}
const leeched = 0.5 + 2 * leechHeal(LEECH, HIT_QL, 10);
check(`a Leeching at QL ${HIT_QL} gives back ${enchantValue(LEECH, HIT_QL) * 100}% of each hit of 10 as health, at ${BLOW_SHARE * 100}% of your health a point, every hit and with no roll, on both sides`,
  near(g.player.stats.health, leeched) && near(Number(part('LEECH', 0)), leeched) && part('LEECH', 1) === '0' && rolls === 0
    && near(leechHeal(LEECH, HIT_QL, 10), 10 * 0.05 * BLOW_SHARE),
  `${isle.get('LEECH')} / ${g.player.stats.health} ${rolls} rolls`);

/* 5. Tidecaller. */
sword.enchant = { id: TIDE.id, ql: HIT_QL };
shaggan.cooldown = 1;
const e5 = enchantRoll(g, sword, shaggan);
if (e5) enchantWorks(g, e5, HIT_QL, shaggan, 10, { burn: () => {}, bleed: () => {} });
const tideSecs = blowEvery(SPECIES.shaggan) * enchantValue(TIDE, HIT_QL);
check(`a Tidecaller at QL ${HIT_QL} puts a shaggan's next blow back ${enchantValue(TIDE, HIT_QL) * 100}% of the ${blowEvery(SPECIES.shaggan)} s between its blows (${tideSecs} s), on both sides`,
  near(shaggan.cooldown, 1 + tideSecs) && near(drainSecs(TIDE, HIT_QL, shaggan), tideSecs) && near(Number(isle.get('TIDE')), tideSecs, 1e-3),
  `${isle.get('TIDE')} / ${shaggan.cooldown - 1}`);

/* 6. A bow: Farsight. */
const farScroll = thing(FAR.scroll, 90);
const askFar = (uid: number): string => act('enchant').check?.({ kind: 'item', uid, scroll: farScroll.uid } as Target, g) ?? 'none';
check(`a Farsight scroll is refused on a sword, in words that name a bow, and taken on a bow, on both sides: ${wrongKind(FAR)}`,
  isle.get('R:farsword') === wrongKind(FAR) && askFar(sword.uid) === wrongKind(FAR) && wrongKind(FAR) === 'Farsight goes on a bow.'
    && isle.get('R:farbow') === 'none' && askFar(bow.uid) === 'none', `${isle.get('R:farsword')} / ${askFar(sword.uid)}`);
g.player.equipped.weapon = bow.uid;
const bowDef = WEAPON_BY_ID.get('short_bow')!;
const reachPlain = bowReach(g, bowDef, bow);
bow.enchant = { id: FAR.id, ql: 100 };
const reachFar = bowReach(g, bowDef, bow);
check(`a Farsight at QL 100 lets a short bow reach ${enchantValue(FAR, 100) * 100}% further on both sides: ${reachPlain} to ${reachFar} tiles`,
  near(reachFar, reachPlain * (1 + enchantValue(FAR, 100))) && near(Number(isle.get('REACH')), reachPlain) && near(Number(isle.get('FAR')), reachFar),
  `${isle.get('REACH')} ${isle.get('FAR')}`);

/* 7. Flamearrow and Frostbite. */
const shotAt = (e: EnchantmentDef, c: Creature): { over: EnchantmentDef | null; under: EnchantmentDef | null } => {
  bow.enchant = { id: e.id, ql: HIT_QL };
  dice(enchantHitChance(e, HIT_QL) + 0.001);
  const over = shotRoll(g, bow, c);
  dice(enchantHitChance(e, HIT_QL) - 0.001);
  const under = shotRoll(g, bow, c);
  if (under) enchantWorks(g, under, HIT_QL, c, 10, { burn: () => g.burn(c, ENCHANT_BURN.each, ENCHANT_BURN.secs), bleed: () => {} });
  return { over, under };
};
const fc = g.creatures.spawn('shaggan', 30.5, 30.5, 'wild', () => 0.5, 0);
fc.health = 90;
const fl = shotAt(FLAME, fc);
check(`a Flamearrow at QL ${HIT_QL} (${enchantHitChance(FLAME, HIT_QL) * 100}%): a shot's roll just over does nothing and just under sets it burning, on both sides`,
  isle.get('FOVER') === '-' && fl.over === null && fl.under?.id === FLAME.id && part('FUNDER', 0) === 'burn' && (fc.burnUntil ?? 0) > g.time
    && part('FUNDER', 1) === said[said.length - 1] && said[said.length - 1] === 'Your Flamearrow sets the shaggan burning.',
  `${isle.get('FOVER')} ${isle.get('FUNDER')} / ${said[said.length - 1]}`);
const ic = g.creatures.spawn('shaggan', 32.5, 30.5, 'wild', () => 0.5, 0);
ic.health = 90;
const fr = shotAt(FROST, ic);
check(`a Frostbite at QL ${HIT_QL} (${enchantHitChance(FROST, HIT_QL) * 100}%): just over does nothing; just under holds it to ${FROST_PACE * 100}% of its pace for ${FROST_SECS} seconds, on both sides, and the island's creatures door says so`,
  part('IOVER') !== 'true' && fr.over === null && fr.under?.id === FROST.id
    && near(Number(part('IUNDER', 0)), FROST_PACE) && near(Number(part('IUNDER', 1)), FROST_SECS, 0.2)
    && near(Number(part('IUNDER', 2)), Number(isle.get('SPEED0')) * FROST_PACE)
    && near(Number((part('IUNDER', 3)).split(',')[0]), FROST_SECS, 0.2) && near(Number((part('IUNDER', 3)).split(',')[1]), FROST_PACE)
    && ic.slowPace === FROST_PACE && near((ic.slowUntil ?? 0) - g.time, FROST_SECS) && slowed(g, ic)
    && part('IUNDER', 4) === said[said.length - 1] && said[said.length - 1] === `Your Frostbite slows the shaggan to ${FROST_PACE * 100}% of its pace for ${FROST_SECS} seconds.`,
  `${isle.get('IOVER')} ${isle.get('IUNDER')} / ${ic.slowPace} ${(ic.slowUntil ?? 0) - g.time} ${said[said.length - 1]}`);

/* 8. What is worn: refusals by kind. */
const [FEATHER, SHADOW, BULWARK, STONE, EMBERW, THORN] = ['featherstep', 'shadowcloak', 'bulwark', 'stoneskin', 'emberward', 'thornhide'].map(E);
g.player.equipped.weapon = null;
const boot = thing('leather_boots', 100);
const jerkin = thing('leather_jerkin', 100);
const cap = thing('leather_cap', 100);
const sleeves = thing('leather_sleeves', 100);
const trousers = thing('leather_trousers', 100);
const shield = thing('wooden_shield', 100, 'Pine');
const askWith = (e: EnchantmentDef, uid: number): string => {
  const sc = thing(e.scroll, 90);
  return act('enchant').check?.({ kind: 'item', uid, scroll: sc.uid } as Target, g) ?? 'none';
};
const refusals: Array<[string, string, string]> = [
  ['R:featherchest', askWith(FEATHER, jerkin.uid), wrongKind(FEATHER)], ['R:featherboot', askWith(FEATHER, boot.uid), 'none'],
  ['R:shadowcap', askWith(SHADOW, cap.uid), wrongKind(SHADOW)], ['R:shadowchest', askWith(SHADOW, jerkin.uid), 'none'],
  ['R:bulwarksword', askWith(BULWARK, sword.uid), wrongKind(BULWARK)], ['R:bulwarkshield', askWith(BULWARK, shield.uid), 'none'],
];
check('Featherstep goes on boots, Shadowcloak on what is worn on the chest, Bulwark on a shield, and each is refused elsewhere in words that say so, on both sides',
  refusals.every(([k, here, want]) => isle.get(k) === want && here === want) && wrongKind(FEATHER) === 'Featherstep goes on boots or shoes.',
  refusals.map(([k, here, want]) => `${k}: ${isle.get(k)} / ${here} / ${want}`).join('; '));

/* 9. Stoneskin, Emberward, Featherstep, Bulwark, Shadowcloak. */
Object.assign(g.player.equipped, { feet: boot.uid, chest: jerkin.uid, head: cap.uid, arms: sleeves.uid, legs: trousers.uid, offhand: shield.uid });
const set = (e: EnchantmentDef | null, ...its: Item[]): void => { for (const it of its) it.enchant = e ? { id: e.id, ql: 100 } : undefined; };
set(STONE, jerkin, cap);
const skin2 = [g.enchantTaken('bite'), g.enchantTaken('burn')];
set(STONE, sleeves, trousers);
const skin4 = g.enchantTaken('bite');
check(`Stoneskin at QL 100 takes ${enchantValue(STONE, 100) * 100}% off every blow a piece: two pieces ${Math.round((1 - skin2[0]) * 100)}%, four held to ${STONESKIN_CAP * 100}%, on both sides`,
  near(skin2[0], 1 - 2 * enchantValue(STONE, 100)) && near(skin2[1], skin2[0]) && near(skin4, 1 - STONESKIN_CAP)
    && near(Number(part('SKIN2', 0)), skin2[0]) && near(Number(part('SKIN2', 1)), skin2[1]) && near(Number(isle.get('SKIN4')), skin4),
  `${isle.get('SKIN2')} ${isle.get('SKIN4')} / ${skin2.join('|')} ${skin4}`);
set(null, jerkin, cap, sleeves, trousers);
set(EMBERW, jerkin);
const ember1 = [g.enchantTaken('bite'), g.enchantTaken('burn')];
set(EMBERW, cap, sleeves);
const ember3 = g.enchantTaken('burn');
check(`Emberward at QL 100 takes ${enchantValue(EMBERW, 100) * 100}% off a burn a piece and nothing off a bite; three held to ${EMBERWARD_CAP * 100}%, on both sides`,
  near(ember1[0], 1) && near(ember1[1], 1 - enchantValue(EMBERW, 100)) && near(ember3, 1 - EMBERWARD_CAP)
    && near(Number(part('EMBER1', 0)), ember1[0]) && near(Number(part('EMBER1', 1)), ember1[1]) && near(Number(isle.get('EMBER3')), ember3),
  `${isle.get('EMBER1')} ${isle.get('EMBER3')} / ${ember1.join('|')} ${ember3}`);
set(FEATHER, boot);
check(`Featherstep at QL 100: you walk ${enchantValue(FEATHER, 100) * 100}% faster, on both sides`,
  near(g.wornEnchant('stride'), enchantValue(FEATHER, 100)) && near(Number(isle.get('WALK')), Number(isle.get('WALK0')) * (1 + enchantValue(FEATHER, 100))),
  `${isle.get('WALK0')} to ${isle.get('WALK')}`);
set(BULWARK, shield);
check(`Bulwark at QL 100 adds ${enchantValue(BULWARK, 100) * 100} points to a shield's chance of a block, on both sides`,
  near(g.wornEnchant('block'), enchantValue(BULWARK, 100)) && near(Number(isle.get('BLOCK')), g.wornEnchant('block')), `${isle.get('BLOCK')}`);
set(SHADOW, jerkin);
const [shadowIsle, nightIsle] = (isle.get('SHADOW') ?? '').split('|');
check(`Shadowcloak at QL 100: at night a hunter notices you from ${enchantValue(SHADOW, 100) * 100}% closer, and by day as ever, on both sides`,
  near(Number(shadowIsle), nightIsle === 'true' ? 1 - enchantValue(SHADOW, 100) : 1)
    && near(g.shadowNotice(), g.isNight() ? 1 - enchantValue(SHADOW, 100) : 1) && near(g.wornEnchant('shadow'), enchantValue(SHADOW, 100)),
  `${isle.get('SHADOW')} / ${g.shadowNotice()} ${g.isNight()}`);

/* 10. Thornhide. */
set(null, jerkin, cap, sleeves, trousers, boot, shield);
for (const k of Object.keys(g.player.equipped)) g.player.equipped[k] = null;
Object.assign(g.player.equipped, { chest: jerkin.uid, head: cap.uid });
set(THORN, jerkin, cap);
const tc = g.creatures.spawn('shaggan', 41.2, 40.5, 'wild', () => 0.5, 0);
tc.health = 90;
g.player.stats.health = 1;
g.player.wounds = [];
g.player.attackedBy = tc.id;
dice(0.99);
// What is sent back, before the creature's own hide and blood have their say (the island's `faith_owed` row is the same figure).
let sent = 0;
const hurtOf = g.creatures.hurt.bind(g.creatures);
g.creatures.hurt = (gg, c, dmg, ...rest) => { if (c === tc) sent += dmg; return hurtOf(gg, c, dmg, ...rest); };
g.hurtPlayer(0.1, 'The shaggan bites', 'bite');
g.creatures.hurt = hurtOf;
const lostHere = 1 - g.player.stats.health;
const share = g.wornEnchant('thorns');
const [lostIsle, owedIsle, shareIsle] = (isle.get('THORN') ?? '').split('|').map(Number);
check(`Thornhide at QL 100 on two pieces sends ${share * 100}% of what a blow did you back on whatever struck, at what a blow of yours that size is to it, on both sides`,
  near(share, 2 * enchantValue(THORN, 100)) && near(shareIsle, share) && lostHere > 0 && near(sent, (lostHere * share) / BLOW_SHARE, 1e-6) && tc.health < 90
    && near(owedIsle, (lostIsle * share) / BLOW_SHARE, 1e-6),
  `${isle.get('THORN')} / lost ${lostHere}, sent ${sent}`);

/* 11. The tools. */
const [SWIFT, TRUE, BOUNTY, LODE] = ['swiftwork', 'truesteel', 'bountiful', 'lodestone'].map(E);
set(null, jerkin, cap);
for (const k of Object.keys(g.player.equipped)) g.player.equipped[k] = null;
const saw = thing('saw', 50);
const sickle = thing('sickle', 50);
const pick = thing('pickaxe', 50);
const toolRefusals: Array<[string, string, string]> = [
  ['R:swiftsword', askWith(SWIFT, sword.uid), wrongKind(SWIFT)], ['R:swiftsaw', askWith(SWIFT, saw.uid), 'none'],
  ['R:bountypick', askWith(BOUNTY, pick.uid), wrongKind(BOUNTY)], ['R:bountysickle', askWith(BOUNTY, sickle.uid), 'none'],
  ['R:lodesickle', askWith(LODE, sickle.uid), wrongKind(LODE)], ['R:lodepick', askWith(LODE, pick.uid), 'none'],
];
check('Swiftwork goes on a tool a job is done with and not on a sword, Bountiful on a sickle or a rod, Lodestone on a pickaxe, and each is refused elsewhere in words that say so, on both sides',
  toolRefusals.every(([k, here, want]) => isle.get(k) === want && here === want) && wrongKind(LODE) === 'Lodestone goes on a pickaxe.',
  toolRefusals.map(([k, here, want]) => `${k}: ${isle.get(k)} / ${here} / ${want}`).join('; '));
const planks = act('make_planks');
const t0 = g.duration(planks);
saw.enchant = { id: SWIFT.id, ql: 100 };
const t1 = g.duration(planks);
check(`Swiftwork at QL 100: a job done with the saw takes ${enchantValue(SWIFT, 100) * 100}% less time, and a job with another tool none less, on both sides`,
  near(t1, t0 * (1 - enchantValue(SWIFT, 100))) && near(Number(isle.get('STEADY0')), 1)
    && near(Number(part('STEADY', 0)), 1 - enchantValue(SWIFT, 100)) && near(Number(part('STEADY', 1)), 1),
  `${t0} to ${t1} / ${isle.get('STEADY0')} ${isle.get('STEADY')}`);
saw.enchant = undefined;
saw.dmg = 0;
g.wearTool('saw');
const wear0 = saw.dmg;
saw.enchant = { id: TRUE.id, ql: 100 };
saw.dmg = 0;
g.wearTool('saw');
check(`Truesteel at QL 100: the saw takes ${enchantValue(TRUE, 100) * 100}% less damage from a use, the same on both sides`,
  wear0 > 0 && near(saw.dmg, wear0 * (1 - enchantValue(TRUE, 100))) && near(Number(isle.get('WEAR0')), wear0) && near(Number(isle.get('WEAR')), saw.dmg),
  `${isle.get('WEAR0')} ${isle.get('WEAR')} / ${wear0} ${saw.dmg}`);
sickle.enchant = { id: BOUNTY.id, ql: HIT_QL };
pick.enchant = { id: LODE.id, ql: HIT_QL };
const more = (): string => g.inventory.items.filter((it) => it.id === 'raspberry' || it.id === 'iron_ore')
  .sort((a, b) => a.id.localeCompare(b.id)).map((it) => `${it.id}*${it.count}@${it.ql.toFixed(1)}`).join(',');
dice(enchantValue(BOUNTY, HIT_QL) + 0.001);
enchantMore(g, 'sickle', 'bounty', 'raspberry', 33);
dice(enchantValue(LODE, HIT_QL) + 0.001);
enchantMore(g, 'pickaxe', 'lode', 'iron_ore', 33);
const over = more();
const before = said.length;
dice(enchantValue(BOUNTY, HIT_QL) - 0.001);
enchantMore(g, 'sickle', 'bounty', 'raspberry', 33);
dice(enchantValue(LODE, HIT_QL) - 0.001);
enchantMore(g, 'pickaxe', 'lode', 'iron_ore', 33);
const lines = said.slice(before).join('#');
check(`Bountiful at QL ${HIT_QL} (${enchantValue(BOUNTY, HIT_QL) * 100}%) and Lodestone at QL ${HIT_QL} (${enchantValue(LODE, HIT_QL) * 100}%): a roll just over brings nothing more, just under one more at the go's quality, said the same on both sides`,
  over === '' && isle.get('MOREOVER') === '0' && more() === 'iron_ore*1@33.0,raspberry*1@33.0' && isle.get('MOREUNDER') === more()
    && lines === 'Bountiful brings one more of the raspberries.#Lodestone brings one more of the iron ore.' && isle.get('MORESAID') === lines,
  `${isle.get('MOREOVER')} ${isle.get('MOREUNDER')} ${isle.get('MORESAID')} / ${over} ${more()} ${lines}`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nenchanting, part 2 — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
