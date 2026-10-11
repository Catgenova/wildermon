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
import type { Item } from '../../src/game/items';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { ENCHANTMENT_LIST, ENCHANTMENTS, enchantValue, wrongKind, type EnchantmentDef } from '../../src/game/enchant';
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
/** Everything part 3 has added so far, for the scrolls and the words. */
const PART3 = [...JEWEL, MULE, SEAL, HAWK];

/* ---- the scrolls and the words, on both sides ------------------------------ */

const billIsle = psql(`select string_agg(r.id || '=' || (select string_agg(ri.item || '*' || ri.count, '+' order by ri.item) from recipe_input ri where ri.recipe = r.id),
  '|' order by r.id) from recipe r where r.id in (${PART3.map((e) => `'make_${e.scroll}'`).join(', ')})`);
const billHere = PART3.map((e) => `make_${e.scroll}=${[...(RECIPE_BY_ID.get(`make_${e.scroll}`)?.inputs ?? [])]
  .sort((a, b) => a.item.localeCompare(b.item)).map((i) => `${i.item}*${i.count ?? 1}`).join('+')}`).sort().join('|');
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
        v_pack bigint; v_chest bigint; v_cap bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Enchanting 3', 318, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player' and holder_uid = u;
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

check('every one of them is in the table once', ENCHANTMENT_LIST.filter((e) => PART3.includes(e)).length === PART3.length);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nenchanting, part 3 — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);

function times(x: number): string {
  return `${Number(x.toFixed(2))} times`;
}
