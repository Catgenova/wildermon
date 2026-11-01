import { itemDef } from './items';

/*
 * The tools of jobs that had gone without one, each named once: the recipe's or the action's `tool`, which the island
 * gets in its definitions (`recipe.tool`, `action_def.tool`), and which wears a go's worth with every go on both sides.
 */
/** Sewing cloth clothes: a tunic, sleeves, trousers, shoes and a wool cap. */
export const SEW_TOOL = 'needle';
/** Fitting a head or a blade to a shaft, a haft, a grip or a handle. */
export const FIT_TOOL = 'hammer';
/** Cutting grass and moss, and harvesting a field or a patch. Cutting a wild vine is `CUTTING_TOOL` (`vineyard.ts`). */
export const REAP_TOOL = 'sickle';
/** Tending a field or a patch, and clearing a field. */
export const TEND_TOOL = 'rake';
/** Paving with cobblestones, mixing mortar and mixing concrete. */
export const MORTAR_TOOL = 'trowel';
/** Glazing a pot, painting a wall and painting a floor. */
export const BRUSH_TOOL = 'brush';

/** The jobs each of those is needed for, by recipe or action id: for the help and the news to name, and the tests to ask. */
export const TOOL_JOBS: Readonly<Record<string, readonly string[]>> = {
  [SEW_TOOL]: ['make_wool_cap', 'make_cloth_tunic', 'make_cloth_sleeves', 'make_cloth_trousers', 'make_cloth_shoes'],
  [FIT_TOOL]: ['fit_axe_head', 'fit_hammer_head', 'fit_hatchet_head', 'fit_knife_blade', 'fit_long_sword_blade', 'fit_maul_head',
    'fit_pickaxe_head', 'fit_rake_head', 'fit_saw_blade', 'fit_short_sword_blade', 'fit_shovel_head', 'fit_sickle_blade',
    'fit_spear_head', 'fit_sword_blade', 'fit_throwing_axe', 'fit_trowel_blade', 'make_carving_knife', 'make_hunting_knife'],
  [REAP_TOOL]: ['cut_grass', 'cut_moss', 'cut_vine', 'harvest_crop', 'harvest_patch'],
  [TEND_TOOL]: ['tend_crop', 'tend_patch', 'clear_field'],
  [MORTAR_TOOL]: ['pave_cobble', 'make_mortar', 'mix_concrete'],
  [BRUSH_TOOL]: ['glaze_item', 'paint_wall', 'paint_floor'],
};

/** What a job says when the tool it asks for is not carried: the island's `need_tool`, "Need a sickle." */
export const needToolSaid = (tool: string): string => `Need a ${itemDef(tool).name.toLowerCase()}.`;
/** The same refusal, or null when the tool is in the pack. */
export const lacksTool = (g: { inventory: { has(id: string): boolean } }, tool: string): string | null =>
  (g.inventory.has(tool) ? null : needToolSaid(tool));
