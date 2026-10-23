/**
 * Whey (`dairy.ts`), on both sides.
 *
 * A bucket of milk pressed into cheese hands the bucket back full of whey,
 * and a failure hands it back empty. A bucket of whey is a vessel like any
 * other bucket of something (`VESSELS`, `vessel_def`), and a creature you
 * keep, of any kind, is fed it: it fills `WHEY_FEED` of its hunger and the
 * bucket comes back empty, at the bucket's own quality. A thing of its own
 * diet still fills a meal (`GRAZE_FILL`), and Feed takes the thing it is
 * asked to (`itemUid`) when there is a choice. What this asks:
 *
 *   * the bucket of whey, its vessel row, the recipe's returns and the two
 *     constants are the same rows on both sides;
 *   * pressing cheese gives the cheeses and a bucket of whey, and a failure
 *     an empty bucket, on the island and in the browser alike;
 *   * Feed with whey, with the creature's diet, with whey asked for over the
 *     diet, and with nothing it takes, comes to the same hunger, the same
 *     pack and the same words on both sides;
 *   * and the feed button (`worstFoodFor`) offers what fills least, a bucket
 *     of whey before the diet, and of the same fill the lowest quality.
 *
 * Every roll is set. Runs against the database the suite leaves behind; the
 * island half is rolled back.
 *
 *   npx esbuild supabase/test/whey.ts --bundle --platform=node --format=esm \
 *     --outfile=node_modules/.cache/whey.mjs && node node_modules/.cache/whey.mjs
 */
import { execFileSync } from 'node:child_process';
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type ActionDef, type Target } from '../../src/game/actions';
import { GRAZE_FILL, SPECIES, type Creature } from '../../src/game/creatures';
import { feedFill, feedRefusal } from '../../src/game/creatureActions';
import { WHEY_BUCKET, WHEY_FEED, wheyFedSays } from '../../src/game/dairy';
import { VESSELS } from '../../src/game/furniture';
import { ITEM_DEFS, type Item } from '../../src/game/items';
import { RECIPE_BY_ID } from '../../src/game/recipes';
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

/* ---- the rows, the same on both sides ------------------------------------------------- */

const d = ITEM_DEFS[WHEY_BUCKET];
const itemIsle = psql(`select concat_ws('|', d.name, d.category, d.weight, coalesce(d.food, 0), coalesce(d.decay, -1), d.description)
  from item_def d where d.id = '${WHEY_BUCKET}'`);
const itemHere = d ? [d.name, d.category, d.weight, d.food ?? 0, d.decay ?? -1, d.description].join('|') : 'none';
check(`the bucket of whey is the same item on both sides: ${d?.description}`, itemIsle === itemHere, `${itemIsle}\n   / ${itemHere}`);
const vesselIsle = psql(`select liquid || '|' || empty from vessel_def where item = '${WHEY_BUCKET}'`);
const vessel = VESSELS[WHEY_BUCKET];
check('it is a bucket of whey, emptied into a bucket, on both sides', !!vessel && vesselIsle === `${vessel.liquid}|${vessel.empty}`, `${vesselIsle} / ${vessel?.liquid}|${vessel?.empty}`);
const cheese = RECIPE_BY_ID.get('make_cheese');
const givesHere = [...(cheese?.returns ?? []).map(([i, n]) => `return:${i}:${n}`), ...(cheese?.salvage ?? []).map(([i, n]) => `salvage:${i}:${n}`)].sort().join(',');
const givesIsle = psql(`select string_agg(kind || ':' || item || ':' || count, ',' order by kind || ':' || item || ':' || count) from recipe_gives where recipe = 'make_cheese'`);
check(`pressing cheese hands back a bucket of whey, and an empty bucket when it fails, on both sides: ${givesHere}`,
  givesIsle === givesHere && givesHere === `return:${WHEY_BUCKET}:1,salvage:bucket:1`, `${givesIsle} / ${givesHere}`);
const constsIsle = psql(`select concat_ws('|', whey_bucket(), whey_feed(), graze_fill())`);
check(`whey_bucket(), whey_feed() and graze_fill() are the browser's ${WHEY_BUCKET}, ${WHEY_FEED} and ${GRAZE_FILL}`,
  constsIsle === [WHEY_BUCKET, WHEY_FEED, GRAZE_FILL].join('|'), constsIsle);

/* ---- on the island --------------------------------------------------------------- */

const MIRA = 'da1e7000-0000-4000-8000-0000000000b2';
/** Fed where a meal would not fill it to the brim, so what each fills is all there. */
const HUNGER = 0.2;
/** A beast whose diet whey is no part of, and the diet item it is fed. */
const BEAST = 'cudda';
const DIET = SPECIES[BEAST].diet[0];
const count = (def: string): string => `coalesce((select sum(count) from item where world_id = w and holder_uid = u and def = '${def}'), 0)`;
const qlOf = (def: string): string =>
  `coalesce((select string_agg(round(ql::numeric, 2)::text, ',' order by id) from item where world_id = w and holder_uid = u and def = '${def}'), '-')`;
const lastSaid = "(select e.text from event e where e.world_id = w and e.uid = u and e.kind in ('event', 'wildermon') order by e.n desc limit 1)";
const at = "jsonb_build_object('kind', 'creature', 'id', v_c)";
const hunger = "(select round(hunger::numeric, 6)::text from creature where world_id = w and id = v_c)";
const packSql = `${count('bucket')} || '|' || ${count(WHEY_BUCKET)} || '|' || ${count(DIET)}`;

const out = psql(`
set wurm.season = '';
discard temp;
begin;
create temp table said (k text, v text);
create or replace function perk_rare(p_chance double precision) returns text language sql as 'select null::text';
create or replace function rarity_roll() returns text language sql as 'select null::text';
do $t$
declare w uuid; u uuid := '${MIRA}'; v_c int; v_whey bigint;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Whey', 163, 64, 10, 10, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Mira');
  delete from item where world_id = w and holder = 'player';
  update player set x = 10.5, y = 10.5, body_at = now(), swim_at = now(), equipped = '{}'::jsonb, craft_from_stores = false,
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w;
  insert into skill (world_id, uid, id, value) values (w, u, 'cooking', 60)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Wheyholt', 10, 10, 5, 1, u);

  -- 1. Cheese that fails: the milk is lost and the bucket comes back empty.
  create or replace function skill_check(p_skill double precision, p_difficulty double precision,
    p_tool_ql double precision default 0, p_ease double precision default 0) returns boolean language sql as 'select false';
  perform give(w, u, 'milk_bucket', 1, 40);
  perform give(w, u, 'clay_bowl', 1, 40);
  perform perform_craft(w, u, 'make_cheese', jsonb_build_object('kind', 'item', 'uid', null));
  insert into said values ('FAIL', ${count('cheese')} || '|' || ${count('bucket')} || '|' || ${count(WHEY_BUCKET)} || '|' || ${count('milk_bucket')});
  delete from item where world_id = w and holder_uid = u and def in ('bucket', '${WHEY_BUCKET}');

  -- 2. Cheese that takes: the cheeses, and the bucket back full of whey.
  create or replace function skill_check(p_skill double precision, p_difficulty double precision,
    p_tool_ql double precision default 0, p_ease double precision default 0) returns boolean language sql as 'select true';
  perform give(w, u, 'milk_bucket', 1, 40);
  perform perform_craft(w, u, 'make_cheese', jsonb_build_object('kind', 'item', 'uid', null));
  insert into said values ('CHEESE', ${count('cheese')} || '|' || ${count('bucket')} || '|' || ${count(WHEY_BUCKET)} || '|' || ${count('milk_bucket')});
  delete from item where world_id = w and holder_uid = u and def in ('cheese', '${WHEY_BUCKET}', 'clay_bowl');

  -- 3. A kept ${BEAST}, hungry.
  select creature_spawn(w, '${BEAST}', 10.5, 9.5, 'deed', now() - interval '9 hours', u) into v_c;
  update creature set mode = 'deed', keeper = u, leg_at = now(), leg_ends = now(), until = now() + interval '1 hour', settled_at = now(),
         from_x = 10.5, from_y = 9.5, to_x = 10.5, to_y = 9.5, hunger = ${HUNGER}
   where world_id = w and id = v_c;
  insert into said values ('NAME', (select name from creature where world_id = w and id = v_c));
  insert into said values ('R:none', coalesce(act_refusal(w, u, 'feed', ${at}), 'none'));

  -- 4. Fed a bucket of whey.
  perform give(w, u, '${WHEY_BUCKET}', 1, 35);
  insert into said values ('R:whey', coalesce(act_refusal(w, u, 'feed', ${at}), 'none'));
  perform act_perform(w, u, 'feed', ${at});
  insert into said values ('WHEY', ${hunger} || '|' || ${packSql} || '|' || ${qlOf('bucket')} || '|' || ${lastSaid});
  delete from item where world_id = w and holder_uid = u;

  -- 5. Fed of its own diet.
  update creature set hunger = ${HUNGER} where world_id = w and id = v_c;
  perform give(w, u, '${DIET}', 2, 30);
  perform act_perform(w, u, 'feed', ${at});
  insert into said values ('DIET', ${hunger} || '|' || ${packSql} || '|' || ${lastSaid});

  -- 6. With both in the pack, the diet first: whey when whey is what is asked for.
  update creature set hunger = ${HUNGER} where world_id = w and id = v_c;
  v_whey := give(w, u, '${WHEY_BUCKET}', 1, 35);
  perform act_perform(w, u, 'feed', ${at} || jsonb_build_object('itemUid', v_whey));
  insert into said values ('ASKED', ${hunger} || '|' || ${packSql});
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const part = (k: string, i = 0): string => (isle.get(k) ?? '').split('|')[i] ?? '';
const isleName = isle.get('NAME') ?? '';

/* ---- in the browser, the same ----------------------------------------------------- */

const g = Game.create(163, 256);
const w = g.world;
w.water = null;
w.heights.fill(10);
w.tiles.fill(TileType.Grass);
w.data.fill(0);
for (const id of [...g.creatures.list.keys()]) g.creatures.list.delete(id);
g.inventory.items.length = 0;
g.putBody(10.5, 10.5, 0);
g.settings.fromStores = false;
g.skills.values.set('cooking', 60);
const said: string[] = [];
const logOf = g.logMsg.bind(g);
g.logMsg = (m: string, k?: Parameters<typeof logOf>[1]) => { said.push(m); logOf(m, k); };
const held = (id: string): number => g.inventory.items.filter((it) => it.id === id).reduce((n, it) => n + it.count, 0);
const act = (id: string): ActionDef => ACTION_BY_ID.get(id) as ActionDef;
const thing = (id: string, ql: number, n = 1): Item => g.gather(id, { count: n, ql });
const near = (a: string | number, b: number, by = 1e-6): boolean => Math.abs(Number(a) - b) <= by;
const pressCheese = (): void => {
  const milk = thing('milk_bucket', 40);
  act('make_cheese').perform({ kind: 'item', uid: milk.uid }, g);
};

/* 1 and 2. Cheese. */
thing('clay_bowl', 40);
g.rand = () => 0.99;
pressCheese();
const failHere = `${held('cheese')}|${held('bucket')}|${held(WHEY_BUCKET)}|${held('milk_bucket')}`;
check(`pressing cheese that fails loses the milk and hands back an empty bucket, on both sides: ${failHere}`,
  isle.get('FAIL') === failHere && failHere === '0|1|0|0', `${isle.get('FAIL')} / ${failHere}`);
g.inventory.items = g.inventory.items.filter((it) => it.id === 'clay_bowl');
g.rand = () => 0.01;
pressCheese();
const made = cheese?.count ?? 1;
const cheeseHere = `${held('cheese')}|${held('bucket')}|${held(WHEY_BUCKET)}|${held('milk_bucket')}`;
check(`pressing cheese gives ${made} cheeses and the bucket back full of whey, on both sides: ${cheeseHere}`,
  isle.get('CHEESE') === cheeseHere && cheeseHere === `${made}|0|1|0`, `${isle.get('CHEESE')} / ${cheeseHere}`);
g.inventory.items.length = 0;

/* 3. A kept beast, hungry. */
const c: Creature = g.creatures.spawn(BEAST, 10.5, 9.5, 'deed', () => 0.5, -1e9);
const target = (extra: object = {}): Target => ({ kind: 'creature', id: c.id, ...extra } as Target);
const ask = (t: Target = target()): string => act('feed').check?.(t, g) ?? 'none';
const feed = (t: Target = target()): void => { act('feed').perform(t, g); };
const pack = (): string => `${held('bucket')}|${held(WHEY_BUCKET)}|${held(DIET)}`;
c.hunger = HUNGER;
const rNone = ask();
check(`with nothing it takes, Feed is refused in the same words on both sides: ${rNone}`,
  rNone === feedRefusal(c) && isle.get('R:none') === rNone.replace(c.name, isleName) && rNone.includes('whey'),
  `${isle.get('R:none')} / ${rNone}`);

/* 4. Whey. */
const whey = thing(WHEY_BUCKET, 35);
const rWhey = ask();
feed();
const wheyHunger = HUNGER + WHEY_FEED;
const bucketBack = g.inventory.items.find((it) => it.id === 'bucket');
check(`a bucket of whey fills ${WHEY_FEED} of a ${SPECIES[BEAST].name}'s hunger, whey being no part of its diet, and the bucket comes back at its quality, on both sides`,
  rWhey === 'none' && isle.get('R:whey') === 'none' && !SPECIES[BEAST].diet.includes(WHEY_BUCKET)
    && near(c.hunger, wheyHunger) && near(part('WHEY', 0), wheyHunger) && feedFill(WHEY_BUCKET) === WHEY_FEED
    && pack() === '1|0|0' && `${part('WHEY', 1)}|${part('WHEY', 2)}|${part('WHEY', 3)}` === pack()
    && near(bucketBack?.ql ?? 0, whey.ql) && near(part('WHEY', 4), 35, 0.01),
  `${isle.get('WHEY')} / ${c.hunger}|${pack()}|${bucketBack?.ql}`);
check(`and says so the same: ${said[said.length - 1]}`,
  said[said.length - 1] === wheyFedSays(c.name) && part('WHEY', 5) === wheyFedSays(isleName), `${part('WHEY', 5)} / ${said[said.length - 1]}`);
g.inventory.items.length = 0;

/* 5. Its own diet. */
c.hunger = HUNGER;
thing(DIET, 30, 2);
feed();
check(`one ${DIET} of its diet fills a meal, ${GRAZE_FILL}, on both sides`,
  near(c.hunger, HUNGER + GRAZE_FILL) && near(part('DIET', 0), HUNGER + GRAZE_FILL) && pack() === '0|0|1'
    && `${part('DIET', 1)}|${part('DIET', 2)}|${part('DIET', 3)}` === pack() && part('DIET', 4) === said[said.length - 1].replace(c.name, isleName),
  `${isle.get('DIET')} / ${c.hunger}|${pack()}|${said[said.length - 1]}`);

/* 6. Whey asked for, over the diet that is first in the pack. */
c.hunger = HUNGER;
const asked = thing(WHEY_BUCKET, 35);
feed(target({ itemUid: asked.uid }));
check('Feed takes the bucket of whey it is asked to over the diet before it in the pack, on both sides',
  near(c.hunger, wheyHunger) && near(part('ASKED', 0), wheyHunger) && pack() === '1|0|1' && `${part('ASKED', 1)}|${part('ASKED', 2)}|${part('ASKED', 3)}` === pack(),
  `${isle.get('ASKED')} / ${c.hunger}|${pack()}`);

/*
 * 7. The feed button (`worstFoodFor`): what fills least first, so a bucket of
 * whey before its diet, and of the same fill the lowest quality. It asks for
 * that thing by `itemUid`, which the island honours as in 6.
 */
g.inventory.items.length = 0;
thing(DIET, 50);
const poorer = thing(DIET === 'carrot' ? 'wheat' : 'carrot', 20);
const quick = (): string => {
  const it = g.worstFoodFor(c);
  return it ? `${it.id}:${it.ql}` : 'none';
};
const dietOnly = quick();
const quickWhey = thing(WHEY_BUCKET, 60);
const withWhey = quick();
check(`the feed button offers the bucket of whey (fills ${WHEY_FEED}) over the diet (fills ${GRAZE_FILL}), and of the diet alone the poorest`,
  WHEY_FEED < GRAZE_FILL && SPECIES[BEAST].diet.includes(poorer.id) && dietOnly === `${poorer.id}:${poorer.ql}` && withWhey === `${WHEY_BUCKET}:${quickWhey.ql}`,
  `${dietOnly} then ${withWhey}`);
g.inventory.items.length = 0;
check('and offers nothing when nothing it is fed is carried', quick() === 'none', quick());

for (const line of [...ok, ...bad]) console.log(line);
if (bad.length) {
  console.error(`${bad.length} of ${ok.length + bad.length} are not what they should be`);
  process.exit(1);
}
console.log(`whey from cheese, fed to a creature — ${ok.length} of ${ok.length}`);
