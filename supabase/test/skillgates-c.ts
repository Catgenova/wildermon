/**
 * Skill gates, the third set: what is made, restored and built.
 *
 * Asked for: "Gate cooking recipes. Gate bauble and artifact restorations. Gating carpentry crafts, masonry crafts,
 * wall types based on carp/masonry levels. Gating formulas. Gating paving/floor types. Gating these tasks also for
 * wildermon that perform them equal to their own level. Make sure the approach is sensible and uniform." Decided: the
 * smelter at masonry 1, the wagon at carpentry 70, the caravel at carpentry 90; a wall needs its material's gate and its
 * type's; an item whose use is gated is unidentified under it. Asked of the island and the browser:
 *
 *   * the island's skill_gate is the browser's, row for row, and every recipe sits at the ladder step its difficulty
 *     gives (2 × (difficulty − 6), stepped down), but the three named and a Formula's scroll by what it goes on;
 *   * a sample of each family refused in the same words on both sides under its level, and past the gate at it: apple
 *     pie (cooking), the wagon (carpentry), the smelter at masonry 1, a long bow (bowyery), a bay window and a plank wall
 *     (carpentry), a marble wall (masonry), a spiral staircase, marble slabs and cobblestones (paving);
 *   * a Formula, a relic's fragment and a tarnished bauble unidentified under their gate, with what identifies them,
 *     and refused in their seen names when read or restored; named at the level;
 *   * workers at their own level in each gate's skill: a cook's recipes, a hod carrier's walls and floors, a restorer's
 *     relics; idle `gate` in the stores' words;
 *   * the Skills window: carpentry's and cooking's Unlocks, and each skill's next gate beside its level.
 *
 * The island half makes its own island and rolls it back.
 */
import { Game } from '../../src/game/game';
import { ACTION_BY_ID, type Target } from '../../src/game/actions';
import { RECIPE_BY_ID, RECIPES, recipeReason } from '../../src/game/recipes';
import { craftLevel, FORMULA_GATE, hodMay, recipeLevel, workerBuildOpen, workerRecipeOpen } from '../../src/game/craftgates';
import { idleSays } from '../../src/game/workerlog';
import { scrollOf } from '../../src/game/enchant';
import {
  gateOf, identifySaid, itemGateRefusal, nextUnlockBar, seenName, skillGateRefusal, SKILL_GATES, unlocksOf,
} from '../../src/game/skillgates';
import { TileType } from '../../src/world/tiles';
import type { Wall, FloorTile } from '../../src/game/building';
import { psql, check, finish } from './harness';

const U = '7e5b0000-0000-4000-8000-0000000c7e01';
const T = 40;
const SEED = 311;
const KINDS = ['recipe', 'relic', 'bauble', 'material', 'wall', 'floor', 'paving'];
const wallAt = { kind: 'tile', x: T + 2, y: T + 2, side: 'n' };
const target = (o: Record<string, unknown>): string => `'${JSON.stringify(o)}'::jsonb`;

/* ---- the island ----------------------------------------------------------- */

const isle = new Map(psql(`
discard temp;
begin;
create temp table said (k text, v text);
create function pg_temp.skill(w uuid, u uuid, id text, v real) returns void language sql as $s$
  insert into skill (world_id, uid, id, value) values (w, u, id, v)
    on conflict (world_id, uid, id) do update set value = excluded.value;
$s$;
create function pg_temp.worker(w uuid, u uuid, p_skills jsonb) returns creature language plpgsql as $m$
declare v int; c creature;
begin
  v := creature_spawn(w, 'magga', ${T}.5, ${T}.5, 'active', now() - interval '60 days', u);
  update creature set skills = p_skills where world_id = w and id = v returning * into c;
  return c;
end $m$;
do $t$
declare w uuid; u uuid := '${U}'; v_it item; v_id bigint; c creature;
begin
  insert into said select 'GATES', string_agg(kind || ':' || id || ':' || name || ':' || skill || ':' || level, ',' order by kind collate "C", id collate "C")
    from skill_gate where kind in (${KINDS.map((k) => `'${k}'`).join(', ')});
  insert into said select 'ITEMS', string_agg(item || ':' || extra || ':' || kind || ':' || id || ':' || noun, ',' order by item collate "C", extra collate "C")
    from skill_gate_item where kind in (${KINDS.map((k) => `'${k}'`).join(', ')});
  insert into world (name, seed, size, spawn_x, spawn_y, ready) values ('Gates C', ${SEED}, 120, ${T}, ${T}, true) returning id into w;
  perform land_blank(w, 120);
  perform land_set_tile(w, x, y, tile_id('Grass')) from generate_series(0, 119) x, generate_series(0, 119) y;
  perform land_set_height(w, x, y, 50) from generate_series(0, 120) x, generate_series(0, 120) y;
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
  perform rpc_join(w, 'Keeper');
  insert into deed (world_id, name, x, y, radius, level, founded_by) values (w, 'Gatestead', ${T}, ${T}, 15, 5, u);
  update player set x = ${T}.5, y = ${T + 1}.5, body_at = now(), seen_at = now(),
         stats = '{"health":1,"stamina":1,"hunger":1,"thirst":1}'::jsonb where world_id = w and uid = u;

  /* ---- recipes: one check, first ---- */
  perform pg_temp.skill(w, u, 'cooking', 19);
  insert into said values ('PIE19', coalesce(craft_refusal(w, u, 'make_apple_pie', null), 'ALLOWED'));
  perform pg_temp.skill(w, u, 'cooking', 20);
  insert into said values ('PIE20', coalesce(craft_refusal(w, u, 'make_apple_pie', null), 'ALLOWED'));
  perform pg_temp.skill(w, u, 'carpentry', 69);
  insert into said values ('WAGON69', coalesce(craft_refusal(w, u, 'make_wagon', null), 'ALLOWED'));
  perform pg_temp.skill(w, u, 'carpentry', 70);
  insert into said values ('WAGON70', coalesce(craft_refusal(w, u, 'make_wagon', null), 'ALLOWED'));
  perform pg_temp.skill(w, u, 'masonry', 1);
  insert into said values ('SMELTER1', coalesce(craft_refusal(w, u, 'make_smelter', null), 'ALLOWED'));
  perform pg_temp.skill(w, u, 'bowyery', 39.5);
  insert into said values ('LONGBOW', coalesce(craft_refusal(w, u, 'make_long_bow', null), 'ALLOWED'));

  /* ---- walls, floors and paving ---- */
  perform give(w, u, 'mallet', 1, 40, null);
  perform give(w, u, 'trowel', 1, 40, null);
  perform pg_temp.skill(w, u, 'carpentry', 5);
  insert into said values ('PLANK5', coalesce(build_refusal(w, u, 'plan_wall', ${target({ ...wallAt, wallType: 'solid', material: 'plank' })}), 'ALLOWED'));
  perform pg_temp.skill(w, u, 'carpentry', 10);
  insert into said values ('BAY10', coalesce(build_refusal(w, u, 'plan_wall', ${target({ ...wallAt, wallType: 'bay', material: 'plank' })}), 'ALLOWED'));
  insert into said values ('FENCE10', coalesce(build_refusal(w, u, 'plan_fence', ${target({ ...wallAt, wallType: 'iron_gate', material: 'log' })}), 'ALLOWED'));
  insert into said values ('SPIRAL10', coalesce(build_refusal(w, u, 'plan_floor', ${target({ kind: 'tile', x: T + 2, y: T + 2, floorKind: 'stairs', hand: 's', material: 'plank' })}), 'ALLOWED'));
  perform pg_temp.skill(w, u, 'masonry', 40);
  insert into said values ('MARBLE40', coalesce(build_refusal(w, u, 'plan_wall', ${target({ ...wallAt, wallType: 'solid', material: 'marble' })}), 'ALLOWED'));
  insert into said values ('PORT40', coalesce(build_gate_refusal(w, u, 'stone_brick', 'portcullis', null, null), 'ALLOWED'));
  perform land_set_tile(w, ${T + 3}, ${T + 1}, 2);
  update player set x = ${T + 3}.5, y = ${T + 1}.5 where world_id = w and uid = u;
  perform give(w, u, 'marble_slab', 1, 40, null);
  perform give(w, u, 'stone_brick', 1, 40, null);
  perform pg_temp.skill(w, u, 'paving', 30);
  insert into said values ('SLAB30', coalesce(ground_refusal(w, u, 'pave_slabs', ${target({ kind: 'tile', x: T + 3, y: T + 1 })}), 'ALLOWED'));
  perform pg_temp.skill(w, u, 'paving', 50);
  insert into said values ('SLAB50', coalesce(ground_refusal(w, u, 'pave_slabs', ${target({ kind: 'tile', x: T + 3, y: T + 1 })}), 'ALLOWED'));
  perform pg_temp.skill(w, u, 'paving', 1);
  insert into said values ('COBBLE1', coalesce(terrain_refusal(w, u, 'pave_cobble', ${target({ kind: 'tile', x: T + 3, y: T + 1 })}), 'ALLOWED'));

  /* ---- a Formula, a fragment, a tarnished bauble ---- */
  perform give(w, u, 'brush', 1, 40, null);
  v_id := give(w, u, 'enchant_formula', 1, 30, 'Emberbrand scroll');
  select * into v_it from item where id = v_id;
  perform pg_temp.skill(w, u, 'enchanting', 10);
  insert into said values ('F10_NAME', seen_name(w, u, v_it));
  insert into said values ('F10_TIP', coalesce(identify_said(w, u, v_it.def, v_it.extra), 'none'));
  insert into said values ('F10_READ', coalesce(relic_use_refusal(w, u, 'read_formula', jsonb_build_object('kind', 'item', 'uid', v_id)), 'ALLOWED'));
  perform pg_temp.skill(w, u, 'enchanting', 20);
  insert into said values ('F20_NAME', seen_name(w, u, v_it));
  insert into said values ('F20_READ', coalesce(relic_use_refusal(w, u, 'read_formula', jsonb_build_object('kind', 'item', 'uid', v_id)), 'ALLOWED'));
  v_id := give(w, u, 'fragment', 1, 30, 'old lamp 1/3');
  select * into v_it from item where id = v_id;
  perform pg_temp.skill(w, u, 'restoration', 30);
  insert into said values ('R30_NAME', seen_name(w, u, v_it));
  insert into said values ('R30_TIP', coalesce(identify_said(w, u, v_it.def, v_it.extra), 'none'));
  insert into said values ('R30_RESTORE', coalesce(dig_refusal(w, u, 'restore_relic', jsonb_build_object('kind', 'item', 'uid', v_id)), 'ALLOWED'));
  perform pg_temp.skill(w, u, 'restoration', 40);
  insert into said values ('R40_NAME', seen_name(w, u, v_it));
  insert into said values ('R40_RESTORE', coalesce(dig_refusal(w, u, 'restore_relic', jsonb_build_object('kind', 'item', 'uid', v_id)), 'ALLOWED'));
  v_id := give(w, u, 'tarnished_bauble', 1, 30, 'major');
  select * into v_it from item where id = v_id;
  perform pg_temp.skill(w, u, 'restoration', 10);
  insert into said values ('B10_NAME', seen_name(w, u, v_it));
  insert into said values ('B10_RESTORE', coalesce(dig_refusal(w, u, 'restore_relic', jsonb_build_object('kind', 'item', 'uid', v_id)), 'ALLOWED'));
  perform pg_temp.skill(w, u, 'restoration', 40);
  insert into said values ('B40_RESTORE', coalesce(dig_refusal(w, u, 'restore_relic', jsonb_build_object('kind', 'item', 'uid', v_id)), 'ALLOWED'));

  /* ---- workers at their own level ---- */
  c := pg_temp.worker(w, u, '{"cooking": 1}');
  insert into said values ('COOK1', array_to_string(worker_recipes(c, array['bake_potato', 'bake_bread', 'make_apple_pie']), ','));
  c := pg_temp.worker(w, u, '{"cooking": 20}');
  insert into said values ('COOK20', array_to_string(worker_recipes(c, array['bake_potato', 'bake_bread', 'make_apple_pie']), ','));
  c := pg_temp.worker(w, u, '{"masonry": 30, "carpentry": 1}');
  insert into said values ('HOD', worker_build_open(c, 'plank', 'solid', null, null) || ',' || worker_build_open(c, 'log', 'solid', null, null)
    || ',' || worker_build_open(c, 'log', 'door', null, null) || ',' || worker_build_open(c, 'sandstone', 'door', null, null)
    || ',' || worker_build_open(c, 'marble', 'solid', null, null) || ',' || worker_build_open(c, 'stone_brick', null, 'stairs', 's'));
  insert into said values ('HOD_WALL', hod_may(w, c, 'wall', 0, 'h', ${T}, ${T}) || '');
  insert into wall (world_id, level, dir, x, y, building, type, material, needed, total)
    values (w, 0, 'h', ${T}, ${T}, 0, 'solid', 'plank', '{"plank": 24}', '{"plank": 24}');
  insert into said values ('HOD_PLANK', hod_may(w, c, 'wall', 0, 'h', ${T}, ${T}) || '');
  update wall set material = 'log' where world_id = w and x = ${T} and y = ${T};
  insert into said values ('HOD_LOG', hod_may(w, c, 'wall', 0, 'h', ${T}, ${T}) || '');
end $t$;
select k || '=' || coalesce(v, '') from said;
rollback;
`).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as [string, string]));

const said = (k: string): string => isle.get(k) ?? '';

/* ---- the table ------------------------------------------------------------ */

{
  const mine = SKILL_GATES.filter((g) => KINDS.includes(g.kind))
    .sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((g) => `${g.kind}:${g.id}:${g.name}:${g.skill}:${g.level}`);
  check(`the island's skill_gate is the browser's for recipes, relics, baubles, materials, wall, floor and paving types (${mine.length} rows)`,
    said('GATES') === mine.join(','), `island ${said('GATES').slice(0, 300)} / browser ${mine.join(',').slice(0, 300)}`);
  check('and the items each stops the use of: every Recipe and Formula, every relic\'s fragments, every tier of tarnished bauble',
    said('ITEMS').split(',').length > 50 && said('ITEMS').includes('enchant_formula:emberbrand scroll:recipe:make_emberbrand_scroll:formula')
      && said('ITEMS').includes('fragment:old lamp:relic:old lamp:fragment') && said('ITEMS').includes('tarnished_bauble:major:bauble:major:bauble'),
    said('ITEMS').slice(0, 300));
  const steps: Array<[number | undefined, number]> = [[undefined, 1], [6, 1], [8, 1], [10, 5], [12, 10], [14, 10], [16, 20], [20, 20], [22, 30], [26, 40], [30, 40], [32, 50], [36, 60], [42, 70], [46, 80], [51, 90], [60, 90]];
  check('a recipe\'s level: the ladder step at or below 2 × (difficulty − 6), 1 for none',
    steps.every(([d, lv]) => craftLevel(d) === lv), steps.map(([d]) => `${d}:${craftLevel(d)}`).join(' '));
  const off = RECIPES.filter((r) => !['smelter', 'wagon', 'caravel'].includes(r.result) && !scrollOf(r.result) && gateOf('recipe', r.id)?.level !== craftLevel(r.difficulty));
  check(`every one of the ${RECIPES.length} recipes at that step in its own skill, but the named and the scrolls`,
    !off.length && RECIPES.every((r) => gateOf('recipe', r.id)?.skill === r.skill), off.map((r) => r.id).join(', '));
  check('the smelter at masonry 1, the wagon at carpentry 70, the caravel at carpentry 90, as decided',
    gateOf('recipe', 'make_smelter')?.level === 1 && gateOf('recipe', 'make_smelter')?.skill === 'masonry'
      && gateOf('recipe', 'make_wagon')?.level === 70 && gateOf('recipe', 'make_caravel')?.level === 90 && gateOf('recipe', 'make_caravel')?.skill === 'carpentry');
  check('a Formula\'s scroll by what it goes on: Emberbrand (a weapon) 20, Featherstep (boots) 30, Fair Wind (a ship) 40, Leeching (two elements) 50',
    recipeLevel(RECIPE_BY_ID.get('make_emberbrand_scroll')!) === FORMULA_GATE.melee && gateOf('recipe', 'make_emberbrand_scroll')?.level === 20
      && gateOf('recipe', 'make_featherstep_scroll')?.level === 30 && gateOf('recipe', 'make_fair_wind_scroll')?.level === 40
      && gateOf('recipe', 'make_leeching_scroll')?.level === 50);
  check('cooking by difficulty: baked potato 1, bread 5, cheese 10, apple pie 20, cottage pie 30',
    ['bake_potato:1', 'bake_bread:5', 'make_cheese:10', 'make_apple_pie:20', 'make_cottage_pie:30'].every((s) => { const [id, lv] = s.split(':'); return gateOf('recipe', id)?.level === Number(lv); }));
  check('relics and baubles by their restoring difficulty: old pot 10, old lamp 40, ancient helm 70; minor 10, major 40, ancient 70',
    gateOf('relic', 'old pot')?.level === 10 && gateOf('relic', 'old lamp')?.level === 40 && gateOf('relic', 'ancient helm')?.level === 70
      && gateOf('bauble', 'minor')?.level === 10 && gateOf('bauble', 'major')?.level === 40 && gateOf('bauble', 'ancient')?.level === 70);
  check('a wall type in each building skill, a stone-only one in masonry only',
    gateOf('wall', 'carpentry:door')?.level === 5 && gateOf('wall', 'masonry:door')?.level === 5 && !gateOf('wall', 'carpentry:portcullis')
      && gateOf('wall', 'masonry:portcullis')?.level === 50 && !gateOf('wall', 'carpentry:rune_gate'));
}

/* ---- the browser's ground ------------------------------------------------- */

const fresh = (): Game => {
  const g = Game.create(SEED, 120);
  const w = g.world;
  w.water = null;
  w.heights.fill(50);
  w.tiles.fill(TileType.Grass);
  w.data.fill(0);
  for (const c of [...g.creatures.list.values()]) g.creatures.remove(c.id);
  g.deed = { name: 'Gatestead', x: T, y: T, radius: 15, level: 5 } as typeof g.deed;
  g.player.x = T + 0.5;
  g.player.y = T + 1.5;
  return g;
};
const ask = (g: Game, id: string, t: Target): string => ACTION_BY_ID.get(id)?.check?.(t, g) ?? 'ALLOWED';
const set = (g: Game, skill: string, v: number): void => { g.skills.values.set(skill, v); };
const isGate = (s: string): boolean => /: needs [a-z ]+ \d+; have \d+\.\d\.$/.test(s);

/* ---- recipes ------------------------------------------------------------------ */

{
  const g = fresh();
  const reason = (id: string): string => recipeReason(RECIPE_BY_ID.get(id)!, g) ?? 'ALLOWED';
  set(g, 'cooking', 19);
  const pie = skillGateRefusal('Apple pie', 'cooking', 19, 20)!;
  const p19 = reason('make_apple_pie');
  check(`apple pie at cooking 19: "${pie}", the crafting window's and the island's words`, p19 === pie && said('PIE19') === pie, `island "${said('PIE19')}" / browser "${p19}"`);
  set(g, 'cooking', 20);
  const p20 = reason('make_apple_pie');
  check('and at 20 past the gate on both sides (to what it is short of)', !isGate(p20) && !isGate(said('PIE20')), `island "${said('PIE20')}" / browser "${p20}"`);
  set(g, 'carpentry', 69);
  const wagon = 'Wagon: needs carpentry 70; have 69.0.';
  const w69 = reason('make_wagon');
  check(`the wagon at carpentry 69: "${wagon}" on both sides; at 70, past it`,
    w69 === wagon && said('WAGON69') === wagon && !isGate(said('WAGON70')), `island "${said('WAGON69')}" "${said('WAGON70')}" / browser "${w69}"`);
  set(g, 'masonry', 1);
  const s1 = reason('make_smelter');
  check('the smelter at masonry 1: past the gate on both sides', !isGate(s1) && !isGate(said('SMELTER1')), `island "${said('SMELTER1')}" / browser "${s1}"`);
  set(g, 'bowyery', 39.5);
  const bow = reason('make_long_bow');
  check(`a long bow at bowyery 39.5: "${bow}", the same on both sides`, bow === 'Long bow: needs bowyery 40; have 39.5.' && said('LONGBOW') === bow, `island "${said('LONGBOW')}"`);
}

/* ---- walls, floors, paving ------------------------------------------------------ */

{
  const g = fresh();
  g.inventory.add('mallet', { ql: 40 });
  g.inventory.add('trowel', { ql: 40 });
  set(g, 'carpentry', 5);
  const plank = 'Plank building: needs carpentry 10; have 5.0.';
  const b5 = ask(g, 'plan_wall', { ...wallAt, wallType: 'solid', material: 'plank' } as Target);
  check(`a plank wall at carpentry 5: "${plank}", on both sides`, b5 === plank && said('PLANK5') === plank, `island "${said('PLANK5')}" / browser "${b5}"`);
  set(g, 'carpentry', 10);
  const bay = 'Bay window: needs carpentry 20; have 10.0.';
  const b10 = ask(g, 'plan_wall', { ...wallAt, wallType: 'bay', material: 'plank' } as Target);
  check(`a plank bay window at carpentry 10: the material met, the type "${bay}", on both sides`, b10 === bay && said('BAY10') === bay, `island "${said('BAY10')}" / browser "${b10}"`);
  const iron = 'Iron-bound gate: needs carpentry 30; have 10.0.';
  const f10 = ask(g, 'plan_fence', { ...wallAt, wallType: 'iron_gate', material: 'log' } as Target);
  check(`a log iron-bound gate standing alone at carpentry 10: "${iron}", on both sides`, f10 === iron && said('FENCE10') === iron, `island "${said('FENCE10')}" / browser "${f10}"`);
  const spiral = 'Spiral staircase: needs carpentry 20; have 10.0.';
  const s10 = ask(g, 'plan_floor', { kind: 'tile', x: T + 2, y: T + 2, floorKind: 'stairs', hand: 's', material: 'plank' } as Target);
  check(`a plank spiral staircase at carpentry 10: "${spiral}", on both sides`, s10 === spiral && said('SPIRAL10') === spiral, `island "${said('SPIRAL10')}" / browser "${s10}"`);
  set(g, 'masonry', 40);
  const marble = 'Marble building: needs masonry 50; have 40.0.';
  const m40 = ask(g, 'plan_wall', { ...wallAt, wallType: 'solid', material: 'marble' } as Target);
  check(`a marble wall at masonry 40: "${marble}", on both sides`, m40 === marble && said('MARBLE40') === marble, `island "${said('MARBLE40')}" / browser "${m40}"`);
  check('a stone brick portcullis at masonry 40: the material met, "Portcullis: needs masonry 50; have 40.0."', said('PORT40') === 'Portcullis: needs masonry 50; have 40.0.', said('PORT40'));
  g.world.setTile(T + 3, T + 1, TileType.PackedDirt);
  g.player.x = T + 3.5;
  g.player.y = T + 1.5;
  g.inventory.add('marble_slab', { ql: 40 });
  g.inventory.add('stone_brick', { ql: 40 });
  const tile = { kind: 'tile', x: T + 3, y: T + 1 } as Target;
  set(g, 'paving', 30);
  const slab = 'Marble slabs: needs paving 50; have 30.0.';
  const p30 = ask(g, 'pave_slabs', tile);
  set(g, 'paving', 50);
  const p50 = ask(g, 'pave_slabs', tile);
  check(`marble slabs at paving 30: "${slab}"; at 50, allowed; on both sides`,
    p30 === slab && said('SLAB30') === slab && p50 === 'ALLOWED' && said('SLAB50') === 'ALLOWED', `island "${said('SLAB30')}" ${said('SLAB50')} / browser "${p30}" ${p50}`);
  set(g, 'paving', 1);
  const cobble = 'Cobblestones: needs paving 5; have 1.0.';
  const c1 = ask(g, 'pave_cobble', tile);
  check(`cobblestones at paving 1: "${cobble}", on both sides`, c1 === cobble && said('COBBLE1') === cobble, `island "${said('COBBLE1')}" / browser "${c1}"`);
}

/* ---- a Formula, a fragment, a tarnished bauble ------------------------------------ */

{
  const g = fresh();
  g.inventory.add('brush', { ql: 40 });
  const formula = g.inventory.add('enchant_formula', { ql: 30, extra: 'Emberbrand scroll' });
  set(g, 'enchanting', 10);
  const tip = '20 enchanting required to identify this formula.';
  const read = 'Unidentified formula: needs enchanting 20; have 10.0.';
  const r10 = ask(g, 'read_formula', { kind: 'item', uid: formula.uid } as Target);
  check(`a Formula for Emberbrand at enchanting 10: "Unidentified formula", "${tip}", and not read ("${read}"), on both sides`,
    seenName(formula, g) === 'Unidentified formula' && said('F10_NAME') === 'Unidentified formula' && identifySaid(formula, g) === tip
      && said('F10_TIP') === tip && r10 === read && said('F10_READ') === read && itemGateRefusal(formula, g) === read,
    `island ${said('F10_NAME')} "${said('F10_TIP')}" "${said('F10_READ')}" / browser ${seenName(formula, g)} "${identifySaid(formula, g)}" "${r10}"`);
  set(g, 'enchanting', 20);
  const r20 = ask(g, 'read_formula', { kind: 'item', uid: formula.uid } as Target);
  check('at 20, named and read, on both sides', seenName(formula, g) === said('F20_NAME') && said('F20_NAME') !== 'Unidentified formula'
    && r20 === 'ALLOWED' && said('F20_READ') === 'ALLOWED', `island ${said('F20_NAME')} ${said('F20_READ')} / browser ${seenName(formula, g)} ${r20}`);

  const piece = g.inventory.add('fragment', { ql: 30, extra: 'old lamp 1/3' });
  set(g, 'restoration', 30);
  const ptip = '40 restoration required to identify this fragment.';
  const pno = 'Unidentified fragment: needs restoration 40; have 30.0.';
  const rr = ask(g, 'restore_relic', { kind: 'item', uid: piece.uid } as Target);
  check(`an old lamp fragment at restoration 30: "Unidentified fragment", "${ptip}", Restore "${pno}", on both sides`,
    seenName(piece, g) === 'Unidentified fragment' && said('R30_NAME') === 'Unidentified fragment' && identifySaid(piece, g) === ptip
      && said('R30_TIP') === ptip && rr === pno && said('R30_RESTORE') === pno,
    `island ${said('R30_NAME')} "${said('R30_TIP')}" "${said('R30_RESTORE')}" / browser ${seenName(piece, g)} "${identifySaid(piece, g)}" "${rr}"`);
  set(g, 'restoration', 40);
  const r40 = ask(g, 'restore_relic', { kind: 'item', uid: piece.uid } as Target);
  check('at 40, named, and Restore asks for the missing pieces, on both sides', seenName(piece, g) === said('R40_NAME') && !said('R40_NAME').startsWith('Unidentified')
    && r40 === said('R40_RESTORE') && r40.includes('missing'), `island ${said('R40_NAME')} "${said('R40_RESTORE')}" / browser ${seenName(piece, g)} "${r40}"`);

  const bauble = g.inventory.add('tarnished_bauble', { ql: 30, extra: 'major' });
  set(g, 'restoration', 10);
  const bno = 'Unidentified bauble: needs restoration 40; have 10.0.';
  const b10 = ask(g, 'restore_relic', { kind: 'item', uid: bauble.uid } as Target);
  set(g, 'restoration', 40);
  const b40 = ask(g, 'restore_relic', { kind: 'item', uid: bauble.uid } as Target);
  check(`a tarnished major bauble at restoration 10: "Unidentified bauble", Restore "${bno}"; at 40, restored; on both sides`,
    said('B10_NAME') === 'Unidentified bauble' && b10 === bno && said('B10_RESTORE') === bno && b40 === 'ALLOWED' && said('B40_RESTORE') === 'ALLOWED',
    `island ${said('B10_NAME')} "${said('B10_RESTORE')}" ${said('B40_RESTORE')} / browser "${b10}" ${b40}`);
}

/* ---- workers at their own level ---------------------------------------------------- */

{
  const cook = (lv: number): string => ['bake_potato', 'bake_bread', 'make_apple_pie'].filter((id) => workerRecipeOpen({ skills: { cooking: lv } }, id)).join(',');
  check('a cook at cooking 1 takes baked potato only, at 20 bread and apple pie too, on both sides',
    cook(1) === 'bake_potato' && said('COOK1') === 'bake_potato' && cook(20) === 'bake_potato,bake_bread,make_apple_pie' && said('COOK20') === cook(20),
    `island ${said('COOK1')} / ${said('COOK20')} — browser ${cook(1)} / ${cook(20)}`);
  const c = { skills: { masonry: 30, carpentry: 1 } };
  const hod = [workerBuildOpen(c, 'plank', { wall: 'solid' }), workerBuildOpen(c, 'log', { wall: 'solid' }), workerBuildOpen(c, 'log', { wall: 'door' }),
    workerBuildOpen(c, 'sandstone', { wall: 'door' }), workerBuildOpen(c, 'marble', { wall: 'solid' }), workerBuildOpen(c, 'stone_brick', { floor: 'stairs', hand: 's' })].join(',');
  check('a hod carrier at masonry 30, carpentry 1: a log wall, a sandstone door and a stone spiral staircase, not a plank wall, a log door or marble; each gate at its own level in the gate\'s skill',
    hod === 'false,true,false,true,false,true' && said('HOD') === hod, `island ${said('HOD')} / browser ${hod}`);
  const wall = { kind: 'wall', wall: { material: 'plank', type: 'solid' } as Wall } as const;
  const floor = { kind: 'floor', floor: { material: 'marble', kind: 'floor' } as FloorTile } as const;
  check('and fits only the work it may: a plank wall skipped, a log one taken, a marble floor skipped, on both sides',
    !hodMay(c, wall) && hodMay(c, { kind: 'wall', wall: { ...wall.wall, material: 'log' } }) && !hodMay(c, floor)
      && said('HOD_WALL') === 'true' && said('HOD_PLANK') === 'false' && said('HOD_LOG') === 'true',
    `island ${said('HOD_WALL')} ${said('HOD_PLANK')} ${said('HOD_LOG')}`);
  check('a restorer under a relic\'s gate passes it by: Old lamp 40 at its restoration 30',
    !workerRecipeOpen({ skills: {} }, 'make_apple_pie') && gateOf('relic', 'old lamp')?.level === 40);
  const idle = idleSays({ why: 'gate', n: 0, what: ['recipe', 'make_apple_pie'] }, 'cook', null, 1, { cooking: 1 });
  check(`a cook with only apple pie's makings in the stores: "${idle}"`, idle === 'Idle: Apple pie in your settlement stores needs cooking 20 (yours 1.0).', idle);
  const relic = idleSays({ why: 'gate', n: 0, what: ['relic', 'old lamp'] }, 'restore', null, 1, { restoration: 30 });
  check(`a restorer with only an old lamp's pieces: "${relic}"`, relic === 'Idle: Old lamp in your settlement stores needs restoration 40 (yours 30.0).', relic);
}

/* ---- the Skills window ----------------------------------------------------------- */

{
  const shown = (skill: string, have: number): string => unlocksOf(skill, have).map((u) => `${u.met ? '✓' : '·'}${u.name} ${u.level}`).join(', ');
  const carp = unlocksOf('carpentry', 10);
  check(`carpentry's Unlocks: its crafts, materials, wall and floor types, ticked at 10 (${carp.filter((u) => u.met).length} of ${carp.length})`,
    carp.some((u) => u.name === 'Plank building' && u.met) && carp.some((u) => u.name === 'Wagon' && u.level === 70 && !u.met)
      && carp.some((u) => u.name === 'Caravel' && u.level === 90) && carp.some((u) => u.name === 'Bay window' && u.level === 20)
      && carp.every((u, i) => (i === 0 || carp[i - 1].level <= u.level) && u.met === (u.level <= 10)), shown('carpentry', 10).slice(0, 400));
  check('cooking\'s Unlocks: every dish at its level',
    shown('cooking', 10) === unlocksOf('cooking', 10).map((u) => `${u.met ? '✓' : '·'}${u.name} ${u.level}`).join(', ')
      && unlocksOf('cooking', 10).some((u) => u.name === 'Apple pie' && u.level === 20 && !u.met) && unlocksOf('cooking', 10).some((u) => u.name === 'Bread' && u.met),
    shown('cooking', 10));
  check('the next gate beside each skill\'s level: woodcutting 7.2 → "10: Maple"', nextUnlockBar('woodcutting', 7.2) === '10: Maple', nextUnlockBar('woodcutting', 7.2) ?? 'none');
  const at5 = [...new Set(SKILL_GATES.filter((g) => g.skill === 'cooking' && g.level === 5).map((g) => g.name))];
  check(`several at one level: the first in the table's order and how many more ("${nextUnlockBar('cooking', 1)}")`,
    nextUnlockBar('cooking', 1) === `5: ${at5[0]} +${at5.length - 1} more`, nextUnlockBar('cooking', 1) ?? 'none');
  check('none left: nothing', nextUnlockBar('cooking', 30) === null && nextUnlockBar('woodcutting', 90) === null && nextUnlockBar('swimming', 1) === null);
}

finish('Skill gates: recipes, restoring, walls, floors and paving, for you and for workers at their own level');
