/**
 * The Path: steps from the runestone to a settlement at its last level (`src/game/path.ts`).
 *
 * Asked for: an optional, step-by-step tutorial whose steps the island confirms. This asks, of both sides:
 *
 *   * that the island's list of steps and detours is the browser's, and each step is met on the island's own state
 *     (`thepath_met`): not before the thing is done, and once it is -- the goes nothing else counts through the
 *     Path's own count round a go (`private.thepath_before`, `private.thepath_after`);
 *   * that a `path:` tick handed over with a beat is kept only when it is on the list and met, every other id as it
 *     always was, so a browser cannot tick a step by itself;
 *   * that the labels say the rules' numbers: the recipes' bills, the smelter's, the anvil mould's lumps, the deed's
 *     border and workers, the stones' gap, each kind's taming;
 *   * that turning the Path on notes its kinds in the field guide, which Track takes as if seen, and that a noted
 *     kind is not seen: not in the book's seen list, not in its counts, not in the journal's count of pages;
 *   * that the suggested sites each pass every founding check (`deed_site_refusal`, which founding asks) and their own
 *     criteria counted again tile by tile, are past the stones' gap, and are found inside a time budget on a 4096
 *     island;
 *   * that in every season every tame step has something its kind eats in season or a supply, on both sides; that
 *     a supply is sized to tame at `PATH_SURE` at the kind's own chance, issued, handed out once, and refused while
 *     anything it eats is in season;
 *   * and that turning the Path on and off and skipping a step are kept on the island.
 *
 * Runs against the database the suite leaves behind, in transactions that are rolled back.
 */
import { Game } from '../../src/game/game';
import { SPECIES } from '../../src/game/creatures';
import { DEED_STONE_GAP, deedRadiusAt, deedWorkersAt } from '../../src/game/deedsize';
import { RECIPE_BY_ID } from '../../src/game/recipes';
import { MOULDS } from '../../src/game/metal';
import { FIRE_COST } from '../../src/game/campfire';
import { guideCounts } from '../../src/game/guide';
import { trackRefusal } from '../../src/game/tracking';
import { SEASONS, type Season } from '../../src/world/calendar';
import {
  ANVIL_LUMPS, dietInSeason, needsSupply, PATH_DETOURS, PATH_FORAGE, PATH_KINDS, PATH_SITE, PATH_SKILLS, PATH_STEP_BY_ID, PATH_STEPS,
  PATH_SURE, PATH_TAMES, SMELTER_BRICKS, SMELTER_MORTAR, supplyItem, supplySize,
} from '../../src/game/path';
import { psql, check, finish } from './harness';

const U = '7e5b0000-0000-4000-8000-0000000000e1';
/** Where the steps are done: a site well past the stones' gap on a 1024 island, its ground laid out below. */
const SITE = { x: 300, y: 300 };
const NEAR_STONE = { x: 540.5, y: 700.5 };

/** Every id a step, and every detour, has: the order the island's list must have. */
const IDS = PATH_STEPS.map((s) => s.id);
const DETOURS = PATH_DETOURS.map((d) => d.id);

/*
 * The states each step is met by, set one after another on one body: each step is asked before its own state is
 * set (`B_<id>`) and after (`A_<id>`). Steps whose state is set by an earlier step's are asked only after.
 */
const SET: Record<string, string> = {
  cheese: `
    select id into v_item from item where world_id = w and holder = 'player' and holder_uid = u and def = 'cheese';
    perform private.act_go(w, u, 'eat', jsonb_build_object('kind', 'item', 'uid', v_item));`,
  forage: `
    for i in 1..${PATH_FORAGE} loop
      v_pre := private.thepath_before(w, u, 'forage', jsonb_build_object('kind', 'tile', 'x', ${SITE.x}, 'y', ${SITE.y}));
      insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, 'blueberry', 20, 1);
      perform private.thepath_after(w, u, 'forage', jsonb_build_object('kind', 'tile', 'x', ${SITE.x}, 'y', ${SITE.y}), v_pre);
    end loop;`,
  track: `
    v_pre := private.thepath_before(w, u, 'track', jsonb_build_object('kind', 'tile', 'species', 'bevere'));
    perform journal_note(w, u, 'tracked');
    perform private.thepath_after(w, u, 'track', jsonb_build_object('kind', 'tile', 'species', 'bevere'), v_pre);`,
  tame: `
    v_bevere := creature_spawn(w, 'bevere', ${SITE.x} + 0.5, ${SITE.y} + 1.5, 'active', now() - interval '60 days', u);
    perform guide_mark(w, u, 'bevere', 'tamed');`,
  around: `update creature set mode = 'deed', around = jsonb_build_object('was', 'follow') where world_id = w and id = v_bevere;`,
  tree: `perform journal_note(w, u, 'tree');`,
  shafts: `perform journal_note(w, u, 'made:shaft', 4);`,
  fish: `perform journal_note(w, u, 'fish:perch');`,
  cook: `perform journal_note(w, u, 'fire'); perform journal_note(w, u, 'made:cooked_fish');`,
  // Past the stones' gap, in the wood, where no token goes.
  walk: `update player set x = ${SITE.x - 8} + 0.5, y = ${SITE.y} + 0.5 where world_id = w and uid = u;`,
  site: `update player set x = ${SITE.x} + 0.5, y = ${SITE.y} + 0.5 where world_id = w and uid = u;`,
  found: `insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Pathfold', ${SITE.x}, ${SITE.y}, ${deedRadiusAt(1)}, 1, u);`,
  assign: `update creature set around = null where world_id = w and id = v_bevere;`,
  crate: `insert into crate (world_id, id, kind, x, y, sx, sy) values (w, 1, 'log', ${SITE.x} + 1, ${SITE.y}, 0, 0);`,
  campfire: `insert into placed (world_id, kind, x, y, sx, sy, cx, cy) values (w, 'campfire', ${SITE.x} - 1, ${SITE.y}, 0, 0, ${SITE.x} - 1, ${SITE.y});`,
  up2: `update deed set level = 2, radius = ${deedRadiusAt(2)} where world_id = w and founded_by = u;`,
  clay: `
    v_pre := private.thepath_before(w, u, 'dig', jsonb_build_object('kind', 'tile', 'x', ${SITE.x}, 'y', ${SITE.y}));
    insert into item (world_id, holder, holder_uid, def, ql, count) values (w, 'player', u, 'clay', 20, 1);
    perform private.thepath_after(w, u, 'dig', jsonb_build_object('kind', 'tile', 'x', ${SITE.x}, 'y', ${SITE.y}), v_pre);`,
  chiptail: `perform creature_spawn(w, 'quarra', ${SITE.x} + 2.5, ${SITE.y} + 2.5, 'deed', now() - interval '60 days', u);`,
  bricks: `perform journal_note(w, u, 'made:stone_brick', ${SMELTER_BRICKS()});`,
  mortar: `perform journal_note(w, u, 'made:mortar', ${SMELTER_MORTAR()});`,
  smelter: `insert into placed (world_id, kind, x, y, sx, sy, cx, cy) values (w, 'smelter', ${SITE.x} + 3, ${SITE.y} - 3, 0, 0, ${SITE.x} + 3, ${SITE.y} - 3);`,
  up3: `update deed set level = 3, radius = ${deedRadiusAt(3)} where world_id = w and founded_by = u;`,
  prospect: `
    v_pre := private.thepath_before(w, u, 'prospect', jsonb_build_object('kind', 'tile', 'x', ${SITE.x}, 'y', ${SITE.y}));
    update player set stats = stats || jsonb_build_object('prospected', jsonb_build_object('tiles', '[]'::jsonb, 'until', 1e12))
     where world_id = w and uid = u;
    perform private.thepath_after(w, u, 'prospect', jsonb_build_object('kind', 'tile', 'x', ${SITE.x}, 'y', ${SITE.y}), v_pre);`,
  ironemole: `perform creature_spawn(w, 'mola', ${SITE.x} - 2.5, ${SITE.y} + 2.5, 'deed', now() - interval '60 days', u);`,
  lumps: `insert into item (world_id, holder, holder_uid, def, ql, count, extra) values (w, 'player', u, 'copper_lump', 20, ${ANVIL_LUMPS}, 'Copper');`,
  anvil: `insert into placed (world_id, kind, x, y, sx, sy, cx, cy) values (w, 'anvil', ${SITE.x} - 3, ${SITE.y} - 3, 0, 0, ${SITE.x} - 3, ${SITE.y} - 3);`,
  up4: `update deed set level = 4, radius = ${deedRadiusAt(4)} where world_id = w and founded_by = u;`,
  snailglow: `perform creature_spawn(w, 'embra', ${SITE.x} + 4.5, ${SITE.y} + 4.5, 'deed', now() - interval '60 days', u);`,
  pack: `
    v_pre := private.thepath_before(w, u, 'pack', jsonb_build_object('kind', 'tile', 'x', ${SITE.x} + 2, 'y', ${SITE.y} + 2));
    perform land_set_tile(w, ${SITE.x} + 2, ${SITE.y} + 2, tile_id('Packed dirt'));
    perform private.thepath_after(w, u, 'pack', jsonb_build_object('kind', 'tile', 'x', ${SITE.x} + 2, 'y', ${SITE.y} + 2), v_pre);`,
  plan: `
    insert into building (world_id, id, name, levels) values (w, 1, 'Hut', 1);
    insert into building_tile (world_id, building, x, y) values (w, 1, ${SITE.x} - 4, ${SITE.y} + 4);`,
  walls: `
    insert into wall (world_id, level, dir, x, y, building, type, material, needed, total)
    select w, 0, b.dir, b.x, b.y, 1, 'solid', 'log', '{}'::jsonb, '{}'::jsonb from exterior_borders(w, 1) b;`,
  workers: '',
  up5: `update deed set level = 5, radius = ${deedRadiusAt(5)} where world_id = w and founded_by = u;`,
  chestkit: `perform creature_spawn(w, 'magga', ${SITE.x} - 4.5, ${SITE.y} - 4.5, 'deed', now() - interval '60 days', u);`,
};
/** Steps met by an earlier step's state, asked only after. */
const ALREADY = new Set(['workers']);

/* ---- on the island ----------------------------------------------------------------------------------------------- */

const out = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; v_item bigint; v_pre jsonb; v_bevere int; i int; j jsonb; v_t timestamptz;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Pathfold', 31, 1024, 540, 700, true) returning id into w;
  perform land_blank(w, 1024);
  -- The ground round the site: a wood to its west, the sea's edge to its south, a shelf of rock to its east.
  update land_tile set tiles = overlay(tiles placing decode(repeat('10', 6), 'hex') from ${SITE.x - 9} for 6)
   where world_id = w and y between ${SITE.y - 3} and ${SITE.y + 3};
  update land_corner set heights = overlay(heights placing decode(repeat('f6ff', 30), 'hex') from 2 * ${SITE.x - 15} + 1 for 60)
   where world_id = w and y = ${SITE.y + 12};
  update land_tile set tiles = overlay(tiles placing decode(repeat('04', 3), 'hex') from ${SITE.x + 16} for 3)
   where world_id = w and y between ${SITE.y - 1} and ${SITE.y + 1};
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Pathfinder');
  update player set body_at = now(), x = ${NEAR_STONE.x}, y = ${NEAR_STONE.y} where world_id = w and uid = u;

  -- The lists, as the island has them.
  insert into said values ('STEPS', array_to_string(thepath_steps(), ','));
  insert into said values ('DETOURS', array_to_string(thepath_detours(), ','));
  insert into said values ('TAMES', (select string_agg(step || ':' || species, ',') from thepath_tames()));
  insert into said values ('NEEDS', (select string_agg(k || ':' || thepath_need(k), ',') from unnest(array['forage','bricks','mortar','lumps','workers']) k));

  -- Off: nothing counted round a go, nothing noted.
  insert into said values ('OFF_BEFORE', coalesce(private.thepath_before(w, u, 'forage', '{}'::jsonb)::text, '-'));
  insert into said values ('OFF_TRACK', coalesce(track_refusal(w, u, 'track', '{"species":"bevere"}'), '-'));

  -- On: the kinds noted.
  j := rpc_thepath(w, true);
  insert into said values ('ON', (j->>'on'));
  insert into said values ('NOTED', (select string_agg(x, ',' order by x) from jsonb_array_elements_text(j->'noted') x));
  insert into said values ('NOTED_TRACK', coalesce(track_refusal(w, u, 'track', '{"species":"bevere"}'), '-'));
  insert into said values ('UNNOTED_TRACK', coalesce(track_refusal(w, u, 'track', '{"species":"woola"}'), '-'));
  insert into said values ('GUIDE', (rpc_guide(w))::text);
  insert into said values ('GUIDE_TALLY', coalesce((select tally->>'guide:seen' from player where world_id = w and uid = u), '-'));
  insert into said values ('ON_BEFORE', coalesce(private.thepath_before(w, u, 'forage', '{}'::jsonb)::text, '-'));
  insert into said values ('NOT_WATCHED', coalesce(private.thepath_before(w, u, 'cut_down', '{}'::jsonb)::text, '-'));

  -- Each step: not met before its state, met after.
${IDS.map((id) => `
  ${ALREADY.has(id) ? '' : `insert into said values ('B_${id}', thepath_met(w, u, '${id}')::text);`}
  ${SET[id] ?? ''}
  insert into said values ('A_${id}', thepath_met(w, u, '${id}')::text);`).join('')}
  insert into said values ('NEAR_STONE_GAP', (stone_gap_at(w, ${Math.floor(NEAR_STONE.x)}, ${Math.floor(NEAR_STONE.y)}))::text);
  insert into said values ('DID', (select (thepath->'did')::text from player where world_id = w and uid = u));
  -- The detours: not met, then each tamed.
${DETOURS.map((id) => `
  insert into said values ('DB_${id}', thepath_met(w, u, '${id}')::text);`).join('')}
${PATH_DETOURS.filter((d) => d.tame).map((d) => `
  perform guide_mark(w, u, '${d.tame}', 'tamed');`).join('')}
  perform journal_note(w, u, 'ore');
  update skill set value = 50 where world_id = w and uid = u and id = 'botanizing';
  insert into skill (world_id, uid, id, value) values (w, u, 'botanizing', 50) on conflict (world_id, uid, id) do update set value = 50;
${DETOURS.map((id) => `
  insert into said values ('DA_${id}', thepath_met(w, u, '${id}')::text);`).join('')}

  -- Ticks: a step met kept, one not on the list or not met dropped, a goal as it was.
  insert into said values ('TICKS', (thepath_ticks(w, u, '["tree", "path:cheese", "path:nope", "path:anything", "path:mine"]'::jsonb))::text);
  update player set thepath = thepath || '{"did": {}}'::jsonb where world_id = w and uid = u;
  insert into said values ('TICKS_UNMET', (thepath_ticks(w, u, '["path:cheese", "path:forage"]'::jsonb))::text);
  update player set ticked = '[]'::jsonb, tally_at = null, tally_seen = null where world_id = w and uid = u;
  perform rpc_settle(null, w, null, false, '["fell", "path:tree", "path:cheese", "path:made_up"]'::jsonb);
  insert into said values ('SETTLED', (select ticked::text from player where world_id = w and uid = u));
  insert into said values ('BEAT', coalesce((rpc_settle(null, w, null, true, null)->'thepath'->>'on'), '-'));

  -- Skip and back, kept on the island; a step that is not one refused.
  insert into said values ('SKIP', (rpc_thepath_skip(w, 'fish', true)->'skip')::text);
  insert into said values ('UNSKIP', (rpc_thepath_skip(w, 'fish', false)->'skip')::text);
  begin
    perform rpc_thepath_skip(w, 'nope', true);
    insert into said values ('SKIP_BAD', 'went through');
  exception when others then insert into said values ('SKIP_BAD', sqlerrm);
  end;
  -- Off, and the record stays.
  insert into said values ('OFF', (rpc_thepath(w, false)->>'on'));
  insert into said values ('OFF_KEEPS', (select (thepath->'skip')::text from player where world_id = w and uid = u));
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const isle = new Map(out.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const said = (k: string): string => isle.get(k) ?? '(not said)';

check('the island\'s steps are the browser\'s, in its order', said('STEPS') === IDS.join(','), said('STEPS'));
check('and its detours', said('DETOURS') === DETOURS.join(','), said('DETOURS'));
check('and its tame steps and their kinds', said('TAMES') === PATH_TAMES.map(([s, k]) => `${s}:${k}`).join(','), said('TAMES'));
check('the counts a step asks for are the rules\' on both sides',
  said('NEEDS') === `forage:${PATH_FORAGE},bricks:${SMELTER_BRICKS()},mortar:${SMELTER_MORTAR()},lumps:${ANVIL_LUMPS},workers:3`, said('NEEDS'));
check(`${PATH_STEPS.length} steps, ${PATH_DETOURS.length} detours, ${PATH_SKILLS.length} skills trained`, PATH_SKILLS.length === 15, PATH_SKILLS.join(','));

check('with the Path off, a go is not counted', said('OFF_BEFORE') === '-', said('OFF_BEFORE'));
check('and a kind not seen is not tracked', said('OFF_TRACK') === trackRefusal(SPECIES.bevere, new Set()), said('OFF_TRACK'));
check('on: kept on the island', said('ON') === 'true', said('ON'));
check(`on: the ${PATH_KINDS.length} kinds noted`, said('NOTED') === [...PATH_KINDS].sort().join(','), said('NOTED'));
check('a noted kind is tracked, on both sides', said('NOTED_TRACK') === '-' && trackRefusal(SPECIES.bevere, new Set(), new Set(['bevere'])) === null, said('NOTED_TRACK'));
check('a kind neither seen nor noted is not', said('UNNOTED_TRACK') === trackRefusal(SPECIES.woola, new Set(), new Set(PATH_KINDS)), said('UNNOTED_TRACK'));
{
  const guide = JSON.parse(said('GUIDE')) as { seen: string[]; noted: string[] };
  check('noted is not seen: the book says none seen, and the noted apart', guide.seen.length === 0 && guide.noted.length === PATH_KINDS.length, said('GUIDE'));
}
check('and the journal\'s count of pages seen does not move', said('GUIDE_TALLY') === '-', said('GUIDE_TALLY'));
{
  const g = Game.create(4040);
  g.guide.take({ seen: [], tamed: [], bred: [], noted: [...PATH_KINDS] });
  check('nor the field guide\'s counts in the browser', guideCounts(g.guide).seen === 0 && g.guide.noted.size === PATH_KINDS.length, `${guideCounts(g.guide).seen}`);
}
check('on: a go the Path counts is measured', said('ON_BEFORE') !== '-', said('ON_BEFORE'));
check('and one it does not count is not', said('NOT_WATCHED') === '-', said('NOT_WATCHED'));

for (const id of IDS) {
  if (ALREADY.has(id)) check(`${id}: met`, said(`A_${id}`) === 'true', said(`A_${id}`));
  else check(`${id}: not met before, met once its state is there`, said(`B_${id}`) === 'false' && said(`A_${id}`) === 'true', `${said(`B_${id}`)} → ${said(`A_${id}`)}`);
}
check(`the walk starts inside the stones' gap: ${DEED_STONE_GAP}`, Number(said('NEAR_STONE_GAP')) < DEED_STONE_GAP, said('NEAR_STONE_GAP'));
{
  const did = JSON.parse(said('DID')) as Record<string, number>;
  check('the goes counted round a go: ate cheese, forage, the track, clay, prospect, pack',
    did['ate:cheese'] === 1 && did.forage === PATH_FORAGE && did['track:bevere'] === 1 && did.clay === 1 && did.prospect === 1 && did.pack === 1, said('DID'));
}
for (const id of DETOURS) check(`detour ${id}: not met, then met`, said(`DB_${id}`) === 'false' && said(`DA_${id}`) === 'true', `${said(`DB_${id}`)} → ${said(`DA_${id}`)}`);

check('a beat\'s ticks: a step met kept, one not on the list dropped, a goal as it was',
  said('TICKS') === '["tree", "path:cheese", "path:mine"]', said('TICKS'));
check('and a step not met dropped', said('TICKS_UNMET') === '[]', said('TICKS_UNMET'));
{
  const kept = JSON.parse(said('SETTLED') || '[]') as string[];
  check('through rpc_settle: the goal and the met step kept, the made-up one not',
    kept.includes('fell') && kept.includes('path:tree') && !kept.includes('path:made_up') && !kept.includes('path:cheese'), said('SETTLED'));
}
check('a beat says the record', said('BEAT') === 'true', said('BEAT'));
check('a skip is kept, and taken back', said('SKIP') === '["fish"]' && said('UNSKIP') === '[]', `${said('SKIP')} ${said('UNSKIP')}`);
check('a step that is not one is refused', said('SKIP_BAD').includes('not a step of the Path'), said('SKIP_BAD'));
check('off: kept, and the rest of the record with it', said('OFF') === 'false' && said('OFF_KEEPS') === '[]', said('OFF'));

/* ---- the labels say the rules' numbers ------------------------------------------------------------------------- */

{
  const g = Game.create(4041);
  const label = (id: string): string => PATH_STEP_BY_ID.get(id)!.label(g);
  const shafts = RECIPE_BY_ID.get('make_shafts')!;
  check('shafts: the recipe\'s log and count, and the campfire\'s', label('shafts').includes(`${shafts.inputs[0].count ?? 1} log → ${shafts.count}`) && label('shafts').includes(`takes ${FIRE_COST}`), label('shafts'));
  const crate = RECIPE_BY_ID.get('make_log_crate')!;
  check('log crate: its bill', label('crate').includes(`${crate.inputs[0].count} logs`), label('crate'));
  const brick = RECIPE_BY_ID.get('make_stone_brick')!;
  check('stone bricks: the smelter\'s count, and the shards it takes', label('bricks').includes(`×${SMELTER_BRICKS()}`) && label('bricks').includes(`${Math.ceil(SMELTER_BRICKS() / (brick.count ?? 1))} × rock shards`), label('bricks'));
  const mortar = RECIPE_BY_ID.get('make_mortar')!;
  const mixes = Math.ceil(SMELTER_MORTAR() / (mortar.count ?? 1));
  check('mortar: the smelter\'s count, the clay and sand of its mixes', label('mortar').includes(`×${SMELTER_MORTAR()}`) && label('mortar').includes(`${mixes} × clay`) && label('mortar').includes(`${mixes} × sand`), label('mortar'));
  check('smelter: its bill', label('smelter').includes(`${SMELTER_BRICKS()} stone bricks, ${SMELTER_MORTAR()} mortar`), label('smelter'));
  const mould = MOULDS.find((m) => m.makes === 'anvil')!;
  check('anvil: the mould\'s sand and lumps', label('anvil').includes(`${mould.sand} sand`) && label('anvil').includes(`${mould.lumps} lumps`) && label('lumps').includes(`×${mould.lumps}`), label('anvil'));
  for (const lv of [2, 3, 4, 5]) check(`upgrade to ${lv}: its border and workers`, label(`up${lv}`) === `Upgrade → ${lv}: border ${deedRadiusAt(lv)}, workers ${deedWorkersAt(lv)}`, label(`up${lv}`));
  check('assign: the workers at level one', label('assign').includes(`(${deedWorkersAt(1)}/${deedWorkersAt(1)})`), label('assign'));
  check('a tame step: its kind\'s taming', label('tame').endsWith(`Taming ${SPECIES.bevere.tameLevel}`) && label('chestkit').includes(`(${deedWorkersAt(5)}/${deedWorkersAt(5)})`), label('chestkit'));
  g.player.x = NEAR_STONE.x;
  g.player.y = NEAR_STONE.y;
  check('the walk: a counter to the stones\' gap', /^Stone: \d+\/\d+ tiles$/.test(label('walk')) && label('walk').endsWith(`/${DEED_STONE_GAP} tiles`), label('walk'));
  check('the walk has a place to point at, and the site has one once there are sites',
    !!PATH_STEP_BY_ID.get('walk')!.where?.(g) && !PATH_STEP_BY_ID.get('site')!.where?.(g));
}

/* ---- supplies, every season ----------------------------------------------------------------------------------------- */

const seasonal = psql(`
begin;
${SEASONS.map((s) => `
select set_config('wildermon.season', '${s}', true);
select 'SEASON_${s}=' || string_agg(t.step || ':' || thepath_in_season(t.species)::text, ',' order by t.step) from thepath_tames() t;`).join('')}
select 'SIZES=' || string_agg(d.id || ':' || thepath_supply_size(d.tame_chance), ',' order by d.id) from species_def d where d.tame_chance > 0;
select 'FAV=' || string_agg(d.id || ':' || d.favourite, ',' order by d.id) from species_def d where d.id in (select species from thepath_tames());
rollback;`);
const sea = new Map(seasonal.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
const table: string[] = [];
for (const s of SEASONS) {
  const island = new Map((sea.get(`SEASON_${s}`) ?? '').split(',').map((x) => x.split(':') as [string, string]));
  for (const [step, kind] of PATH_TAMES) {
    const def = SPECIES[kind];
    const now = dietInSeason(def, s as Season);
    const supplied = needsSupply(def, s as Season);
    table.push(`${s} ${step}: ${supplied ? `supply ${supplyItem(def)} ×${supplySize(def)}` : now.join(', ')}`);
    check(`${s}, ${step}: in season on both sides, or a supply`, island.get(step) === String(!supplied) && (now.length > 0 || supplySize(def) > 0), `${island.get(step)} / ${now.join(' ')}`);
  }
}
console.log(table.join('\n'));
check('only the Chestkit wants a supply, and only in winter', SEASONS.every((s) => PATH_TAMES.every(([step, kind]) =>
  needsSupply(SPECIES[kind], s as Season) === (s === 'winter' && step === 'chestkit'))));
{
  const sizes = new Map((sea.get('SIZES') ?? '').split(',').map((x) => x.split(':') as [string, string]));
  const off = Object.values(SPECIES).filter((d) => d.tameChance > 0 && sizes.has(d.id) && sizes.get(d.id) !== String(supplySize(d)));
  check('every kind\'s supply is the same size on both sides', sizes.size > 0 && off.length === 0, off.map((d) => `${d.id} ${sizes.get(d.id)}/${supplySize(d)}`).join(' '));
  const fit = Object.values(SPECIES).filter((d) => d.tameChance > 0 && d.tameChance < 1).every((d) => {
    const n = supplySize(d);
    return (1 - d.tameChance) ** n <= 1 - PATH_SURE + 1e-9 && (n === 1 || (1 - d.tameChance) ** (n - 1) > 1 - PATH_SURE);
  });
  check(`a supply is the fewest offerings that tame at ${PATH_SURE} at the kind's own chance`, fit);
  const fav = new Map((sea.get('FAV') ?? '').split(',').map((x) => x.split(':') as [string, string]));
  check('a supply is the kind\'s favourite, the first of its diet, on both sides', PATH_TAMES.every(([, k]) => fav.get(k) === supplyItem(SPECIES[k])), sea.get('FAV'));
}

/* ---- a supply claimed, once ------------------------------------------------------------------------------------- */

const claim = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; j jsonb;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Supply', 32, 64, 20, 20, true) returning id into w;
  perform land_blank(w, 64);
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Supplied');
  perform rpc_thepath(w, true);
  perform set_config('wildermon.season', 'winter', true);
  begin
    perform rpc_thepath_supply(w, 'chestkit');
    insert into said values ('EARLY', 'went through');
  exception when others then insert into said values ('EARLY', sqlerrm);
  end;
  -- Every step before it passed: skipped.
  update player set thepath = thepath || jsonb_build_object('skip', to_jsonb((thepath_steps())[1:array_position(thepath_steps(), 'chestkit') - 1]))
   where world_id = w and uid = u;
  j := rpc_thepath_supply(w, 'chestkit');
  insert into said values ('SUPPLY', (j->'supply'->'chestkit')::text);
  insert into said values ('ITEM', (select def || '|' || count || '|' || issued from item where world_id = w and holder_uid = u and def = (select favourite from species_def where id = 'magga') and issued));
  begin
    perform rpc_thepath_supply(w, 'chestkit');
    insert into said values ('AGAIN', 'went through');
  exception when others then insert into said values ('AGAIN', sqlerrm);
  end;
  perform set_config('wildermon.season', 'summer', true);
  begin
    perform rpc_thepath_supply(w, 'tame');
    insert into said values ('INSEASON', 'went through');
  exception when others then insert into said values ('INSEASON', sqlerrm);
  end;
  begin
    perform rpc_thepath_supply(w, 'cheese');
    insert into said values ('NOTTAME', 'went through');
  exception when others then insert into said values ('NOTTAME', sqlerrm);
  end;
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const sup = new Map(claim.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
{
  const magga = SPECIES.magga;
  check('a supply before its step is open is refused', (sup.get('EARLY') ?? '').includes('not this step yet'), sup.get('EARLY'));
  check('the Chestkit\'s winter supply: its favourite, sized off its chance, the season written down',
    sup.get('SUPPLY') === JSON.stringify({ n: supplySize(magga), item: supplyItem(magga), season: 'winter' }).replace(/,/g, ', ').replace(/:/g, ': '), sup.get('SUPPLY'));
  check('handed out issued, in the pack', sup.get('ITEM') === `${supplyItem(magga)}|${supplySize(magga)}|true`, sup.get('ITEM'));
  check('a second claim is refused', (sup.get('AGAIN') ?? '').includes('already handed out'), sup.get('AGAIN'));
  check('a kind with something in season is refused', (sup.get('INSEASON') ?? '').includes('in season'), sup.get('INSEASON'));
  check('a step that tames nothing is a bad request', (sup.get('NOTTAME') ?? '').includes('not a tame step'), sup.get('NOTTAME'));
}

/* ---- suggested sites --------------------------------------------------------------------------------------------- */

/*
 * A 4096 island, the body past the stones' gap with a wood, water and rock about; the search timed, and each site
 * asked again tile by tile and by the founding rule. Then one where the only place that would do is inside the gap.
 */
const BIG = 4096;
const P = { x: 1400, y: 2600 };
const sites = psql(`
discard temp;
begin;
create temp table said (k text, v text);
do $t$
declare w uuid; u uuid := '${U}'; j jsonb; v_t timestamptz; s jsonb; v_ms double precision;
begin
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Sitefind', 33, ${BIG}, ${P.x}, ${P.y}, true) returning id into w;
  perform land_blank(w, ${BIG});
  -- Woods in stripes, a shore to the south, a shelf of rock to the east.
  update land_tile set tiles = overlay(tiles placing decode(repeat('10', 40), 'hex') from ${P.x - 30} for 40)
   where world_id = w and y between ${P.y - 30} and ${P.y + 30} and y % 3 = 0;
  update land_corner set heights = overlay(heights placing decode(repeat('f6ff', 120), 'hex') from 2 * ${P.x - 60} + 1 for 240)
   where world_id = w and y between ${P.y + 20} and ${P.y + 22};
  update land_tile set tiles = overlay(tiles placing decode(repeat('04', 10), 'hex') from ${P.x + 18} for 10)
   where world_id = w and y between ${P.y - 40} and ${P.y + 40};
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Sitefinder');
  update player set body_at = now(), x = ${P.x} + 0.5, y = ${P.y} + 0.5 where world_id = w and uid = u;
  -- A deed in the way of some of them.
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Neighbour', ${P.x - 20}, ${P.y - 20}, ${deedRadiusAt(1)}, 1, '7e5b0000-0000-4000-8000-0000000000e9');
  v_t := clock_timestamp();
  j := rpc_thepath_sites(w);
  v_ms := extract(epoch from clock_timestamp() - v_t) * 1000;
  insert into said values ('MS', round(v_ms)::text);
  insert into said values ('N', jsonb_array_length(j)::text);
  for s in select * from jsonb_array_elements(j) loop
    insert into said values ('SITE_' || (s->>'x') || '_' || (s->>'y'), concat_ws('|',
      coalesce(deed_site_refusal(w, (s->>'x')::int, (s->>'y')::int), 'ok'),
      stone_gap_at(w, (s->>'x')::int, (s->>'y')::int) >= deed_stone_gap(),
      -- Trees in the box, counted tile by tile, and the nearest water and rock by brute force.
      (select count(*) from generate_series((s->>'x')::int - thepath_site_tree_reach()::int, (s->>'x')::int + thepath_site_tree_reach()::int) x,
                            generate_series((s->>'y')::int - thepath_site_tree_reach()::int, (s->>'y')::int + thepath_site_tree_reach()::int) y
        where land_tile(w, x, y) = tile_id('Tree')) = (s->>'trees')::int,
      (select min(greatest(abs(x - (s->>'x')::int), abs(y - (s->>'y')::int)))
         from generate_series((s->>'x')::int - thepath_site_water()::int, (s->>'x')::int + thepath_site_water()::int) x,
              generate_series((s->>'y')::int - thepath_site_water()::int, (s->>'y')::int + thepath_site_water()::int) y
        where least(land_height(w, x, y), land_height(w, x + 1, y), land_height(w, x, y + 1), land_height(w, x + 1, y + 1)) < 0) = (s->>'water')::int,
      (select min(greatest(abs(x - (s->>'x')::int), abs(y - (s->>'y')::int)))
         from generate_series((s->>'x')::int - thepath_site_rock()::int, (s->>'x')::int + thepath_site_rock()::int) x,
              generate_series((s->>'y')::int - thepath_site_rock()::int, (s->>'y')::int + thepath_site_rock()::int) y
        where land_tile(w, x, y) = tile_id('Rock')) = (s->>'rock')::int,
      (s->>'trees')::int >= thepath_site_trees(),
      sqrt(power((s->>'x')::int - ${P.x}, 2) + power((s->>'y')::int - ${P.y}, 2)) <= thepath_site_reach() * sqrt(2)));
  end loop;
  insert into said values ('ORDER', (select bool_and(d1 <= d2)::text from (
    select power((e->>'x')::int - ${P.x}, 2) + power((e->>'y')::int - ${P.y}, 2) as d1,
           lead(power((e->>'x')::int - ${P.x}, 2) + power((e->>'y')::int - ${P.y}, 2)) over (order by o) as d2
      from jsonb_array_elements(j) with ordinality t(e, o)) z where d2 is not null));
  insert into said values ('APART', (select coalesce(bool_and(sqrt(power((a->>'x')::int - (b->>'x')::int, 2) + power((a->>'y')::int - (b->>'y')::int, 2)) >= thepath_site_apart()), true)::text
    from jsonb_array_elements(j) with ordinality ta(a, i), jsonb_array_elements(j) with ordinality tb(b, k) where i < k));
  -- And by the stones: nothing inside their gap, however good the ground.
  update player set x = 540.5, y = 700.5 where world_id = w and uid = u;
  insert into said values ('STONE_SITES', (select count(*) from jsonb_array_elements(rpc_thepath_sites(w)) e
    where stone_gap_at(w, (e->>'x')::int, (e->>'y')::int) < deed_stone_gap())::text);
end $t$;
select k || '=' || v from said order by k;
rollback;`);
const st = new Map(sites.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));
/** The budget a search may take on a 4096 island, in milliseconds. */
const BUDGET_MS = 400;
check(`${PATH_SITE.count} sites found`, st.get('N') === String(PATH_SITE.count), st.get('N'));
check(`the search takes under ${BUDGET_MS} ms on a ${BIG} island`, Number(st.get('MS')) < BUDGET_MS, `${st.get('MS')} ms`);
for (const [k, v] of st) {
  if (!k.startsWith('SITE_')) continue;
  check(`${k}: every founding check, past the gap, its numbers counted again, trees enough, in reach`, v === 'ok|t|t|t|t|t|t', v);
}
check('nearest first', st.get('ORDER') === 'true', st.get('ORDER'));
check(`no two within ${PATH_SITE.apart} tiles`, st.get('APART') === 'true', st.get('APART'));
check('none inside the stones\' gap', st.get('STONE_SITES') === '0', st.get('STONE_SITES'));

finish('the Path');
