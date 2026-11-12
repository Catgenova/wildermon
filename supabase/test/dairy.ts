/**
 * Milk, butter and cheese (`dairy.ts`), on both sides.
 *
 * The butter churn, its recipe and churning, butter, the pastry baked with it,
 * cheese and the part bucket of milk, the same rows on both sides, and each
 * keeping longer than milk by its own `decay`; every kind that is milked filling
 * a bucket a milking (the Gorral, the one that gave less, is gone); and churning, pressing and baking giving
 * the counts the browser says, the bucket back, on the island and in the
 * browser alike; pressing cheese hands the bucket back full of whey, which
 * `whey.ts` follows further.
 *
 * Every roll is set. Runs against the database the suite leaves behind; the
 * island half is rolled back.
 *
 *   npx esbuild supabase/test/dairy.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/dairy.mjs && node node_modules/.cache/dairy.mjs
 */
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import type { Creature } from '../../src/game/creatures';
import { SPECIES } from '../../src/game/creatures';
import {
  BUTTER_CHURN, BUTTER_PATS, CHURN_BUTTER, MILK_PART, MILK_READY, milkedSays, milkLitres, WHEY_BUCKET,
} from '../../src/game/dairy';
import { BUCKET_LITRES, FURNITURE_BY_ID } from '../../src/game/furniture';
import { ITEM_DEFS, type Item } from '../../src/game/items';
import { RECIPE_BY_ID, recipeReason, STATION_NAME } from '../../src/game/recipes';
import { TileType } from '../../src/world/tiles';
import { psql, ok, bad, check } from './harness';

/* ---- the rows, the same on both sides ------------------------------------------------- */

const recipeRow = (id: string): string => {
  const r = RECIPE_BY_ID.get(id);
  if (!r) return 'none';
  return [r.result, r.count ?? 1, r.station ?? '-', r.tool ?? '-', r.skill, r.difficulty ?? 0,
    r.inputs.map((i) => `${i.item}:${i.count ?? 1}`).sort().join(','),
    (r.returns ?? []).map(([i, n]) => `${i}:${n}`).sort().join(',') || '-'].join('|');
};
const RECIPES_ASKED = [CHURN_BUTTER, 'bake_pastry', 'make_cheese', `make_${BUTTER_CHURN}`];
const recipesIsle = psql(`select string_agg(r.id || '=' || concat_ws('|', r.result, r.count, coalesce(r.station, '-'), coalesce(r.tool, '-'), r.skill,
    coalesce(r.difficulty, 0),
    (select string_agg(i.item || ':' || i.count, ',' order by i.item || ':' || i.count) from recipe_input i where i.recipe = r.id),
    coalesce((select string_agg(x.item || ':' || x.count, ',' order by x.item || ':' || x.count) from recipe_gives x where x.recipe = r.id and x.kind = 'return'), '-')),
  '#' order by r.id) from recipe r where r.id in (${RECIPES_ASKED.map((id) => `'${id}'`).join(', ')})`);
const recipesHere = [...RECIPES_ASKED].sort().map((id) => `${id}=${recipeRow(id)}`).join('#');
check(`churning, pressing, baking and the churn are the same recipes on both sides: ${recipeRow(CHURN_BUTTER)}`,
  recipesIsle === recipesHere && RECIPE_BY_ID.get(CHURN_BUTTER)?.count === BUTTER_PATS && RECIPE_BY_ID.get(CHURN_BUTTER)?.station === BUTTER_CHURN,
  `${recipesIsle} / ${recipesHere}`);
const stationIsle = psql(`select station_name('${BUTTER_CHURN}')`);
check(`the station is named the same: ${STATION_NAME[BUTTER_CHURN]}`, stationIsle === STATION_NAME[BUTTER_CHURN], stationIsle);
const piece = FURNITURE_BY_ID.get(BUTTER_CHURN);
const pieceIsle = psql(`select f.w || 'x' || f.h from furniture_def f where f.id = '${BUTTER_CHURN}'`);
check('the churn is a piece set down on both sides', !!piece && pieceIsle === `${piece.w}x${piece.h}`, pieceIsle);

const ITEMS_ASKED = ['milk_bucket', MILK_PART, 'cheese', 'butter', 'pastry', BUTTER_CHURN];
const itemsIsle = psql(`select string_agg(d.id || '=' || concat_ws('|', d.name, d.category, d.weight, coalesce(d.food, 0), coalesce(d.decay, -1), d.description),
  '#' order by d.id) from item_def d where d.id in (${ITEMS_ASKED.map((id) => `'${id}'`).join(', ')})`);
const itemsHere = [...ITEMS_ASKED].sort().map((id) => {
  const d = ITEM_DEFS[id];
  return `${id}=${[d.name, d.category, d.weight, d.food ?? 0, d.decay ?? -1, d.description].join('|')}`;
}).join('#');
check('milk, the part bucket, cheese, butter, pastry and the churn are the same items on both sides', itemsIsle === itemsHere, `${itemsIsle}\n   / ${itemsHere}`);
const milkDecay = ITEM_DEFS.milk_bucket.decay ?? 0;
check(`cheese (${ITEM_DEFS.cheese.decay}) and butter (${ITEM_DEFS.butter.decay}) rot slower than milk (${milkDecay}), and say by how much`,
  (ITEM_DEFS.cheese.decay ?? 99) < milkDecay && (ITEM_DEFS.butter.decay ?? 99) < milkDecay
    && !!ITEM_DEFS.cheese.description?.includes('the rate of a bucket of milk') && !!ITEM_DEFS.butter.description?.includes('the rate of a bucket of milk'),
  `${ITEM_DEFS.cheese.description} / ${ITEM_DEFS.butter.description}`);
const feedsOf = (id: string): string => Object.entries(ITEM_DEFS[id].feeds ?? {}).sort().map(([n, v]) => `${n}:${v}`).join(',');
const feedsIsle = psql(`select string_agg(f.item || '=' || f.nutrient || ':' || f.amount, ',' order by f.item, f.nutrient) from item_feeds f where f.item in ('butter', 'pastry')`);
const feedsHere = ['butter', 'pastry'].flatMap((id) => feedsOf(id).split(',').map((x) => `${id}=${x}`)).join(',');
check(`butter and pastry feed the same on both sides: ${feedsHere}`, feedsIsle === feedsHere, feedsIsle);

const milkers = Object.values(SPECIES).filter((d) => d.milk).map((d) => d.id).sort();
const constsIsle = psql(`select concat_ws('|', bucket_litres()::int, milk_ready(),
  (select string_agg(id || ':' || milk_litres(id), ',' order by id) from species_def where milk))`);
const constsHere = [BUCKET_LITRES, MILK_READY, milkers.map((id) => `${id}:${milkLitres(id)}`).join(',')].join('|');
check(`every kind that is milked (${milkers.join(', ')}) fills a bucket of ${BUCKET_LITRES} a milking, the same on both sides`,
  constsIsle === constsHere && milkers.length > 0 && milkers.every((id) => milkLitres(id) === BUCKET_LITRES),
  `${constsIsle} / ${constsHere}`);

/* ---- on the island --------------------------------------------------------------- */

const MIRA = 'da1e7000-0000-4000-8000-0000000000a1';
const count = (def: string): string => `coalesce((select sum(count) from item where world_id = w and holder_uid = u and def = '${def}'), 0)`;
const charges = (def: string): string =>
  `coalesce((select string_agg(coalesce(charges::int::text, '-'), ',' order by id) from item where world_id = w and holder_uid = u and def = '${def}'), '-')`;
const lastSaid = "(select e.text from event e where e.world_id = w and e.uid = u and e.kind = 'wildermon' and e.text like 'Milked %' order by e.n desc limit 1)";
const milkAt = (v: string): string => `jsonb_build_object('kind', 'creature', 'id', ${v})`;
const refusal = (v: string): string => `coalesce(act_refusal(w, u, 'milk_creature', ${milkAt(v)}), 'none')`;
const feed = (v: string, fleece: number, hunger: number): string =>
  `update creature set fleece = ${fleece}, hunger = ${hunger} where world_id = w and id = ${v};`;
const craft = (r: string): string => `perform perform_craft(w, u, '${r}', jsonb_build_object('kind', 'item', 'uid', null));`;
/** The hunger a Cudda's milking is made at. */
const HUNGERS = [1, 0, 0.5];

const out = psql(`
set wildermon.season = '';
discard temp;
begin;
create temp table said (k text, v text);
-- Every skill check passes, and nothing made here comes out rare.
create or replace function skill_check(p_skill double precision, p_difficulty double precision,
  p_tool_ql double precision default 0, p_ease double precision default 0) returns boolean language sql as 'select true';
create or replace function perk_rare(p_chance double precision) returns text language sql as 'select null::text';
create or replace function rarity_roll() returns text language sql as 'select null::text';
do $t$
declare w uuid; u uuid := '${MIRA}'; v_cudda int; v_x bigint; v_st bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Dairy', 162, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player';
  update player set x = 10.5, y = 10.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb, craft_from_stores = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w;
  insert into skill (world_id, uid, id, value) values (w, u, 'cooking', 60), (w, u, 'carpentry', 60), (w, u, 'farming', 60)
    on conflict (world_id, uid, id) do update set value = excluded.value;

  -- Kept on a settlement of hers, where a kept beast stays put.
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Dairyholt', 10, 10, 5, 1, u);

  -- 1. A Cudda fills a bucket.
  select creature_spawn(w, 'cudda', 10.5, 9.5, 'deed', now() - interval '10 days', u) into v_cudda;
  update creature set sex = 'female', traits = '{}', mode = 'deed', keeper = u, leg_at = now(), leg_ends = now(),
         until = now() + interval '1 hour', settled_at = now()
   where world_id = w and id = v_cudda;
  update creature set from_x = 10.5, from_y = 9.5, to_x = 10.5, to_y = 9.5 where world_id = w and id = v_cudda;
  ${feed('v_cudda', 1, HUNGERS[0])}
  insert into said select 'NAMES', (select name from creature where world_id = w and id = v_cudda);
  insert into said values ('C:none', ${refusal('v_cudda')});
  perform give(w, u, 'bucket', 1, 30);
  insert into said values ('C:ask', ${refusal('v_cudda')});
  perform act_perform(w, u, 'milk_creature', ${milkAt('v_cudda')});
  insert into said values ('C', ${count('milk_bucket')} || '|' || ${count('bucket')} || '|' || ${charges('milk_bucket')} || '|' || ${lastSaid});
  perform give(w, u, 'bucket', 1, 30);
  insert into said values ('C:again', ${refusal('v_cudda')});
  delete from item where world_id = w and holder_uid = u and def in ('milk_bucket', 'bucket');

  -- And a Cudda will not go into a part bucket.
  perform give(w, u, '${MILK_PART}', 1, 30);
  ${feed('v_cudda', 1, 1)}
  insert into said values ('C:part', ${refusal('v_cudda')});
  delete from item where world_id = w and holder_uid = u and def = '${MILK_PART}';
  perform give(w, u, 'milk_bucket', 1, 40);

  -- 3. The churn, built and set down; churned at, the bucket comes back.
  insert into said values ('CH:away', coalesce(craft_refusal(w, u, '${CHURN_BUTTER}', null), 'ALLOWED'));
  perform give(w, u, 'mallet', 1, 50);
  v_x := give(w, u, 'plank', 12, 40);
  perform give(w, u, 'shaft', 2, 40); perform give(w, u, 'ribbon', 2, 40); perform give(w, u, 'nail', 12, 40);
  perform perform_craft(w, u, 'make_${BUTTER_CHURN}', jsonb_build_object('kind', 'item', 'uid', v_x));
  select id into v_st from item where world_id = w and holder_uid = u and def = '${BUTTER_CHURN}';
  perform act_perform(w, u, 'place_furniture', jsonb_build_object('kind', 'tile', 'itemUid', v_st, 'x', 9, 'y', 10, 'sx', 2, 'sy', 1, 'facing', 's'));
  insert into said values ('CH:placed', (select count(*) from placed where world_id = w and kind = 'furniture' and sub = '${BUTTER_CHURN}')::text);
  insert into said values ('CH:at', coalesce(craft_refusal(w, u, '${CHURN_BUTTER}', null), 'ALLOWED'));
  ${craft(CHURN_BUTTER)}
  insert into said values ('CH', ${count('butter')} || '|' || ${count('bucket')} || '|' || ${count('milk_bucket')});

  -- 4. Pastry, at a lit fire; and cheese, in a clay bowl.
  insert into placed (world_id, kind, x, y, sx, sy, cx, cy, ql, made_by, lit, fuel, since)
    values (w, 'campfire', 11, 11, 0, 0, 11.25, 11.25, 40, u, true, 3600, now());
  perform give(w, u, 'dough', 1, 40);
  ${craft('bake_pastry')}
  insert into said values ('PA', ${count('pastry')} || '|' || ${count('butter')} || '|' || ${count('dough')});
  delete from item where world_id = w and holder_uid = u and def = 'bucket';
  perform give(w, u, 'milk_bucket', 1, 40);
  perform give(w, u, 'clay_bowl', 1, 40);
  ${craft('make_cheese')}
  insert into said values ('CHEESE', ${count('cheese')} || '|' || ${count('bucket')} || '|' || ${count('milk_bucket')} || '|' || ${count(WHEY_BUCKET)});
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const part = (k: string, i = 0): string => (isle.get(k) ?? '').split('|')[i] ?? '';
const isleCudda = part('NAMES', 0);

/* ---- in the browser, the same ----------------------------------------------------- */

const g = Game.create(162, 256);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
g.inventory.items.length = 0;
g.putBody(10.5, 10.5, 0);
g.settings.fromStores = false;
for (const s of ['cooking', 'carpentry', 'farming']) g.skills.values.set(s, 60);
const said: string[] = [];
const logOf = g.logMsg.bind(g);
g.logMsg = (m: string, k?: Parameters<typeof logOf>[1]) => { said.push(m); logOf(m, k); };
const lastMilk = (): string => [...said].reverse().find((m) => m.startsWith('Milked ')) ?? '';
g.rand = () => 0.01;
const held = (id: string): number => g.inventory.items.filter((it) => it.id === id).reduce((n, it) => n + it.count, 0);
const one = (id: string): Item | undefined => g.inventory.items.find((it) => it.id === id);
const act = (id: string): ActionDef => ACTION_BY_ID.get(id) as ActionDef;
const thing = (id: string, ql: number, n = 1): Item => g.gather(id, { count: n, ql });
const tame = (species: string, x: number, y: number): Creature => {
  const c = g.creatures.spawn(species, x, y, 'deed', () => 0.5, -1e9);
  c.sex = 'female';
  c.traits = [];
  return c;
};
const at = (c: Creature): Target => ({ kind: 'creature', id: c.id } as Target);
const ask = (c: Creature): string => act('milk_creature').check?.(at(c), g) ?? 'none';
const milk = (c: Creature, fleece: number, hunger: number): void => {
  c.fleece = fleece;
  c.hunger = hunger;
  act('milk_creature').perform(at(c), g);
};
const qlOf = (fleece: number, hunger: number): number => Math.max(1, Math.min(100, 20 + fleece * 40 + hunger * 30));

/* 1. A Cudda. */
const cudda = tame('cudda', 10.5, 9.5);
const cNone = ask(cudda);
thing('bucket', 30);
const cAsk = ask(cudda);
milk(cudda, 1, HUNGERS[0]);
const cSaid = lastMilk();
check(`a Cudda fills a bucket, the same on both sides: ${cSaid}`,
  cNone === 'Need an empty bucket.' && isle.get('C:none') === cNone && cAsk === 'none' && isle.get('C:ask') === 'none'
    && part('C', 0) === '1' && part('C', 1) === '0' && held('milk_bucket') === 1 && held('bucket') === 0
    && cSaid === milkedSays(cudda.name, BUCKET_LITRES, qlOf(1, HUNGERS[0])) && part('C', 3) === milkedSays(isleCudda, BUCKET_LITRES, qlOf(1, HUNGERS[0])),
  `${isle.get('C:none')} ${isle.get('C:ask')} ${isle.get('C')} / ${cNone} ${cAsk} ${cSaid}`);
thing('bucket', 30);
const cAgain = ask(cudda);
check(`it will not be milked again until ${MILK_READY * 100}% of its milk is back, the same on both sides`,
  cAgain === `${cudda.name}: no milk yet.` && isle.get('C:again') === `${isleCudda}: no milk yet.`,
  `${isle.get('C:again')} / ${cAgain}`);
g.inventory.items.length = 0;
thing(MILK_PART, 30);
cudda.fleece = 1;
const cPart = ask(cudda);
check('a Cudda wants an empty bucket, a part bucket of milk will not do, on both sides', cPart === 'Need an empty bucket.' && isle.get('C:part') === cPart,
  `${isle.get('C:part')} / ${cPart}`);
g.inventory.items.length = 0;
const bucketOfMilk = thing('milk_bucket', 40);

/* 3. The churn. */
const churn = RECIPE_BY_ID.get(CHURN_BUTTER);
const away = churn ? recipeReason(churn, g) : 'none';
check(`churning wants a butter churn, in the same words on both sides: ${away}`,
  !!away && away === isle.get('CH:away') && away.includes(STATION_NAME[BUTTER_CHURN]), `${isle.get('CH:away')} / ${away}`);
thing('mallet', 50);
const planks = thing('plank', 40, 12);
thing('shaft', 40, 2); thing('ribbon', 40, 2); thing('nail', 40, 12);
act(`make_${BUTTER_CHURN}`).perform({ kind: 'item', uid: planks.uid }, g);
const churnItem = one(BUTTER_CHURN);
act('place_furniture').perform({ kind: 'tile', x: 9, y: 10, sx: 2, sy: 1, itemUid: churnItem?.uid ?? -1, facing: 's' } as Target, g);
const placed = [...g.furniture.values()].some((f) => f.kind === BUTTER_CHURN);
const atChurn = churn ? recipeReason(churn, g) : 'none';
check('built and set down, it is stood at on both sides', placed && isle.get('CH:placed') === '1' && atChurn === null && isle.get('CH:at') === 'ALLOWED',
  `${isle.get('CH:placed')} ${isle.get('CH:at')} / ${placed} ${atChurn}`);
act(CHURN_BUTTER).perform({ kind: 'item', uid: bucketOfMilk.uid }, g);
check(`a bucket of milk churns into ${BUTTER_PATS} pats of butter and the bucket back, on both sides`,
  isle.get('CH') === `${BUTTER_PATS}|1|0` && held('butter') === BUTTER_PATS && held('bucket') === 1 && held('milk_bucket') === 0,
  `${isle.get('CH')} / ${held('butter')}|${held('bucket')}|${held('milk_bucket')}`);

/* 4. Pastry and cheese. */
const pastry = RECIPE_BY_ID.get('bake_pastry');
const butterIn = pastry?.inputs.find((i) => i.item === 'butter')?.count ?? 0;
check(`pastry and cheese give what they say on the island: ${pastry?.count} pastries for ${butterIn} pats, ${RECIPE_BY_ID.get('make_cheese')?.count} cheeses and the bucket back full of whey`,
  isle.get('PA') === `${pastry?.count}|${BUTTER_PATS - butterIn}|0` && isle.get('CHEESE') === `${RECIPE_BY_ID.get('make_cheese')?.count}|0|0|1`,
  `${isle.get('PA')} ${isle.get('CHEESE')}`);

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`milk, butter and cheese — ${ok.length} of ${ok.length}`);
