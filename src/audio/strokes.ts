// What a go at a job sounds like (`strokeOf`), in a leaf: the rules ask it of
// every go (`Game.soundOfWork`) without loading the mixer, which says it on
// (`sound.ts`).
import type { Stroke } from './kit';

/**
 * What a job sounds like, which is a question about the stuff and not about
 * the person.
 *
 * Four hundred and thirty-five jobs, seven noises. The trade is nearly always
 * enough to say which — a mason is hitting stone whatever he is making out of
 * it, and a smith is hitting metal — so the skill carries most of the table
 * and the list by name is for the jobs the trade gets wrong, or that have no
 * trade at all because anybody can do them.
 *
 * And then a list of silences, which is the part that matters. A job missing
 * from every table would be silent too, and silently: adding a trade and
 * forgetting to say what it sounds like would look exactly like deciding it
 * makes no noise. So the ones that genuinely make none are named, and
 * `heard.ts` holds every job in the game to one list or the other.
 */

/** Jobs that take time and still make no noise of their own. */
export const HUSHED: ReadonlySet<string> = new Set([
  // A blow is already spoken for. Every landed hit raises `hit`, which is
  // where the fighting is heard; a work stroke on top of it would be the same
  // swing twice.
  'attack_creature', 'shoot_creature',
  // Eating, drinking and sleeping. A body doing something to itself.
  'eat', 'drink', 'drink_skin', 'drink_from_vessel', 'sleep', 'study_book', 'study_map', 'read_recipe', 'read_formula', 'open_ferment', 'serve_dish', 'drink_tea',
  // Faith and the paths, which are the two things on this island done by
  // sitting still; and what is given up at the altar, and what it gives back.
  'pray', 'meditate', 'sacrifice', 'absorb_soul',
  // And a prayer said over a patron's statue in the pack, as at an altar (`faith.ts`).
  'pray_statue',
  // Getting on and off things, and being pulled along by one.
  'board_vehicle', 'board_passenger', 'mount_creature', 'dismount_creature', 'pull_cart', 'unhitch_team',
  // Winning an animal over, which is done by standing very quietly; and a
  // skep's honey, which is taken the same way (`bees.ts`).
  'tame', 'take_catch', 'pair_creature', 'take_honey',
  // Reading a trail, which is done by standing still and looking (`tracking.ts`).
  'track',
  // And reading the ground for a critter cache, the same way (`winter.ts`).
  'search_caches',
  // Ceremony. A stake going in has already made the noise of a stake going in.
  'found_settlement', 'upgrade_deed',
  // A lantern post's wick pinched out between finger and thumb (`lamps.ts`).
  'douse_lamp',
  // A name and a line scratched into a masterwork (`signing.ts`).
  'sign_item',
]);

export const STROKE_BY_ID: Record<string, Stroke> = {
  // Ground.
  dig: 'earth', dredge: 'earth', flatten: 'earth', pack: 'earth', cultivate: 'earth',
  drop_dirt: 'earth', drop_dirt_here: 'earth', change_tile: 'earth', dig_stump: 'earth',
  // A critter cache dug out of the winter ground by hand (`winter.ts`).
  dig_cache: 'earth',
  take_ashes_oven: 'earth', take_ashes_fire: 'earth', take_ashes_smelter: 'earth', take_ashes_kiln: 'earth',
  // Stone, whether it is being cut or merely shifted.
  pave_cobble: 'stone', pave_slabs: 'stone', remove_paving: 'stone',
  lay_steps: 'stone', take_up_steps: 'stone',
  raise_rock: 'stone', chip_corner: 'stone', strike_foundation: 'stone',
  place_smelter: 'stone', pick_up_smelter: 'stone', place_kiln: 'stone', pick_up_kiln: 'stone',
  place_anvil: 'stone', pick_up_anvil: 'stone',
  // A bauble pressed into its socket in the altar's stone.
  set_bauble: 'stone',
  // An aqueduct's stone, laid in mortar with a trowel, and pulled down again.
  build_aqueduct: 'stone', demolish_aqueduct: 'stone',
  // Timber. Building is a mallet on pegs whatever the walls end up being made
  // of, which is the one place the material of the thing and the noise of
  // making it genuinely part company.
  plan_building: 'wood', add_to_building: 'wood', remove_from_plan: 'wood',
  plan_wall: 'wood', plan_fence: 'wood', build_wall: 'wood', change_wall: 'wood', remove_wall: 'wood',
  add_floor: 'wood', plan_floor: 'wood', build_floor: 'wood', remove_floor: 'wood', remove_storey: 'wood', no_plan: 'wood', mark_out: 'wood',
  plan_column: 'wood', build_column: 'wood', remove_column: 'wood',
  plan_bridge: 'wood', build_bridge: 'wood', demolish_bridge: 'wood', plan_aqueduct: 'wood',
  place_crate: 'wood', pick_up_crate: 'wood', place_post: 'wood', pick_up_post: 'wood',
  place_furniture: 'wood', turn_furniture: 'wood', pick_up_furniture: 'wood',
  lay_timber_steps: 'wood',
  take_apart_campfire: 'wood', set_trap: 'wood', pick_up_trap: 'wood',
  // Metal on metal, which is the loudest thing anybody does here.
  smith: 'metal', strike_coins: 'metal', improve_item: 'metal', shoe_creature: 'metal', ring_bell: 'metal',
  fit_lock: 'metal', take_off_lock: 'metal',
  // A lantern hung on a post's iron hook or set in a pillar's iron cage, and lifted off it (`lamps.ts`).
  fit_lamp: 'metal', take_lamp: 'metal',
  // A portcullis and a drawbridge: chain over a winch, and an iron grille in its grooves (`gates.ts`).
  raise_portcullis: 'metal', lower_portcullis: 'metal', raise_drawbridge: 'metal', lower_drawbridge: 'metal',
  // Water, poured or drawn.
  fish: 'water', fill_bucket: 'water', fill_skin: 'water',
  empty_vessel: 'water', pour_into_barrel: 'water', leach_lye: 'water', fill_barrel: 'water', empty_creel: 'water',
  // A water mote set in a barrel (a brewer's spring) or in an aqueduct's head: water, as poured.
  set_brew_spring: 'water', set_aqueduct_mote: 'water',
  damp_smelter: 'water', damp_kiln: 'water', put_out_oven: 'water', put_out_campfire: 'water',
  // Hot metal going into it (a Smith's Temper Bath).
  quench_item: 'water',
  // A fire being got going, or kept going.
  light_oven: 'fire', light_campfire: 'fire', light_smelter: 'fire', light_kiln: 'fire', light_lamp: 'fire',
  fuel_oven: 'fire', fuel_campfire: 'fire', fuel_smelter: 'fire', fuel_kiln: 'fire',
  // And handling: things going into a pack and straps going onto an animal.
  pick_up: 'cloth', pick_up_all: 'cloth', feed: 'cloth', candle_lamp: 'cloth',
  tack_creature: 'cloth', untack_creature: 'cloth', hitch_creature: 'cloth',
  groom: 'cloth', make_brush: 'cloth', patch_item: 'cloth', apply_salve: 'cloth', mend_kit: 'cloth', seal_item: 'cloth',
  // A Healer's poultice, a dressing or a treatment with a life mote (`firstaid.ts`): cloth, as the dressing is.
  dress_poultice: 'cloth', treat_poultice: 'cloth',
  // An ancient comb drawn through a coat, a file over a hide and a pot's contents worked in (`creatureActions`, `use_ancient_*`).
  use_ancient_comb: 'cloth', use_ancient_file: 'cloth', use_ancient_pot: 'cloth',
  // And an ancient lamp lit over one to rekindle a trait, as any lamp is lit.
  use_ancient_lamp: 'fire',
  // A collar, bridle and brace strapped on, a whetstone along an edge, a jar unstopped and a tablet's runes read (`relicuse.ts`).
  use_ancient_collar: 'cloth', use_ancient_bridle: 'cloth', use_ancient_brace: 'cloth',
  // A bronze mirror held up to one, bronze as a bell is.
  use_bronze_mirror: 'metal',
  hone_whetstone: 'stone', open_seed_jar: 'cloth', read_rune_tablet: 'cloth',
  // A statuette's stone enchanted into a patron's statue (`relicuse.ts`), as a bauble is pressed into the altar's.
  enchant_statue: 'stone',
  // Wildermon gear buckled on and off (`wildgearActions.ts`), as tack is.
  fit_gear_pack: 'cloth', remove_gear_pack: 'cloth', fit_gear_harness: 'cloth', remove_gear_harness: 'cloth',
  fit_gear_barding: 'cloth', remove_gear_barding: 'cloth',
  crate_take_all: 'cloth', smelter_take_all: 'cloth', kiln_take_all: 'cloth', furniture_take_all: 'cloth',
  // Leaves torn off a wall, and a brush over stone, as a groom's brush over a coat sounds.
  clear_ivy: 'cloth', scrub_moss: 'cloth',
  // And a brush over a dyed thing, a painted side and a painted floor (`dyes.ts`, `buildActions.ts`).
  scrub_dye: 'cloth', scrub_wall_paint: 'cloth', scrub_floor_paint: 'cloth',
  // A dye written down on a sheet of papyrus, as a map is (`dyes.ts`).
  make_dye_recipe: 'cloth',
};

const BY_SKILL: Record<string, Stroke> = {
  digging: 'earth', farming: 'earth', archaeology: 'earth',
  paving: 'stone', mining: 'stone', prospecting: 'stone', masonry: 'stone',
  stonecutting: 'stone', pottery: 'stone',
  woodcutting: 'wood', forestry: 'wood', carpentry: 'wood', fine_carpentry: 'wood',
  bowyery: 'wood', fletching: 'wood', papyrusmaking: 'wood',
  blacksmithing: 'metal', weaponsmithing: 'metal', armorsmithing: 'metal',
  chainsmithing: 'metal', platesmithing: 'metal', jewellery: 'metal',
  smelting: 'fire', cooking: 'fire', milling: 'fire', brewing: 'fire', alchemy: 'fire', glassblowing: 'fire',
  tailoring: 'cloth', leatherworking: 'cloth', ropemaking: 'cloth', repair: 'cloth',
  first_aid: 'cloth', chirurgy: 'cloth', butchering: 'cloth', restoration: 'cloth',
  foraging: 'cloth', botanizing: 'cloth',
  // Motes gathered out of a swirl by hand, as a forager gathers (`motes.ts`).
  elementalism: 'cloth',
  // A scroll written and a weapon enchanted, at a bench as papyrus is pressed.
  enchanting: 'cloth',
  fishing: 'water',
};

/**
 * Whether a go at this job is work at all.
 *
 * The same question the hands are asked — a go that costs no wind and takes
 * no time is a click rather than a stroke — so examining a tile and locking a
 * chest stay silent for the same reason they teach the body nothing.
 */
export const isWork = (def: { baseTime?: number; stamina?: number }): boolean =>
  (def.baseTime ?? 0) > 0 || (def.stamina ?? 0) > 0;

/** The sound of one go at a job, or null for the ones that make none. */
export function strokeOf(def: { id: string; skill?: string; baseTime?: number; stamina?: number }): Stroke | null {
  if (!isWork(def) || HUSHED.has(def.id)) return null;
  return STROKE_BY_ID[def.id] ?? (def.skill ? BY_SKILL[def.skill] ?? null : null);
}
