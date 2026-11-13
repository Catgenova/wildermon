/**
 * Which clip a job at work plays, by the job and by its tool (`./index.ts` `workClipOf`): kept apart from the clips, so
 * the page's own text (What's new) can count the jobs each clip plays without loading the sculpted bodies.
 */
import { ACTION_BY_ID } from '../../game/actions';
import { RECIPE_BY_ID } from '../../game/recipes';

/**
 * The clip a job in the `work` state plays, by the tool it is done with (its action's `tool`, `../../game/actions.ts`):
 * the strike at the bench (`work`) for the tools struck with or held to the work in one hand; any other tool, or none,
 * the state's own (`./index.ts` `CLIP_OF.work`); a needle's jobs sewn (`sew`), the rope tool's laid up (`rope`). A later clip for a family
 * of tools adds its rows.
 */
export const CLIP_OF_TOOL: Readonly<Record<string, string>> = {
  hammer: 'work', mallet: 'work', chisel: 'work', hatchet: 'work', butchering_knife: 'work',
  awl: 'work', carving_knife: 'work', trowel: 'work', file: 'work', whetstone: 'work',
  // the handwork (./clips/handwork.ts): every job done with a needle sewn, with the rope tool laid up
  needle: 'sew', rope_tool: 'rope',
};
/**
 * The clip a job in the `work` state plays, by the job (its action's id), before its tool (`CLIP_OF_TOOL`):
 * - the strike (`work`) for a job whose tool is chosen each go (`ActionDef.toolFor`) or is a list (improving: the
 *   material's tools): planning (the mallet), building a wall, a floor or a column (the mallet or the trowel, by material),
 *   and improving (a file, a whetstone, a carving knife, an awl, a chisel or a needle);
 * - the work with the hands and no tool at waist height (`hands`) for the jobs below, and for every recipe made with no
 *   tool that is not cooked at a campfire (`handsRecipe`);
 * - the work knelt at the ground with no tool (`ground`): planting and sowing, foraging and searching, the traps, picking
 *   up, at the water's edge, tending a campfire or an ash pit. (Driving a post in and pulling it up are lifts, not ground
 *   work; cooking at a campfire keeps the state's own until a clip of its own.)
 * - the brush's jobs by what is brushed (`./clips/handwork.ts`): a wall (`brush-wall`), a floor or the ground
 *   (`brush-floor`), an item held in the other hand (`brush-item`, a cloth's dye `brush-cloth`).
 * A later clip for a family of jobs adds its rows.
 */
export const CLIP_OF_JOB: Readonly<Record<string, string>> = Object.fromEntries([
  ...[
    'plan_building', 'add_to_building', 'plan_wall', 'plan_fence', 'plan_floor', 'plan_column',
    'build_wall', 'change_wall', 'add_floor', 'build_floor', 'build_column', 'improve_item',
  ].map((job) => [job, 'work']),
  ...[
    // an item in hand
    'repair_item', 'patch_item', 'mend_kit', 'seal_item', 'sign_item', 'dye_item', 'make_dye_recipe', 'boil_dye_recipe', 'strip_dye',
    'enchant', 'absorb_soul', 'hone_whetstone', 'open_seed_jar', 'open_ferment', 'serve_dish', 'quench_item', 'draw_map', 'copy_map',
    'use_bronze_mirror', 'use_ancient_file', 'use_ancient_lamp', 'use_ancient_pot',
    // a vessel filled or emptied, a waist-high smelter, kiln, oven, barrel, crate or piece of furniture
    'fill_bucket', 'fill_skin', 'pour_into_barrel', 'empty_vessel',
    'fuel_smelter', 'light_smelter', 'damp_smelter', 'pour_ingot', 'smelter_take_all', 'fuel_kiln', 'light_kiln', 'damp_kiln', 'kiln_take_all',
    'fuel_oven', 'light_oven', 'put_out_oven', 'furniture_take_all', 'crate_take_all', 'start_brew', 'set_brew_spring',
  ].map((job) => [job, 'hands']),
  ...[
    // a tile or a plant
    'plant', 'plant_seed', 'sow_patch', 'plant_moss', 'plant_grass', 'plant_vine', 'drop_dirt', 'drop_dirt_here', 'change_tile',
    'forage', 'botanize', 'pick_flowers', 'collect_motes', 'lift_stones', 'track', 'search_caches', 'dig_cache',
    // an item or a trap on the ground
    'pick_up', 'pick_up_all', 'set_trap', 'take_catch', 'empty_creel', 'pick_up_trap', 'strike_foundation',
    // the water's edge
    'pan', 'drink', 'plant_lily', 'plant_lotus', 'pick_water_plant', 'pull_water_plant',
    // a fire on the ground, an ash pit
    'build_campfire', 'light_campfire', 'fuel_campfire', 'put_out_campfire', 'take_apart_campfire',
    'take_ashes_fire', 'take_ashes_oven', 'take_ashes_smelter', 'take_ashes_kiln',
  ].map((job) => [job, 'ground']),
  // the brush's jobs by what is brushed (./clips/handwork.ts): a wall, a floor or the ground, the work held in the other hand
  ...['paint_wall', 'scrub_wall_paint'].map((job) => [job, 'brush-wall']),
  ...['paint_floor', 'scrub_floor_paint', 'scrub_moss'].map((job) => [job, 'brush-floor']),
  ...['glaze_item', 'restore_relic'].map((job) => [job, 'brush-item']),
  ['scrub_dye', 'brush-cloth'],
]);
/** Whether a job is a recipe made with no tool and not at a campfire (cooking there is done crouched at the fire). */
const handsRecipe = (job: string): boolean => {
  const r = RECIPE_BY_ID.get(job);
  return !!r && !r.tool && !ACTION_BY_ID.get(job)?.tool && r.station !== 'campfire';
};
/** The clip a job in the `work` state plays (`CLIP_OF_JOB`, then `CLIP_OF_TOOL`, then `handsRecipe`), or none: the state's own. */
export function clipOfJob(job: string): string | undefined {
  const tool = ACTION_BY_ID.get(job)?.tool;
  return CLIP_OF_JOB[job] ?? (tool !== undefined ? CLIP_OF_TOOL[tool] : undefined) ?? (handsRecipe(job) ? 'hands' : undefined);
}
