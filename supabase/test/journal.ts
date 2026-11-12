/**
 * The journal counts only your own work, and counts what each goal says.
 *
 * Reported: "Journal is largely bugged, often receiving completions when
 * another online player completes a task. Some journal tasks seem completely
 * bugged." Asked: review every goal, and give each a how-to that opens.
 *
 * The browser:
 *
 *   * on an island nothing is counted here but the two counts only a browser
 *     sees (`BROWSER_TALLY`), and the traps in view are not rolled here, where
 *     anybody's trap that caught something said "caught" in your journal;
 *   * every goal that read the world in view -- a neighbour's walls and
 *     storeys, a settlement you are only a citizen of, honey sitting in a
 *     hive, a bed, a cart's yokes -- reads a count of your own now, and is not
 *     met by what it used to read;
 *   * cooking on a campfire is everything Crafting cooks at one;
 *   * every goal has a how-to, with every number filled in.
 *
 * The island: each new count is noted for whoever did the thing, and not for
 * anybody else -- sowing, a wall and a storey floor finished, honey taken out
 * of a hive, a night in a bed you built against somebody else's -- and every
 * count a goal reads is noted somewhere on it.
 *
 * And the first wildermon, the chapter after Ashore: an offering that takes and Work around me started are each noted
 * on the island for whoever did it ('tamed', 'around'), and the browser shows both goals met from the tally the beat
 * carries; their how-tos read off the rules they name.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { BROWSER_TALLY, Game } from '../../src/game/game';
import { ALL_GOALS, JOURNAL } from '../../src/game/journal';
import '../../src/game/recipes';
import { RECIPES } from '../../src/game/recipes';
import { AROUND_ACTION_BY_ID, AROUND_MOST, aroundTrade } from '../../src/game/around';
import { SPECIES, WILD_STAGE_TAME } from '../../src/game/creatures';
import { itemDef } from '../../src/game/items';
import { POST_FOLLOW_REACH } from '../../src/game/posts';

const psql = (sql: string): string =>
  execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A', '-f', '-'], {
    input: sql,
    encoding: 'utf8',
    env: {
      ...process.env,
      PGHOST: process.env.PGHOST ?? '/var/run/postgresql',
      PGPORT: process.env.PGPORT ?? '5433',
      PGUSER: process.env.PGUSER ?? 'wildermon',
      PGDATABASE: process.env.PGDATABASE ?? 'postgres',
    },
  }).trim();

const ok: string[] = [];
const bad: string[] = [];
const check = (what: string, passed: boolean, detail = ''): void => {
  (passed ? ok : bad).push(`${passed ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
};
const goal = (id: string) => {
  const g = ALL_GOALS.find((x) => x.id === id);
  if (!g) throw new Error(`no goal ${id}`);
  return g;
};

/* ---- the browser --------------------------------------------------------- */

const game = Game.create(4242);
const px = Math.floor(game.player.x), py = Math.floor(game.player.y);
const met = (id: string): boolean => goal(id).met(game);
const clear = (): void => {
  for (const k of Object.keys(game.tally)) delete game.tally[k];
};

// On an island: only the counts a browser alone can see are counted here.
game.tallyFromIsland = true;
clear();
game.note('caught');
game.note('slew:goblin');
game.note('reach');
check('on an island a count this side makes is not kept, but for the two only a browser sees',
  game.tally.caught === undefined && game.tally['slew:goblin'] === undefined && game.tally.reach === 1 && BROWSER_TALLY.size === 2,
  JSON.stringify(game.tally));
game.tallyFromIsland = false;

// And the traps in view are the island's to roll, not this side's.
const trap = game.addTrap('deadfall', px + 3, py, 0, 0, 30);
trap.dmg = 0;
game.packFromIsland = true;
(game as unknown as { updateWorld(dt: number): void }).updateWorld(30);
const islandDmg = trap.dmg;
game.packFromIsland = false;
(game as unknown as { updateWorld(dt: number): void }).updateWorld(30);
check('on an island the traps in view are not rolled or worn here; alone they are', islandDmg === 0 && trap.dmg > 0, `${islandDmg}, ${trap.dmg}`);

// The goals that read the world in view are not met by it any more, and are met by a count of your own.
clear();
const wall = game.buildings.setFence(px, py, 'n', 'solid', 'log');
for (const k of Object.keys(wall.needed)) wall.needed[k] = 0;
check('somebody\'s finished wall in view does not finish your house', !met('house'));
game.tally.walled = 3;
check('three walls of your own do not either', !met('house'));
game.tally.walled = 4;
check('four of your own do', met('house'));

game.deed = { name: 'Theirs', x: px, y: py, radius: 5, level: 5, mine: false } as never;
check('a citizen of somebody else\'s settlement has not founded one, nor raised it', !met('deed') && !met('deed3') && !met('deed5'));
game.deed = { name: 'Mine', x: px, y: py, radius: 5, level: 3 } as never;
check('your own at level 3 is founded and raised to 3, not 5', met('deed') && met('deed3') && !met('deed5'));
game.deed = null;

const hive = game.addFurniture('hive', px + 2, py + 2, 0, 0, 30, [{ uid: game.inventory.nextUid++, id: 'honey', ql: 30, dmg: 0, count: 3 }]);
check('honey sitting in a hive is not honey taken', !met('hive'));
game.tally.honey = 1;
check('honey taken is', met('hive'));
game.removeFurniture(hive.id);

const pairs: Array<[string, string]> = [
  ['plank', 'made:plank'], ['smelt', 'smelted'], ['improve', 'improved50'], ['improve90', 'improved90'], ['field', 'sowed'],
  ['rod', 'made:fishing_rod'], ['composite', 'made:composite_bow'], ['cart', 'team:large_cart'], ['wagon', 'team:wagon'],
  ['storey', 'storey'], ['relic', 'restored'], ['rest', 'slept:own'], ['fantastic_blood', 'fantasticblood'],
];
clear();
// What each used to read, all of it there: skills high, a rod, a bow and fine things in the pack.
for (const s of ['carpentry', 'farming', 'restoration']) game.skills.values.set(s, 60);
game.inventory.add('fishing_rod', { ql: 95 });
game.inventory.add('composite_bow', { ql: 95 });
game.tally.slept = 3;
game.tally.hitched = 2;
const before = pairs.filter(([id]) => met(id)).map(([id]) => id);
check('none of these is met by what it used to read: a skill, a thing in the pack, any bed, any yoke', before.length === 0, before.join(', '));
const after = pairs.filter(([id, key]) => {
  game.tally[key] = 1;
  return !met(id);
}).map(([id]) => id);
check('and each is met by its own count', after.length === 0, after.join(', '));

const cooked = RECIPES.filter((r) => r.station === 'campfire' && r.category === 'Cooking').map((r) => r.result);
const unmet = cooked.filter((id) => {
  clear();
  game.tally[`made:${id}`] = 1;
  return !met('cook');
});
check(`cooking on a campfire is anything Crafting cooks at one (${cooked.length})`, cooked.length > 4 && unmet.length === 0, unmet.join(', '));

// A melee weapon, a banner on your settlement, any boat with a sail.
clear();
const notMelee = game.inventory.add('short_bow', { ql: 30 });
notMelee.enchant = { id: 'farsight', ql: 30 };
check('a bow with an enchantment in it is not an enchanted melee weapon', !met('enchanted'));
const sword = game.inventory.add('sword', { ql: 30, extra: 'Iron' });
sword.enchant = { id: 'emberbrand', ql: 30 };
check('a sword with one is', met('enchanted'));
const banner = game.addFurniture('banner', px + 30, py + 30, 0, 0, 30);
banner.dye = 'red';
game.deed = { name: 'Mine', x: px, y: py, radius: 5, level: 1 } as never;
check('a dyed banner off your settlement is not on it', !met('colours'));
banner.x = px + 1;
banner.y = py + 1;
check('one inside its border is', met('colours'));
game.deed = null;
game.removeFurniture(banner.id);
const caravel = game.addFurniture('caravel', px + 4, py + 4, 0, 0, 30);
check('a caravel is a sailing boat', met('sail'));
game.removeFurniture(caravel.id);

// Every goal has a how-to, with every number filled in.
const missing = ALL_GOALS.filter((g) => !g.how || g.how.length < 20).map((g) => g.id);
check(`every goal (${ALL_GOALS.length}) has a how-to`, missing.length === 0, missing.join(', '));
const unfilled = ALL_GOALS.filter((g) => /\{[\w.]+(:\w+)?\}/.test(`${g.text} ${g.hint ?? ''} ${g.how ?? ''}`)).map((g) => g.id);
check('and none is left with a number not filled in', unfilled.length === 0, unfilled.join(', '));

/* ---- the island ---------------------------------------------------------- */

const isle = psql(`
begin;
create temp table said (k text, v text);
do $$
declare w uuid; me uuid; them uuid; v_x int; v_y int; v_b int; v_hive bigint; v_honey bigint; v_bed bigint; v_seed bigint;
begin
  select id into w from world where name = 'Hoarding';
  select uid into me from player where world_id = w and name = 'Dane';
  select uid into them from player where world_id = w and name = 'Crowd1';
  select gx, gy into v_x, v_y
    from generate_series(20, 200, 7) gx, generate_series(20, 200, 7) gy
   where not exists (select 1 from deed d where d.world_id = w
                      and abs(d.x - gx) <= d.radius + 8 and abs(d.y - gy) <= d.radius + 8)
   order by gx, gy limit 1;
  update player set body_at = now(), x = v_x + 0.5, y = v_y + 0.5, act = null, act_queue = '[]'::jsonb, tally = '{}'::jsonb,
      stats = jsonb_set(coalesce(stats, '{}'::jsonb), '{stamina}', '1')
   where world_id = w and uid in (me, them);
  delete from item i where i.world_id = w and i.holder = 'player' and i.holder_uid = me;

  -- Seed in a field.
  perform land_set_tile(w, v_x, v_y + 2, tile_id('Field'));
  v_seed := give(w, me, 'carrot_seed', 1, 30);
  perform sow_one(w, me, v_x, v_y + 2, v_seed);

  -- A wall of a building with one log still to go, finished.
  perform give(w, me, 'mallet', 1, 50);
  perform give(w, me, 'log', 1, 30);
  select coalesce(max(id), 0) + 1 into v_b from building where world_id = w;
  insert into building (world_id, id, name, planned_by) values (w, v_b, 'Shed', me);
  insert into building_tile (world_id, building, x, y) values (w, v_b, v_x, v_y);
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total, planned_by)
  select w, 0, bd.dir, bd.x, bd.y, v_b, 'solid', 'log', '{"log": 1}', wall_bill('log', 'solid'), me
    from border_of(v_x, v_y, 'n') bd;
  perform perform_building(w, me, 'build_wall', jsonb_build_object('kind', 'tile', 'x', v_x, 'y', v_y, 'side', 'n'));

  -- Somebody's hive with honey in it, which Dane takes one of.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'hive', v_x + 1, v_y, 0, 0, v_x + 1.5, v_y + 0.5, 30, them) returning id into v_hive;
  insert into item (world_id, holder, placed, def, ql, count) values (w, 'furniture', v_hive, 'honey', 30, 2) returning id into v_honey;
  perform perform_crate(w, me, 'take_from_store', jsonb_build_object('kind', 'item', 'uid', v_honey, 'count', 1));

  -- A bed Crowd1 built, slept in by Dane; then one Dane built.
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'bed', v_x - 2, v_y, 0, 0, v_x - 1.5, v_y + 0.5, 30, them) returning id into v_bed;
  perform perform_last(w, me, 'sleep', jsonb_build_object('kind', 'furniture', 'id', v_bed));
  insert into said values ('THEIR_BED', coalesce((select tally->>'slept:own' from player where world_id = w and uid = me), '0')
    || ',' || coalesce((select tally->>'slept' from player where world_id = w and uid = me), '0'));
  update placed set made_by = me where id = v_bed;
  perform perform_last(w, me, 'sleep', jsonb_build_object('kind', 'furniture', 'id', v_bed));

  insert into said select 'ME', tally::text from player where world_id = w and uid = me;
  insert into said select 'THEM', tally::text from player where world_id = w and uid = them;
end $$;
select k || '=' || v from said;
rollback;
`);
const island: Record<string, string> = {};
for (const line of isle.split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) island[line.slice(0, i)] = line.slice(i + 1);
}
const mine = JSON.parse(island.ME ?? '{}') as Record<string, number>;
const theirs = JSON.parse(island.THEM ?? '{}') as Record<string, number>;
check('on the island, sowing a field counts for the sower', mine.sowed === 1, island.ME);
check('finishing a wall of a building counts for whoever laid the last of it', mine.walled === 1, island.ME);
check('taking honey out of a hive counts for the taker, not whoever set the hive down', mine.honey === 1 && theirs.honey === undefined, `${island.ME} / ${island.THEM}`);
check('a night in somebody else\'s bed is a night, not one in a bed you built', island.THEIR_BED === '0,1', island.THEIR_BED);
check('and one in your own is', mine['slept:own'] === 1, island.ME);
check('and none of it counts for anybody else', Object.keys(theirs).length === 0, island.THEM);

// Every count a goal reads is noted somewhere on the island, but the two only a browser sees.
const keys = new Set<string>();
// Read off the journal's own source: a goal's \`met\` is the closure \`did\` hands back, which no longer says its key.
for (const m of readFileSync('src/game/journal.ts', 'utf8').matchAll(/did\('([^']+)'/g)) keys.add(m[1]);
const defs = psql(`select string_agg(pg_get_functiondef(p.oid), ' ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) like '%journal_note%'`);
const prefixed = (k: string): boolean => {
  const i = k.indexOf(':');
  // A count with a part after the colon is noted as its head and the rest joined on (`'slew:' || c.species`).
  return i > 0 && k !== 'slept:own' && defs.includes(`'${k.slice(0, i + 1)}'`);
};
const unnoted = [...keys].filter((k) => !BROWSER_TALLY.has(k) && !defs.includes(`'${k}'`) && !prefixed(k)
  && !['rare', 'supreme', 'fantastic'].includes(k));
check(`every count a goal reads (${keys.size}) is noted on the island`, unnoted.length === 0, unnoted.join(', '));

/* ---- the first wildermon: tamed, and set to Work around me ---------------- */

/*
 * Asked for: two goals for new players, "Tame a wildermon" and "Set a wildermon to Work around me". Each is met on the
 * island by doing it -- an offering that takes, and Work around me started -- and the browser shows it met from the
 * tally the beat carries (`rpc_settle`, merged as `play.ts` merges it). An island of its own, rolled back; the offering
 * rolled from a fixed seed, and tried until it takes.
 */
const TAMER = '7e5b0000-0000-4000-8000-0000000b0001';
const first = JOURNAL[1];
check('the chapter after Ashore is the first wildermon: tame one, then Work around me',
  first.goals.map((g) => g.id).join(',') === 'tame,workaround' && ALL_GOALS.filter((g) => g.id === 'tame').length === 1,
  `${first.name}: ${first.goals.map((g) => g.id).join(', ')}`);
const pair = psql(`
discard temp;
begin;
select setseed(0.4242);
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${TAMER}'; v_wild int; v_i int; j jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Journal goals', 303, 120, 40, 40, true) returning id into w;
  perform land_blank(w, 120);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 119) x, generate_series(10, 110) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Tamer');
  update player set x = 40.5, y = 40.5, body_at = now(), seen_at = now(), away = false, act = null, act_queue = '[]'::jsonb
   where world_id = w and uid = u;
  insert into said select 'START', coalesce(tally, '{}'::jsonb)::text from player where world_id = w and uid = u;
  insert into said select 'KEPT', count(*)::text from creature where world_id = w and keeper = u;
  perform give(w, u, 'potato', 80, 30);
  insert into skill (world_id, uid, id, value) values (w, u, 'taming', 90)
    on conflict (world_id, uid, id) do update set value = 90;

  -- An offering, until one takes.
  v_wild := creature_spawn(w, 'rabba', 41.2, 40.5, 'wild', now() - interval '10 days', null);
  for v_i in 1..60 loop
    exit when (select mode from creature where world_id = w and id = v_wild) <> 'wild';
    perform act_perform(w, u, 'tame', jsonb_build_object('kind', 'creature', 'id', v_wild));
  end loop;
  insert into said select 'TAMED', mode || '|' || coalesce(keeper::text, '') from creature where world_id = w and id = v_wild;
  insert into said select 'AFTER_TAME', coalesce(tally, '{}'::jsonb)::text from player where world_id = w and uid = u;

  -- Work around me, from its menu.
  j := rpc_act(w, 'work_around', jsonb_build_object('kind', 'creature', 'id', v_wild));
  insert into said values ('ACT', coalesce(j->>'done', j->>'why', j::text));
  insert into said select 'AROUND', mode || '|' || coalesce(around->>'was', 'none') from creature where world_id = w and id = v_wild;
  -- What the beat carries.
  insert into said select 'BEAT', coalesce(rpc_settle(null, w, null, true, null)->'tally', 'null'::jsonb)::text;
end $t$;
select k || '=' || v from said;
rollback;
`);
const two: Record<string, string> = {};
for (const line of pair.split('\n')) {
  const i = line.indexOf('=');
  if (i > 0) two[line.slice(0, i)] = line.slice(i + 1);
}
const start = JSON.parse(two.START ?? '{}') as Record<string, number>;
const afterTame = JSON.parse(two.AFTER_TAME ?? '{}') as Record<string, number>;
const beat = JSON.parse(two.BEAT ?? 'null') as Record<string, number> | null;
check('on the island somebody just ashore has tamed nothing and keeps nothing', !start.tamed && !start.around && two.KEPT === '0', `${two.START}, ${two.KEPT} kept`);
check('an offering that takes is a tame, noted for the tamer', two.TAMED === `active|${TAMER}` && afterTame.tamed === 1 && !afterTame.around,
  `${two.TAMED}; ${two.AFTER_TAME}`);
check('Work around me on the one following you starts, and is noted for whoever started it',
  two.AROUND === 'deed|follow' && beat?.around === 1, `${two.ACT}; ${two.AROUND}; ${two.BEAT}`);

// The browser, from the same tally: as the beat merges it, and as the journal ticks it.
const fresh = Game.create(4243);
fresh.tallyFromIsland = true;
const hear = (tally: Record<string, number>): void => {
  for (const k of Object.keys(fresh.tally)) if (!BROWSER_TALLY.has(k) && !(k in tally)) delete fresh.tally[k];
  for (const [k, v] of Object.entries(tally)) if (typeof v === 'number') fresh.tally[k] = v;
};
const both = (): string => ['tame', 'workaround'].map((id) => `${id} ${goal(id).met(fresh) ? 'met' : 'open'}`).join(', ');
hear(start);
check('in the browser, from the island\'s tally at the start: neither goal met', !goal('tame').met(fresh) && !goal('workaround').met(fresh), both());
hear(afterTame);
check('after the tame: tamed, not yet working around', goal('tame').met(fresh) && !goal('workaround').met(fresh), both());
hear(beat ?? {});
check('from the beat after Work around me: both met', goal('tame').met(fresh) && goal('workaround').met(fresh), both());
(fresh as unknown as { checkJournal(): void }).checkJournal();
check('and the journal ticks both', fresh.ticked.has('tame') && fresh.ticked.has('workaround'), [...fresh.ticked].join(', '));

// Their words, read off the rules they name.
const tameLeast = Math.min(...Object.values(SPECIES).filter((d) => !d.monster).map((d) => d.tameLevel));
const tameEasy = Object.values(SPECIES).filter((d) => !d.monster && d.tameLevel === tameLeast);
const tameHow = goal('tame').how ?? '';
const named = tameEasy.filter((d) => tameHow.includes(`${d.name} (`));
check(`the taming how-to names the least Taming (${tameLeast}), how many kinds ask only that (${tameEasy.length}), some of them with their food, and Track`,
  tameHow.includes(`Taming ${tameLeast}: ${tameEasy.length} kinds`) && named.length >= 2
    && named.every((d) => d.diet.every((id) => tameHow.includes(itemDef(id).name.toLowerCase())))
    && tameHow.includes('Track') && tameHow.includes(`+${WILD_STAGE_TAME} Taming`),
  tameHow);
const aroundHow = goal('workaround').how ?? '';
const workRanges = Object.values(SPECIES).filter((d) => !d.monster && aroundTrade(d.gathers)).map((d) => d.workRange);
check(`the Work around me goal is the menu's label, and its how-to the reach to the one following you (${POST_FOLLOW_REACH}) and the storage range by kind`,
  goal('workaround').text === `Set a wildermon to ${AROUND_ACTION_BY_ID.get('work_around')?.label}`
    && aroundHow.includes(`within ${POST_FOLLOW_REACH} tiles`) && aroundHow.includes(`${AROUND_MOST} at a time`)
    && aroundHow.includes(`${Math.min(...workRanges)}–${Math.max(...workRanges)} tiles by kind`),
  `${goal('workaround').text}: ${aroundHow}`);

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nthe journal counts only your own work — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
