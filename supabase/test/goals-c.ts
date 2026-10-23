/**
 * The journal's goals for the island, for fighting and faith, and for people
 * and trade (`src/game/journal-c.ts`), held to what the island counts.
 *
 * For every goal the thing is done on the island, in a rolled-back
 * transaction on an island of its own (1024 tiles a side, the least the
 * Runestones stand on), and the count it reads is read back off the doer's
 * tally -- and not off anybody else's. The browser's `met` then reads that
 * tally as the island hands it over (`Game.tally`): false before, true after.
 * A goal that wants a whole set (every stone, region, ore, relic) is read with
 * the set the island would count, each key checked to be one the island
 * writes.
 *
 * And the journal as a whole: every goal id unique, every goal's text, hint
 * and how-to free of a number typed out, and the island's numbers the
 * browser's (`snow_line`, `stone_visit`, the stones, the regions, the ores,
 * the relics, the class tiers, the spells).
 *
 * Runs against the database the suite leaves behind.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Game } from '../../src/game/game';
import { ALL_GOALS, JOURNAL } from '../../src/game/journal';
import { ISLAND_GOALS, TRADE_GOALS, WILDERMON_GOALS_C } from '../../src/game/journal-c';
import '../../src/game/recipes';
import { RELICS } from '../../src/game/archaeology';
import { SCHOOLS } from '../../src/game/arcane';
import { CLASS_TIER_AT } from '../../src/game/classes';
import { METALS } from '../../src/game/metal';
import { FAITH_SPELLS, SPELL_BAR } from '../../src/game/patrons';
import { RUNESTONES, STONE_VISIT } from '../../src/game/runestones';
import { CLASS_SPELLS } from '../../src/game/talents';
import { BANDS } from '../../src/world/atlas-world';
import { REGIONS } from '../../src/world/regions';

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

const MINE = [...ISLAND_GOALS, ...WILDERMON_GOALS_C, ...TRADE_GOALS];
const goal = (id: string) => {
  const g = MINE.find((x) => x.id === id);
  if (!g) throw new Error(`no goal ${id}`);
  return g;
};

/* ---- the journal as a whole ---------------------------------------------------- */

const ids = ALL_GOALS.map((g) => g.id);
const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
check(`every goal id is unique (${ids.length})`, twice.length === 0, twice.join(', '));
check('the island\'s goals are a chapter after the water, and people and trade one before a lifetime',
  JOURNAL.findIndex((c) => c.name === 'The island') === JOURNAL.findIndex((c) => c.name === 'The water') + 1
    && JOURNAL.findIndex((c) => c.name === 'People and trade') === JOURNAL.findIndex((c) => c.name === 'A lifetime') - 1
    && JOURNAL.find((c) => c.name === 'The wildermon')!.goals.slice(-WILDERMON_GOALS_C.length).every((g, i) => g === WILDERMON_GOALS_C[i]),
  JOURNAL.map((c) => c.name).join(' / '));
check('every goal here is in the journal', MINE.every((g) => ALL_GOALS.includes(g)));
const unfilled = MINE.filter((g) => /\{|undefined|NaN/.test(`${g.text} ${g.hint ?? ''} ${g.how ?? ''}`)).map((g) => g.id);
check('every line filled in', unfilled.length === 0, unfilled.join(', '));
// A number in a goal's words comes from the rule it names: none is typed out in the source (`benefit.ts`'s rule).
const src = readFileSync('src/game/journal-c.ts', 'utf8');
const typed = [...src.matchAll(/(?:text|hint|how): (['"`])((?:\\.|(?!\1).)*)\1/g)]
  .map((m) => m[2].replace(/\$\{[^}]*\}/g, '').replace(/\{recipe\.[\w.]+\}/g, ''))
  .filter((t) => /\d/.test(t));
check('no number typed out in a goal\'s text, hint or how-to', typed.length === 0, typed.join(' | '));
check('every goal here has a how-to', MINE.every((g) => (g.how ?? '').length >= 20), MINE.filter((g) => (g.how ?? '').length < 20).map((g) => g.id).join(', '));
console.log(MINE.map((g) => `  ${g.id}: ${g.text}${g.hint ? ` (${g.hint})` : ''}`).join('\n'));

/* ---- the island's numbers are the browser's ------------------------------------- */

const ORES = METALS.filter((m) => m.ore !== null).map((m) => m.ore as string);
const ARCANE = [...new Set(SCHOOLS.flatMap((s) => s.stones))];
const rules = psql(`
select 'SNOW=' || snow_line();
select 'VISIT=' || stone_visit();
select 'STONES=' || string_agg(id, ',' order by ord) from runestones();
select 'REGIONS=' || count(*) from generate_series(0, 254) r where region_middle(r) is not null;
select 'ORES=' || string_agg(distinct yields, ',') from rock_def where yields like '%\\_ore';
select 'RELICS=' || string_agg(result, ',' order by result) from relic_def;
select 'GEMS=' || string_agg(lower(name), ',' order by lower(name)) from gem_def;
select 'TIERS=' || string_agg(at::text, ',' order by tier) from class_tier;
select 'CLASS=' || string_agg(id, ',' order by id) from class_spell;
select 'FAITH=' || string_agg(id, ',' order by id) from faith_spell;`);
const rule = new Map(rules.split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const sorted = (xs: string[]): string => [...xs].sort().join(',');
check('the snow line is the browser\'s', rule.get('SNOW') === String(BANDS.snow), rule.get('SNOW'));
check('beside a stone is as near as the browser says', rule.get('VISIT') === String(STONE_VISIT), rule.get('VISIT'));
check('the stones are the browser\'s', rule.get('STONES') === RUNESTONES.map((s) => s.id).join(','), rule.get('STONES'));
check('as many regions', rule.get('REGIONS') === String(REGIONS.length), rule.get('REGIONS'));
check('every ore the browser names comes out of a seam on the island', ORES.every((o) => (rule.get('ORES') ?? '').split(',').includes(o)), rule.get('ORES'));
check('the relics restore into what the browser says', rule.get('RELICS') === sorted(RELICS.map((r) => r.result)), rule.get('RELICS'));
check('every stone a focus is cut from comes out of the rock', ARCANE.every((s) => (rule.get('GEMS') ?? '').split(',').includes(s)), rule.get('GEMS'));
check('the class tiers are the browser\'s', rule.get('TIERS') === CLASS_TIER_AT.join(','), rule.get('TIERS'));
check('the class spells are the browser\'s', rule.get('CLASS') === sorted(CLASS_SPELLS.map((s) => s.id)), '');
check('the faith spells are the browser\'s', rule.get('FAITH') === sorted(FAITH_SPELLS.map((s) => s.id)), '');

/* ---- the island ------------------------------------------------------------------ */

const N = 1024;
const ANNA = 'c0a15000-0000-4000-8000-0000000000a1';
const BRAN = 'c0a15000-0000-4000-8000-0000000000b2';
const CLASS_SLOT = SPELL_BAR.indexOf('class');
const migration = readFileSync('supabase/migrations/20261023071035_journal_the_island_fighting_and_trade.sql', 'utf8');
const backfill = migration.slice(migration.indexOf('-- Counted once now'), migration.indexOf('notify pgrst'));

const out = psql(`
discard temp;
begin;
select setseed(0.505) \\g /dev/null
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${ANNA}'; v uuid := '${BRAN}'; j jsonb; i int; s record; tx int; ty int;
        it bigint; it2 bigint; v_map bigint; v_g bigint; alt bigint; st bigint; mb bigint; c int; n bigint; v_rock int;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Goals C', 505, ${N}, 5, 5, true) returning id into w;
  perform land_blank(w, ${N});
  -- A little above the sea everywhere: dry ground, and high enough for a hoard to be buried in.
  update land_corner set heights = decode(repeat('0a00', ${N + 1}), 'hex') where world_id = w;
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  perform rpc_join(w, 'Bran');
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Anna');
  update player set tally = '{}'::jsonb, body_at = now(), swim_at = now(),
         stats = coalesce(stats, '{}'::jsonb) || jsonb_build_object('hunger', 1, 'thirst', 1, 'health', 1, 'stamina', 1)
   where world_id = w;
  insert into said values ('BEFORE', (select tally::text from player where world_id = w and uid = u));

  /* ---- where a walk ends: beside a Runestone, a region, not the water ---- */
  select * into s from runestone_centres(${N}) where id = 'crownstone';
  update player set x = s.x + 3.5, y = s.y + 0.5, moved_at = now() - interval '1 second' where world_id = w and uid = u;
  delete from caller where uid = u;
  perform rpc_move(w, s.x + 3.8, s.y + 0.5, 0);
  insert into said select 'WALK', tally::text from player where world_id = w and uid = u;
  insert into said values ('WALK_REGION', region_at(w, s.x + 3.8, s.y + 0.5)::text);
  -- Too far: nothing more.
  update player set x = s.x + 9.5, y = s.y + 0.5, moved_at = now() - interval '1 second' where world_id = w and uid = u;
  delete from caller where uid = u;
  update player set tally = tally - 'stone:crownstone' where world_id = w and uid = u;
  perform rpc_move(w, s.x + 9.8, s.y + 0.5, 0);
  insert into said select 'FAR', coalesce(tally->>'stone:crownstone', 'none') from player where world_id = w and uid = u;
  update player set tally = tally || '{"stone:crownstone": 1}' where world_id = w and uid = u;
  -- In the water nothing is counted: Bran wades at 20, 20.
  perform land_set_height(w, 20, 20, -50);
  update player set x = 20.3, y = 20.5, moved_at = now() - interval '1 second' where world_id = w and uid = v;
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  delete from caller where uid = v;
  perform rpc_move(w, 20.6, 20.5, 0);
  insert into said select 'WET', tally::text from player where world_id = w and uid = v;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);

  /* ---- above the snow line ---- */
  perform land_set_height(w, 30, 30, snow_line() + 5);
  perform land_set_height(w, 31, 30, snow_line() + 5);
  perform land_set_height(w, 30, 31, snow_line() + 5);
  perform land_set_height(w, 31, 31, snow_line() + 5);
  update player set x = 30.3, y = 30.5, moved_at = now() - interval '1 second' where world_id = w and uid = u;
  delete from caller where uid = u;
  perform rpc_move(w, 30.6, 30.5, 0);
  insert into said select 'SNOW', coalesce(tally->>'snowline', 'none') from player where world_id = w and uid = u;

  /* ---- a trail worn under your feet ---- */
  insert into tile_wear (world_id, x, y, wear) values (w, 41, 40, wear_trail()::int - 1);
  update player set x = 40.6, y = 40.5, moved_at = now() - interval '1 second' where world_id = w and uid = u;
  delete from caller where uid = u;
  perform rpc_move(w, 41.3, 40.5, 0);
  insert into said select 'TRAIL', coalesce(tally->>'trail', 'none') || '|' || (land_tile(w, 41, 40) = tile_id('Trail'))
    from player where world_id = w and uid = u;

  /* ---- by Telestone ---- */
  it := give(w, u, 'telestone', 1, 100);
  update player set x = 5.5, y = 5.5 where world_id = w and uid = u;
  j := jsonb_build_object('kind', 'item', 'uid', it, 'stone', 'sunreach');
  insert into said values ('TELE_ASK', coalesce(act_refusal(w, u, 'travel_runestone', j), 'none'));
  perform act_perform(w, u, 'travel_runestone', j);
  insert into said select 'TELE', coalesce(tally->>'telestone', 'none') || '|' || coalesce(tally->>'stone:sunreach', 'none')
    from player where world_id = w and uid = u;

  /* ---- a fragment out of the ground, and a relic restored ---- */
  insert into skill (world_id, uid, id, value) values (w, u, 'archaeology', 100), (w, u, 'restoration', 100), (w, u, 'mining', 100)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  perform give(w, u, 'trowel', 1, 100);
  i := 0;
  while coalesce((select (tally->>'fragment')::int from player where world_id = w and uid = u), 0) = 0 and i < 300 loop
    i := i + 1;
    perform perform_dig(w, u, 'investigate', jsonb_build_object('kind', 'tile', 'x', 50 + i % 20, 'y', 50 + i / 20));
  end loop;
  insert into said select 'FRAGMENT', coalesce(tally->>'fragment', 'none') || '|'
    || (select count(*) from item where world_id = w and holder_uid = u and def = 'fragment') from player where world_id = w and uid = u;
  delete from item where world_id = w and holder_uid = u and def = 'fragment';
  it := give(w, u, 'fragment', 1, 60, 'old pot 1/2');
  perform give(w, u, 'fragment', 1, 60, 'old pot 2/2');
  i := 0;
  while coalesce((select (tally->>'restored:ancient_pot')::int from player where world_id = w and uid = u), 0) = 0 and i < 30 loop
    i := i + 1;
    perform perform_dig(w, u, 'restore_relic', jsonb_build_object('kind', 'item', 'uid', it));
  end loop;
  insert into said select 'RESTORED', coalesce(tally->>'restored', 'none') || '|' || coalesce(tally->>'restored:ancient_pot', 'none')
    from player where world_id = w and uid = u;

  /* ---- ore by the ore, and a stone out of the rock ---- */
  select id into v_rock from rock_def where yields = 'copper_ore' order by id limit 1;
  perform land_set_tile(w, 60, 60, 4);
  perform land_set_rock(w, 60, 60, v_rock);
  perform give(w, u, 'pickaxe', 1, 100);
  update player set x = 59.5, y = 60.5 where world_id = w and uid = u;
  i := 0;
  while coalesce((select (tally->>'ore:copper_ore')::int from player where world_id = w and uid = u), 0) = 0 and i < 50 loop
    i := i + 1;
    perform perform_terrain(w, u, 'mine', jsonb_build_object('kind', 'tile', 'x', 60, 'y', 60, 'cx', 60, 'cy', 60));
  end loop;
  insert into said select 'ORE', coalesce(tally->>'ore', 'none') || '|' || coalesce(tally->>'ore:copper_ore', 'none')
    from player where world_id = w and uid = u;
  i := 0;
  while not exists (select 1 from player, jsonb_object_keys(tally) k where world_id = w and uid = u and k like 'gem:%') and i < 20000 loop
    i := i + 1;
    perform maybe_gem(w, u, 100, 100);
  end loop;
  insert into said select 'GEM', (select string_agg(k, ',') from jsonb_object_keys(tally) k where k like 'gem:%') || '|'
    || (select lower(extra) from item where world_id = w and holder_uid = u and def = 'gem' order by id desc limit 1)
    from player where world_id = w and uid = u;

  /* ---- a hoard off somebody else's map, and off your own ---- */
  v_map := bury_treasure(w, u, 10, 200, 200);
  insert into said select 'FINDER', (finder = u)::text from treasure where item_id = v_map;
  update item set holder_uid = v where id = v_map;
  perform perform_treasure(w, v, 'unearth', jsonb_build_object('kind', 'item', 'uid', v_map));
  insert into said select 'THEIRS', coalesce(tally->>'hoard', 'none') || '|' || coalesce(tally->>'hoard:theirs', 'none')
    from player where world_id = w and uid = v;
  v_map := bury_treasure(w, u, 10, 300, 300);
  perform perform_treasure(w, u, 'unearth', jsonb_build_object('kind', 'item', 'uid', v_map));
  insert into said select 'OWNMAP', coalesce(tally->>'hoard', 'none') || '|' || coalesce(tally->>'hoard:theirs', 'none')
    from player where world_id = w and uid = u;

  /* ---- a fighting trade, its last tier, and its spells ---- */
  delete from caller where uid = u;
  insert into said values ('TAKE', coalesce(rpc_take_class(w, 'blade')->>'why', 'took'));
  update player set class_level = 98.5 where world_id = w and uid = u;
  i := 0;
  while (select class_level from player where world_id = w and uid = u) < 99 and i < 200 loop
    i := i + 1;
    perform class_learn(w, u, 50);
  end loop;
  insert into said select 'TOP', class_level || '|' || coalesce(tally->>'fighter', 'none') || '|' || coalesce(tally->>'classtop', 'none')
    from player where world_id = w and uid = u;
  insert into player_node (world_id, uid, node) values (w, u, 'blade_second_breath') on conflict do nothing;
  perform spell_bar_put(w, u, ${CLASS_SLOT}, 'blade_second_breath');
  delete from caller where uid = u;
  j := rpc_cast_spell(w, ${CLASS_SLOT}, jsonb_build_object('kind', 'self'));
  insert into said select 'CLASSCAST', coalesce(j->>'cast', j->>'why') || '|' || coalesce(tally->>'cast:blade_second_breath', 'none')
    from player where world_id = w and uid = u;

  /* ---- a patron and a faith spell ---- */
  insert into skill (world_id, uid, id, value) values (w, u, faith_skill(), 25)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  delete from caller where uid = u;
  j := rpc_take_patron(w, 'blessing');
  insert into said values ('PATRON', coalesce(j->>'took', j->>'why'));
  update player set favour = 40, favour_at = now(), used_at = '{}'::jsonb, stats = jsonb_set(stats, '{health}', '0.5')
   where world_id = w and uid = u;
  delete from caller where uid = u;
  j := rpc_take_faith_spell(w, 'blessing_soothe');
  delete from caller where uid = u;
  j := rpc_cast_spell(w, ${SPELL_BAR.indexOf('faith')}, jsonb_build_object('kind', 'self'));
  insert into said select 'FAITHCAST', coalesce(j->>'cast', j->>'why') || '|' || coalesce(tally->>'cast:blessing_soothe', 'none')
    from player where world_id = w and uid = u;

  /* ---- a rare wildermon killed, and an ordinary one ---- */
  c := creature_spawn(w, 'rabba', 400.5, 400.5, 'wild', now() - interval '2 hours', null);
  update creature set rare = 'rare' where world_id = w and id = c;
  perform wound_beast(w, c, 1e9, null, null, u, null);
  c := creature_spawn(w, 'rabba', 402.5, 400.5, 'wild', now() - interval '2 hours', null);
  update creature set rare = null where world_id = w and id = c;
  perform wound_beast(w, c, 1e9, null, null, v, null);
  insert into said select 'KILL', coalesce(tally->>'slew:rabba', 'none') || '|' || coalesce(tally->>'slewrare', 'none')
    from player where world_id = w and uid = u;
  insert into said select 'KILL_PLAIN', coalesce(tally->>'slew:rabba', 'none') || '|' || coalesce(tally->>'slewrare', 'none')
    from player where world_id = w and uid = v;

  /* ---- a bleeding wound dressed and held; a closed one is not ---- */
  insert into skill (world_id, uid, id, value) values (w, u, 'first_aid', 100)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  i := 0;
  while coalesce((select (tally->>'staunched')::int from player where world_id = w and uid = u), 0) = 0 and i < 20 loop
    i := i + 1;
    update player set wounds = jsonb_build_array(jsonb_build_object('kind', 'cut', 'part', 'arms', 'severity', 0.3,
        'bleeding', true, 'infected', false, 'dressing', null, 'at', now())) where world_id = w and uid = u;
    perform give(w, u, 'bandage', 1, 100);
    perform perform_fight(w, u, 'bind_wound', jsonb_build_object('kind', 'self'));
  end loop;
  insert into said select 'STAUNCH', coalesce(tally->>'dressed', 'none') || '|' || coalesce(tally->>'staunched', 'none')
    from player where world_id = w and uid = u;
  update player set tally = tally - 'staunched' where world_id = w and uid = u;
  update player set wounds = jsonb_build_array(jsonb_build_object('kind', 'cut', 'part', 'arms', 'severity', 0.3,
      'bleeding', false, 'infected', false, 'dressing', null, 'at', now())) where world_id = w and uid = u;
  perform give(w, u, 'bandage', 1, 100);
  perform perform_fight(w, u, 'bind_wound', jsonb_build_object('kind', 'self'));
  insert into said select 'NOT_BLEEDING', coalesce(tally->>'staunched', 'none') from player where world_id = w and uid = u;

  /* ---- a rare thing at an altar ---- */
  update player set x = 500.5, y = 500.5 where world_id = w and uid = u;
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'altar', 501, 500, 0, 0, 501.5, 500.5, 50, u) returning id into alt;
  it := give(w, u, 'hatchet', 1, 40, null, 'rare');
  j := jsonb_build_object('kind', 'furniture', 'id', alt, 'itemUid', it);
  insert into said values ('SAC_ASK', coalesce(act_refusal(w, u, 'sacrifice', j), 'none'));
  perform act_perform(w, u, 'sacrifice', j);
  insert into said select 'SACRIFICE', coalesce(tally->>'sacrificed', 'none') from player where world_id = w and uid = u;

  /* ---- motes out of a swirl ---- */
  insert into mote_swirl (world_id, x, y, element, region) values (w, 501, 501, 'fire', region_of(501, 501));
  j := jsonb_build_object('kind', 'tile', 'x', 501, 'y', 501);
  insert into said values ('SWIRL_ASK', coalesce(swirl_refusal(w, u, 'collect_motes', j), 'none'));
  perform perform_swirl(w, u, 'collect_motes', j);
  insert into said select 'SWIRL', coalesce(tally->>'swirl', 'none') from player where world_id = w and uid = u;

  /* ---- people: a stall sale, an order brought, a letter, a citizenship, a bell, a leaderboard ---- */
  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'stall', 600, 600, 0, 0, 601, 601, 50, u) returning id into st;
  insert into item (world_id, holder, def, ql, count, placed, price) values (w, 'furniture', 'plank', 30, 1, st, 3) returning id into it;
  update player set x = 600.5, y = 601.5 where world_id = w and uid = v;
  perform give_coins(w, v, 50);
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  delete from caller where uid = v;
  j := rpc_buy(w, it);
  insert into said select 'BUY', coalesce(j->>'bought', j->>'why') || '|' || coalesce(tally->>'sold', 'none')
    || '|' || coalesce((select tally->>'sold' from player where world_id = w and uid = v), 'none')
    from player where world_id = w and uid = u;

  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, made_by)
    values (w, 'furniture', 'mailbox', 610, 610, 2, 2, 610.75, 610.75, u) returning id into mb;
  update player set x = 610.5, y = 611.5 where world_id = w and uid in (u, v);
  perform give_coins(w, u, 50);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  delete from caller where uid = u;
  j := rpc_order(w, 'iron_ore', 2, 3, 10);
  n := (j->>'order')::bigint;
  insert into said values ('ORDER', coalesce(j->>'why', 'up'));
  perform give(w, v, 'iron_ore', 2, 40);
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
  delete from caller where uid = v;
  j := rpc_order_fill(w, n, 1);
  insert into said select 'FILL', coalesce(j->>'why', 'brought') || '|' || coalesce(tally->>'filled', 'none')
    || '|' || coalesce((select tally->>'filled' from player where world_id = w and uid = u), 'none')
    from player where world_id = w and uid = v;

  delete from caller where uid = v;
  j := rpc_letter(w, u, 'A word.');
  insert into said select 'LETTER', coalesce(j->>'sent', j->>'why') || '|' || coalesce(tally->>'letter', 'none')
    || '|' || coalesce((select tally->>'letter' from player where world_id = w and uid = u), 'none')
    from player where world_id = w and uid = v;
  update player set tally = tally - 'letter' where world_id = w and uid = v;
  delete from caller where uid = v;
  j := rpc_letter(w, u, parcel_note());
  insert into said select 'PARCEL_NOTE', coalesce(j->>'why', 'sent') || '|' || coalesce(tally->>'letter', 'none')
    from player where world_id = w and uid = v;

  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Annastead', 700, 700, 5, 1, u);
  insert into deed_invite (world_id, founder, uid) values (w, u, v);
  delete from caller where uid = v;
  j := rpc_invite_answer(w, u, true);
  insert into said select 'CITIZEN', coalesce(j->>'why', 'moved in') || '|' || coalesce(tally->>'citizen', 'none')
    || '|' || coalesce((select tally->>'citizen' from player where world_id = w and uid = u), 'none')
    from player where world_id = w and uid = v;

  insert into placed (world_id, kind, sub, x, y, sx, sy, cx, cy, ql, made_by)
    values (w, 'furniture', 'bell', 701, 700, 0, 0, 701.5, 700.5, 50, u) returning id into it;
  update player set x = 700.5, y = 700.5 where world_id = w and uid = u;
  perform perform_last(w, u, 'ring_bell', jsonb_build_object('kind', 'furniture', 'id', it));
  insert into said select 'BELL', coalesce(tally->>'rang', 'none') from player where world_id = w and uid = u;

  insert into skill (world_id, uid, id, value) values (w, u, 'carpentry', 40)
    on conflict (world_id, uid, id) do update set value = excluded.value;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  delete from caller where uid = u;
  j := rpc_boards(w);
  insert into said select 'BOARD', (select count(*) from jsonb_array_elements(j->'skills'->'carpentry') e where (e->>'mine')::boolean)
    || '|' || coalesce(tally->>'board', 'none') from player where world_id = w and uid = u;

  /* ---- your own grave emptied ---- */
  perform give(w, u, 'plank', 2, 30);
  perform player_die(w, u);
  select id into v_g from placed where world_id = w and made_by = u and crumbles_at is not null;
  perform perform_holding(w, u, 'furniture_take_all', jsonb_build_object('kind', 'furniture', 'id', v_g));
  insert into said select 'GRAVE', coalesce(tally->>'grave', 'none') || '|'
    || (select count(*) from item where placed = v_g and holder = 'furniture') from player where world_id = w and uid = u;

  /* ---- and who already held them, counted once by the migration ---- */
  update player set tally = '{}'::jsonb where world_id = w and uid in (u, v);
  ${backfill}
  insert into said select 'BACKFILL_A', coalesce(tally->>'fighter', 'none') || '|' || coalesce(tally->>'classtop', 'none')
    || '|' || coalesce(tally->>'citizen', 'none') from player where world_id = w and uid = u;
  insert into said select 'BACKFILL_B', coalesce(tally->>'fighter', 'none') || '|' || coalesce(tally->>'classtop', 'none')
    || '|' || coalesce(tally->>'citizen', 'none') from player where world_id = w and uid = v;
end $t$;
select k || '=' || coalesce(v, 'NULL') from said;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const say = (k: string): string => isle.get(k) ?? '(missing)';
const parts = (k: string): string[] => say(k).split('|');

/* ---- what the island counted, and what the browser makes of it ------------------ */

const game = Game.create(4242);
game.tallyFromIsland = true;
const meets = (id: string, tally: Record<string, number>): boolean => {
  for (const k of Object.keys(game.tally)) delete game.tally[k];
  Object.assign(game.tally, tally);
  return goal(id).met(game);
};
/** A goal the island's count meets, and nothing short of it. */
const both = (id: string, what: string, counted: boolean, tally: Record<string, number>, detail: string): void => {
  check(`${id}: ${what}`, counted, detail);
  check(`${id}: met on the island's count, and not before`, meets(id, tally) && !meets(id, {}), JSON.stringify(tally));
};
const one = (k: string): Record<string, number> => ({ [k]: 1 });

check('a fresh body has counted nothing', say('BEFORE') === '{}', say('BEFORE'));
const walk = JSON.parse(say('WALK') === '(missing)' ? '{}' : say('WALK')) as Record<string, number>;
const region = say('WALK_REGION');
both('runestones', 'standing beside a Runestone counts that stone', walk['stone:crownstone'] === 1,
  Object.fromEntries(RUNESTONES.map((s) => [`stone:${s.id}`, 1])), say('WALK'));
check('runestones: four of five is not all', !meets('runestones', Object.fromEntries(RUNESTONES.slice(1).map((s) => [`stone:${s.id}`, 1]))));
check('runestones: further off than a Telestone sets you down counts nothing', say('FAR') === 'none', say('FAR'));
both('regions', 'dry ground of a region counts that region', walk[`region:${region}`] === 1 && Number(region) < REGIONS.length,
  Object.fromEntries(REGIONS.map((_, i) => [`region:${i}`, 1])), `${region} ${say('WALK')}`);
check('regions: and in the water nothing at all', !/region:|stone:|snowline/.test(say('WET')), say('WET'));
both('snowline', 'ground at the snow line counts', say('SNOW') === '1', one('snowline'), say('SNOW'));
check('snowline: ground below it does not', walk.snowline === undefined, say('WALK'));
both('trail', 'the step that wears a trail counts for the walker', parts('TRAIL')[0] === '1' && parts('TRAIL')[1] === 'true', one('trail'), say('TRAIL'));
check('telestone: the journey is allowed', say('TELE_ASK') === 'none', say('TELE_ASK'));
both('telestone', 'a journey counts, and the stone it went to', parts('TELE')[0] === '1' && parts('TELE')[1] === '1', one('telestone'), say('TELE'));
both('fragment', 'a fragment dug up counts', parts('FRAGMENT')[0] === '1' && parts('FRAGMENT')[1] === '1', one('fragment'), say('FRAGMENT'));
both('allrelics', 'a relic restored counts by what it restores into', parts('RESTORED')[0] === '1' && parts('RESTORED')[1] === '1',
  Object.fromEntries(RELICS.map((r) => [`restored:${r.result}`, 1])), say('RESTORED'));
check('allrelics: one short is not all', !meets('allrelics', Object.fromEntries(RELICS.slice(1).map((r) => [`restored:${r.result}`, 1]))));
both('allore', 'ore counts by the ore', Number(parts('ORE')[0]) >= 1 && Number(parts('ORE')[1]) >= 1,
  Object.fromEntries(ORES.map((o) => [`ore:${o}`, 1])), say('ORE'));
check('allore: copper alone is not every ore', !meets('allore', one('ore:copper_ore')));
const gemKey = parts('GEM')[0];
check('arcstone: a stone out of the rock counts by the stone', gemKey === `gem:${parts('GEM')[1]}`, say('GEM'));
check('arcstone: met on a focus stone the island counts, and not before', meets('arcstone', one(`gem:${ARCANE[0]}`)) && !meets('arcstone', {}));
check('arcstone: not on a stone no focus is cut from', !meets('arcstone', one('gem:amber')));
check('theirmap: a map remembers who found it', say('FINDER') === 'true', say('FINDER'));
both('theirmap', 'a hoard off a map somebody else found counts', parts('THEIRS')[0] === '1' && parts('THEIRS')[1] === '1', one('hoard:theirs'), say('THEIRS'));
check('theirmap: off your own map it does not', parts('OWNMAP')[0] === '1' && parts('OWNMAP')[1] === 'none', say('OWNMAP'));
check('fighter: a fighting trade is taken', say('TAKE') === 'took', say('TAKE'));
both('fighter', 'taking a fighting trade counts', parts('TOP')[1] === '1', one('fighter'), say('TOP'));
both('classtop', 'the last class tier opening counts', Number(parts('TOP')[0]) >= CLASS_TIER_AT[CLASS_TIER_AT.length - 1] && parts('TOP')[2] === '1',
  one('classtop'), say('TOP'));
const blade = CLASS_SPELLS.filter((s) => s.class === 'blade');
both('classcast', 'a class spell cast counts', parts('CLASSCAST')[0] === 'blade_second_breath' && parts('CLASSCAST')[1] === '1',
  Object.fromEntries(blade.slice(0, CLASS_TIER_AT.length).map((s) => [`cast:${s.id}`, 1])), say('CLASSCAST'));
check('classcast: one short is not enough', !meets('classcast', Object.fromEntries(blade.slice(0, CLASS_TIER_AT.length - 1).map((s) => [`cast:${s.id}`, 1]))));
check('classcast: spells of two trades are not one trade\'s', !meets('classcast', Object.fromEntries(
  [...blade.slice(0, CLASS_TIER_AT.length - 1), CLASS_SPELLS.find((s) => s.class !== 'blade')!].map((s) => [`cast:${s.id}`, 1]))));
check('patron: a patron is taken', say('PATRON') === 'blessing', say('PATRON'));
both('patron', 'a faith spell cast counts', parts('FAITHCAST')[0] === 'blessing_soothe' && parts('FAITHCAST')[1] === '1', one('cast:blessing_soothe'), say('FAITHCAST'));
check('patron: a path technique is not a faith spell', !meets('patron', one('cast:knowledge_insight')));
both('kills', 'a kill counts by its kind', parts('KILL')[0] === '1',
  { 'slew:rabba': 60, 'slew:goblin': 40 }, say('KILL'));
check('kills: one short is not enough', !meets('kills', { 'slew:rabba': 60, 'slew:goblin': 39 }));
both('rarekill', 'a rare wildermon killed counts', parts('KILL')[1] === '1', one('slewrare'), say('KILL'));
check('rarekill: an ordinary one does not', parts('KILL_PLAIN')[0] === '1' && parts('KILL_PLAIN')[1] === 'none', say('KILL_PLAIN'));
both('staunch', 'a bleeding wound dressed and held counts', parts('STAUNCH')[1] === '1', one('staunched'), say('STAUNCH'));
check('staunch: a wound not bleeding does not', say('NOT_BLEEDING') === 'none', say('NOT_BLEEDING'));
check('sacrifice: the sacrifice is allowed', say('SAC_ASK') === 'none', say('SAC_ASK'));
both('sacrifice', 'a rare thing given up counts', say('SACRIFICE') === '1', one('sacrificed'), say('SACRIFICE'));
check('swirl: the swirl is in reach', say('SWIRL_ASK') === 'none', say('SWIRL_ASK'));
both('swirl', 'motes collected count', say('SWIRL') === '1', one('swirl'), say('SWIRL'));
both('sold', 'a sale off your stall counts for its keeper, not the buyer', parts('BUY')[1] === '1' && parts('BUY')[2] === 'none', one('sold'), say('BUY'));
check('filled: the order is up', say('ORDER') === 'up', say('ORDER'));
both('filled', 'goods brought to somebody else\'s order count for the bringer', parts('FILL')[0] === 'brought' && parts('FILL')[1] === '1' && parts('FILL')[2] === 'none',
  one('filled'), say('FILL'));
both('letter', 'a letter sent counts for its writer', parts('LETTER')[1] === '1' && parts('LETTER')[2] === 'none', one('letter'), say('LETTER'));
check('letter: the line a parcel without a note travels with is not a letter', say('PARCEL_NOTE') === 'sent|none', say('PARCEL_NOTE'));
both('citizen', 'moving in counts for the citizen, not the founder', parts('CITIZEN')[0] === 'moved in' && parts('CITIZEN')[1] === '1' && parts('CITIZEN')[2] === 'none',
  one('citizen'), say('CITIZEN'));
both('bell', 'ringing a bell counts', say('BELL') === '1', one('rang'), say('BELL'));
both('board', 'a place of yours on a board counts as it is read', parts('BOARD')[0] === '1' && parts('BOARD')[1] === '1', one('board'), say('BOARD'));
both('grave', 'your own grave emptied counts', parts('GRAVE')[0] === '1' && parts('GRAVE')[1] === '0', one('grave'), say('GRAVE'));
check('backfill: a fighting trade at its last tier counts both, a founder no citizenship', say('BACKFILL_A') === '1|1|none', say('BACKFILL_A'));
check('backfill: a citizen of somebody else\'s settlement counts it', say('BACKFILL_B') === 'none|none|1', say('BACKFILL_B'));

// Every goal here has been held to the island above.
const held = new Set(ok.concat(bad).map((l) => l.slice(5).split(':')[0]));
const unheld = MINE.filter((g) => !held.has(g.id)).map((g) => g.id);
check('every goal here is held to the island', unheld.length === 0, unheld.join(', '));

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\nthe island, fighting and faith, people and trade — ${ok.length} of ${ok.length + bad.length}`);
if (bad.length) process.exit(1);
